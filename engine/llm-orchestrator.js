/**
 * @file engine/llm-orchestrator.js
 * @description Orquestador Híbrido v2.4: Motor + IA + Grounding de tablas + Fallback Profesor
 * @costo $0: Groq Free Tier + Lógica de Fallback inteligente
 */

import { RouterIntenciones } from './router-intenciones.js';
import { ConsultorTablas } from './consultor-tablas.js';
import { SesionManager as ContextManager } from './sesion-manager.js';
import { 
  buscarTabla, 
  generarContextoTabla, 
  generarContextoCategoria, 
  obtenerCategorias 
} from './data/tablas-referencia.js';

// ✅ sesionInicial definido inline
export const sesionInicial = {
  usuario: null,
  parametros: {},
  historial: [],
  personalidad_activa: null,
  contexto_validacion_pendiente: null,
  trazabilidad: { tablas_consultadas: [] }
};

const LLM_CONFIG = {
  provider: process.env.LLM_PROVIDER || 'groq', 
  model: process.env.LLM_MODEL || 'llama-3.1-8b-instant',
  apiKey: process.env.LLM_API_KEY,
  maxTokens: 350,
  temperature: 0.15
};

let llmCallCount = 0;

export class LLMAgente {
  
  static async procesar(inputUsuario, sesion = null) {
    if (!sesion) sesion = JSON.parse(JSON.stringify(sesionInicial));

    const intencion = RouterIntenciones.detectarIntencion(inputUsuario);
    const texto = inputUsuario.toLowerCase();

    // ✅ MEJORADO: Detección de preguntas sobre tablas (incluye typos "table")
    const preguntaPorTabla = /explica\s+(la\s+)?(tabla|table)\s+(\d{3}-\d{2}|\d{3})/i.test(texto);
    if (preguntaPorTabla) {
      const match = texto.match(/(\d{3}-\d{2}|\d{3})/);
      if (match) {
        return await RouterIntenciones.procesar(`Explica la tabla ${match[1]}`, sesion);
      }
    }

    // RUTA 1: MOTOR DETERMINÍSTICO
    const esCalculo = /(\d+)\s*(A|V|HP|AWG|kW|m|kcmil)/i.test(texto);
    if (['VALIDADOR', 'DISEÑADOR'].includes(intencion) || 
        (intencion === 'CONSULTOR' && esCalculo)) {
      return await this._rutaMotor(inputUsuario, sesion);
    }

    // RUTA 2: AGENTE IA HÍBRIDO (con grounding de tablas)
    if (intencion === 'PROFESOR' || /explica|qué dice|norma|artículo|concepto|fundamento|qué es|para qué sirve/i.test(texto)) {
      return await this._rutaHibrida(inputUsuario, sesion);
    }

    // RUTA 3: AGENTE IA PURO
    return await this._rutaLLMPuro(inputUsuario, sesion);
  }

  static async _rutaMotor(input, sesion) {
    console.log(`[Motor] Procesando: "${input.substring(0, 50)}..."`);
    return await RouterIntenciones.procesar(input, sesion);
  }

  static async _rutaHibrida(input, sesion) {
    llmCallCount++;
    console.log(`[IA Híbrida] #${llmCallCount}: "${input.substring(0, 40)}..."`);
    
    const matchDatos = input.match(/(\d+(?:\.\d+)?)\s*(A|V|HP|mm|AWG|kcmil)/gi);
    const datosExtraidos = matchDatos ? matchDatos.join(', ') : null;

    let resultadoMotor = null;
    if (datosExtraidos) {
      try {
        resultadoMotor = await RouterIntenciones.procesar(input, sesion);
      } catch (e) {
        console.warn('[IA] Motor falló, continuando solo con IA:', e.message);
      }
    }

    // ✅ MEJORADO: Inyectar contexto de tabla (por número, nombre o categoría)
    const tablaContext = await this._injectTableContext(input);
    const prompt = this._buildHybridPrompt(input, resultadoMotor, datosExtraidos, tablaContext);
    const llmResponse = await this._llmCall(prompt, 'hibrida');
    
    if (!llmResponse || llmResponse.length < 10) {
      console.warn('[IA] Respuesta muy corta, fallback a motor');
      return await this._rutaMotor(input, sesion);
    }

    return {
      respuesta: {
        texto: llmResponse,
        modo: 'explicacion_ia',
        fuente_motor: resultadoMotor?.respuesta?.fundamento || null,
        meta: { llm_calls: llmCallCount }
      },
      sesion: ContextManager.registrarConsulta 
        ? ContextManager.registrarConsulta(sesion, input, { texto: llmResponse, modo: 'explicacion_ia' })
        : this._registrarConsultaSimple(sesion, input, { texto: llmResponse, modo: 'explicacion_ia' })
    };
  }

  static async _rutaLLMPuro(input, sesion) {
    llmCallCount++;
    console.log(`[IA Pura] #${llmCallCount}: "${input.substring(0, 40)}..."`);
    
    const tablaContext = await this._injectTableContext(input);
    const prompt = this._buildPurePrompt(input, tablaContext);
    const llmResponse = await this._llmCall(prompt, 'pura');
    
    if (!llmResponse || llmResponse.length < 10) {
      console.warn('[IA] Respuesta muy corta, fallback genérico');
      return {
        respuesta: {
          conclusion: "⚠️ No pude procesar esta consulta con IA. Intenta reformular o usa una consulta numérica para validación determinística.\n\nEjemplos válidos:\n• 'calibre para 50A'\n• 'puesta a tierra para interruptor 100A'\n• 'motor 75 HP 440V trifásico'",
          modo: 'fallback_ia'
        },
        sesion: ContextManager.registrarConsulta 
          ? ContextManager.registrarConsulta(sesion, input, { modo: 'fallback_ia' })
          : this._registrarConsultaSimple(sesion, input, { modo: 'fallback_ia' })
      };
    }
    
    return {
      respuesta: {
        texto: llmResponse,
        modo: 'consulta_general_ia',
        meta: { llm_calls: llmCallCount }
      },
      sesion: ContextManager.registrarConsulta 
        ? ContextManager.registrarConsulta(sesion, input, { texto: llmResponse, modo: 'consulta_general_ia' })
        : this._registrarConsultaSimple(sesion, input, { texto: llmResponse, modo: 'consulta_general_ia' })
    };
  }

  static _registrarConsultaSimple(sesion, input, respuesta) {
    if (!sesion.historial) sesion.historial = [];
    sesion.historial.push({ 
      input, 
      respuesta: typeof respuesta === 'object' ? { modo: respuesta.modo } : respuesta,
      timestamp: new Date().toISOString() 
    });
    return sesion;
  }

  /**
   * ✅ MEJORADO: Inyectar contexto de tabla para grounding
   * Busca por:
   * 1. Número de tabla (ej: "tabla 250-122")
   * 2. Nombre o concepto (ej: "ampacidad", "puesta a tierra")
   * 3. Categoría completa (ej: "explica puesta a tierra")
   */
  static async _injectTableContext(input) {
    const texto = input.toLowerCase();
    
    // 1. Búsqueda por número de tabla (ej: "tabla 250-122")
    const matchNum = texto.match(/tabla\s+(\d{3}-\d{2}|\d{3})/i);
    if (matchNum) {
      const tablaClave = matchNum[1];
      const contexto = generarContextoTabla(tablaClave);
      if (contexto) return contexto;
    }
    
    // 2. Búsqueda por nombre o concepto (ej: "ampacidad", "puesta a tierra")
    const tablaEncontrada = buscarTabla(texto);
    if (tablaEncontrada) {
      const contexto = generarContextoTabla(tablaEncontrada.clave);
      if (contexto) return contexto;
    }
    
    // 3. Búsqueda por categoría (ej: "explica puesta a tierra" → categoría 'puesta_tierra')
    const categorias = obtenerCategorias();
    for (const cat of categorias) {
      const nombreCat = cat.replace(/_/g, ' ');
      if (texto.includes(nombreCat)) {
        const contexto = generarContextoCategoria(cat);
        if (contexto) return contexto;
      }
    }
    
    return '';
  }

  // ✅ CORREGIDO: Prompt con contexto de tabla inyectado
  static _buildHybridPrompt(input, resultadoMotor, datosExtraidos, tablaContext = '') {
    const contextoMotor = resultadoMotor?.respuesta?.conclusion 
      ? `Validación técnica: ${resultadoMotor.respuesta.conclusion.substring(0, 120)}` 
      : '';
    
    return `Eres Baymax, asistente experto en NOM-001-SEDE-2012.

${tablaContext}

Usuario: "${input}"
${contextoMotor}
${datosExtraidos ? `Datos detectados: ${datosExtraidos}` : ''}

Instrucciones:
- Responde en español, máximo 120 palabras
- Si hay CONTEXTO TÉCNICO (entre corchetes), úsalo OBLIGATORIAMENTE para asegurar precisión
- Cita el artículo o tabla de la norma (ej: "Art. 250-122 NOM-001-SEDE-2012")
- Si el caso requiere evaluación in situ, añade: "⚠️ Requiere verificación por ingeniero certificado"
- Sé amable, profesional y útil
- Termina preguntando si necesita más ayuda

Respuesta:`;
  }

  static _buildPurePrompt(input, tablaContext = '') {
    return `Asistente técnico de electricidad industrial (NOM-001-SEDE-2012).

${tablaContext}

Usuario: "${input}"

Instrucciones:
- Responde en español, máximo 100 palabras
- Si hay CONTEXTO TÉCNICO (entre corchetes), úsalo para precisión
- Cita la norma si es relevante (ej: "NOM-001-SEDE-2012 Art. 250-122")
- Si no puedes validar con certeza, sugiere consultar a un profesional certificado
- Sé útil y conciso

Respuesta:`;
  }

  static async _llmCall(prompt, tipo = 'desconocida') {
    if (!LLM_CONFIG.apiKey) {
      console.warn('[IA] API Key no configurada');
      return null;
    }

    const maxRetries = 2;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: LLM_CONFIG.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: LLM_CONFIG.maxTokens,
            temperature: LLM_CONFIG.temperature,
            stream: false
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Sin detalles');
          console.error(`[IA] HTTP ${response.status}: ${errorText.substring(0, 100)}`);
          
          if (response.status === 429 && attempt < maxRetries) {
            const waitTime = (attempt + 1) * 2000;
            console.warn(`[IA] Rate limit, esperando ${waitTime/1000}s... (intento ${attempt + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
          }
          return null;
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content?.trim();
        
        if (!content) {
          console.warn('[IA] Contenido vacío en respuesta');
          if (attempt < maxRetries) continue;
          return null;
        }
        
        return content;

      } catch (error) {
        lastError = error;
        console.error(`[IA] Error en llamada (${tipo}):`, error.message);
        
        if (error.name === 'AbortError' && attempt < maxRetries) {
          console.warn(`[IA] Timeout, reintentando... (intento ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
      }
    }
    
    console.error(`[IA] Fallo después de ${maxRetries + 1} intentos`);
    return null;
  }

  static getStats() {
    return { llm_calls: llmCallCount };
  }
}

export default LLMAgente;