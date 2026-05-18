/**
 * @file engine/personalidades/disenador.js
 * @description Personalidad DISEÑADOR - Diseño completo de instalaciones industriales
 * @version 3.2 - Corregido: Tabla 250-122 por interruptor + ajuste proporcional por caída (Art. 250-122(B))
 * @reference NOM-001-SEDE-2012, Artículos 210, 215, 250-122, 310-16, 430, 440, 630
 */

import { ConsultorTablas } from '../consultor-tablas.js';
import { CalibreConverter } from '../../utils/conversion-calibres.js';
import { ContextManager } from '../context-manager.js';
import { PlanManager } from '../../utils/feature-flags.js';

// ============================================
// CONFIGURACIÓN DEL DISEÑO INDUSTRIAL
// ============================================

/**
 * Los 9 parámetros críticos para diseño industrial según NOM-001
 * Orden lógico de pregunta para minimizar fricción del usuario
 */
export const PARAMETROS_DISENO = [
// En PARAMETROS_DISENO, para tension_v:
  {
    key: 'tension_v',
    pregunta: "¿Qué tensión nominal maneja su sistema?",
    ejemplo: "Ej: 120V, 220V, 440V, 480V",
    // CORREGIDO: Aceptar números con o sin "V"
    validacion: (v) => /^(\d+)(V|volt|volts)?$/i.test(v) && parseInt(v) >= 120 && parseInt(v) <= 15000,
    tipo: 'numerico',
    transform: (v) => parseInt(v.replace(/[^0-9]/g, '')) // Extraer solo números
  },
  {
    key: 'corriente_requerida',
    pregunta: "¿Cuál es la corriente de carga máxima esperada?",
    ejemplo: "Ej: 30A, 65A, 120A",
    validacion: (v) => /^[1-9]\d*$/.test(v) && parseInt(v) > 0,
    tipo: 'numerico'
  },
  {
    key: 'material',
    pregunta: "¿Usará conductor de cobre o aluminio?",
    ejemplo: "Ej: cobre, aluminio",
    validacion: (v) => /^(cobre|aluminio)$/i.test(v),
    tipo: 'opcion',
    opciones: ['cobre', 'aluminio']
  },
  {
    key: 'tipo_aislamiento',
    pregunta: "¿Qué tipo de aislamiento usará?",
    ejemplo: "Ej: THW, THHN, XLPE",
    validacion: (v) => /^(THW|THHN|XLPE|USE|RHW)$/i.test(v),
    tipo: 'opcion',
    opciones: ['THW', 'THHN', 'XLPE', 'USE', 'RHW']
  },
  {
    key: 'temperatura_ambiente',
    pregunta: "¿La instalación está en un área con más de 40°C?",
    ejemplo: "Ej: sí, no, 35°C",
    validacion: (v) => /^(si|sí|no|n|y|\d+)$/i.test(v),
    tipo: 'condicional',
    transform: (v) => {
      if (/^(si|sí|y)$/i.test(v)) return 45;
      if (/^(no|n)$/i.test(v)) return 30;
      const num = parseInt(v);
      return isNaN(num) ? 30 : num;
    }
  },
  {
    key: 'conductores_agrupados',
    pregunta: "¿Cuántos conductores irán agrupados en la misma canalización?",
    ejemplo: "Ej: 3, 4, 6",
    validacion: (v) => /^[1-9]\d*$/.test(v) && parseInt(v) >= 1,
    tipo: 'numerico'
  },
  {
    key: 'longitud_m',
    pregunta: "¿Qué distancia hay desde el tablero hasta la carga (en metros)?",
    ejemplo: "Ej: 30, 120, 250",
    validacion: (v) => /^[1-9]\d*$/.test(v) && parseInt(v) >= 1,
    tipo: 'numerico'
  },
  {
    key: 'interruptor_A',
    pregunta: "¿De qué capacidad es el interruptor automático que protegerá el circuito?",
    ejemplo: "Ej: 30A, 60A, 100A",
    validacion: (v) => /^[1-9]\d*$/.test(v) && parseInt(v) >= 15,
    tipo: 'numerico',
    nota: "Este dato determina el conductor de puesta a tierra según Tabla 250-122"
  },
  {
    key: 'tipo_carga',
    pregunta: "¿Qué tipo de carga alimentará este circuito?",
    ejemplo: "Ej: motor, hvac, soldadora, iluminación, carga general",
    validacion: (v) => /^(motor|hvac|soldadora|iluminacion|carga general|transformador|resistiva|inductiva)$/i.test(v),
    tipo: 'opcion',
    opciones: ['motor', 'hvac', 'soldadora', 'iluminacion', 'carga general', 'transformador']
  }
];

// Parámetro adicional para ajuste por caída de tensión (preguntado condicionalmente)
const PARAMETRO_AJUSTE_CAIDA = {
  key: 'ajuste_caida_aplica',
  pregunta: "⚠️ Según Art. 250-122(B): Si los conductores de fase fueron aumentados por caída de tensión, el conductor de puesta a tierra también debe aumentarse en la misma proporción.\n\n¿Los conductores de fase fueron aumentados por caída de tensión?",
  ejemplo: "Responda: sí / no",
  validacion: (v) => /^(si|sí|yes|no|n|y)$/i.test(v),
  tipo: 'booleano',
  transform: (v) => /^(si|sí|yes|y)$/i.test(v)
};

// Parámetros adicionales para casos especiales (no se preguntan en flujo normal)
const PARAMETROS_ESPECIALES = {
  hvac: ['corriente_placa_hvac'],
  soldadora: ['corriente_primaria_soldadora', 'tipo_soldadora', 'ciclo_trabajo'],
  motor: ['motor_hp']
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Extrae datos de motor de un texto
 */
const extraerDatosMotor = (input) => {
  const hpMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:HP|Hp|hp|caballos?)/i);
  const tensionMatch = input.match(/(\d+)\s*(?:V|volt|voltios|volts)/i);
  const esTrifasico = /trifasico|trifásica|3 fases|3f|3 ph|3$/i.test(input);
  const esMonofasico = /monofasico|monofásica|1 fase|1f|1 ph|1$/i.test(input);
  
  return {
    hp: hpMatch ? parseFloat(hpMatch[1]) : null,
    tension: tensionMatch ? parseInt(tensionMatch[1]) : null,
    fases: esTrifasico ? 3 : (esMonofasico ? 1 : null)
  };
};

// ============================================
// CLASE DISEÑADOR
// ============================================

export class Disenador {
  
  /**
   * Ejecuta la personalidad DISEÑADOR
   * @param {string} input - Texto del usuario
   * @param {Object} sesion - Estado de la sesión
   * @returns {Promise<Object>} Respuesta del diseñador
   */
  static async ejecutar(input, sesion) {
    const texto = input.toLowerCase().trim();
    
    // === META-PREGUNTA: ¿Completo o rápido? ===
    if (!sesion.parametros?.modo_diseno_confirmado) {
      return await this._preguntarModoDiseno(input, sesion);
    }
    
    // === MODO RÁPIDO: Solo un dato específico ===
    if (sesion.parametros?.modo_diseno_rapido) {
      return await this._modoRapido(input, sesion);
    }
    
    // === MODO COMPLETO: Diálogo Baymax de 9+ parámetros ===
    return await this._modoCompleto(input, sesion);
  }
  
  // ============================================
  // META-PREGUNTA
  // ============================================
  
  /**
   * Pregunta meta: ¿análisis completo o dato rápido?
   */
  static async _preguntarModoDiseno(input, sesion) {
    // Si el usuario ya dio un dato específico, saltar a modo rápido
    if (/\d+\s*(A|V|HP|m|metros|awg)/i.test(input) && !/completo|todo|diseño/i.test(input)) {
      sesion = ContextManager.actualizarParametros(sesion, {
        modo_diseno_confirmado: true,
        modo_diseno_rapido: true
      });
      return await this._modoRapido(input, sesion);
    }
    
    // Si el usuario pidió explícitamente completo
    if (/completo|todo|diseño|configuración|dimensionar/i.test(input)) {
      sesion = ContextManager.actualizarParametros(sesion, {
        modo_diseno_confirmado: true,
        modo_diseno_rapido: false
      });
      return await this._modoCompleto(input, sesion);
    }
    
    // Default: preguntar con estilo Baymax
    return {
      mensaje_baymax: "🔧 Para ayudarle con su diseño industrial según la NOM-001-SEDE-2012, ¿prefiere:\n\n1. **Análisis completo** (le haré 9 preguntas para dimensionar todo el circuito)\n2. **Solo un dato específico** (rápido, para una consulta puntual)",
      opciones: ["1 - Análisis completo", "2 - Solo un dato rápido"],
      modo: 'meta_pregunta',
      _sesion_actualizada: sesion
    };
  }
  
  // ============================================
  // MODO RÁPIDO (CORREGIDO)
  // ============================================
  
  /**
   * Modo rápido: responde una consulta específica sin diálogo completo
   */
  static async _modoRapido(input, sesion) {
    // === Delegar HVAC/Soldadoras al Consultor ===
    if (/(hvac|soldadora|welder|aire acondicionado)/i.test(input)) {
      const { Consultor } = await import('./consultor.js');
      return await Consultor.ejecutar(input, sesion);
    }
    
    // === Detección de MOTOR ===
    if (/motor|hp|caballos/i.test(input)) {
      const datosMotor = extraerDatosMotor(input);
      
      if (datosMotor.hp && datosMotor.tension && datosMotor.fases) {
        const resultado = ConsultorTablas.consultarMotor({ 
          hp: datosMotor.hp, 
          tension_v: datosMotor.tension, 
          fases: datosMotor.fases 
        });
        
        if (resultado.error) {
          return { conclusion: `❌ ${resultado.error}`, modo: 'error' };
        }
        
        const ampacidad = ConsultorTablas.consultarAmpacidad({
          corriente_requerida: resultado.corriente_placa
        });
        
        return {
          respuesta_directa: `📊 MOTOR ${resultado.hp} HP, ${resultado.tension}V, ${resultado.fases} fases:
• Corriente a placa: ${resultado.corriente_placa} A
• Protección térmica: ${resultado.proteccion_termica} A (125%)
• Protección magnética: ${resultado.proteccion_magnetica} A (250%)
• Conductor sugerido: ${ampacidad.calibre} AWG

📚 Tabla 430-250 NOM-001-SEDE-2012`,
          modo: 'resultado_rapido'
        };
      }
      
      return {
        pregunta: "Para calcular el motor, necesito: HP, tensión (V) y si es monofásico o trifásico.\nEjemplo: 'motor 50 HP 440V trifásico'",
        modo: 'solicitud_datos_motor'
      };
    }
    
    // === Consulta de calibre por corriente ===
    if (/calibre|conductor|awg/i.test(input) && /\d+\s*A/i.test(input)) {
      const match = input.match(/(\d+)\s*A/i);
      if (match) {
        const corriente = parseInt(match[1]);
        const material = sesion.parametros?.material || 'cobre';
        
        const resultado = ConsultorTablas.consultarAmpacidad({
          corriente_requerida: corriente,
          material
        });
        
        return {
          respuesta_directa: `📐 Para ${corriente}A: calibre sugerido **${resultado.calibre} AWG** ${material} (THW, 30°C, sin agrupamiento)\n\n📚 Tabla 310-16 NOM-001-SEDE-2012`,
          detalles: resultado,
          modo: 'resultado_rapido'
        };
      }
    }
    
    // === Consulta de puesta a tierra (CORREGIDO: Tabla 250-122 por interruptor) ===
    if (/puesta a tierra|tierra equipo/i.test(input) && /\d+\s*A/i.test(input)) {
      const match = input.match(/(\d+)\s*A/i);
      if (match) {
        const interruptor = parseInt(match[1]);
        const material = sesion.parametros?.material || 'cobre';
        
        const resultado = ConsultorTablas.consultarPuestaATierra({
          interruptor_A: interruptor,
          material
        });
        
        return {
          respuesta_directa: `⚡ Para interruptor de ${interruptor}A: conductor de puesta a tierra mínimo **${resultado.calibre} AWG** ${material}\n\n📚 Tabla 250-122 NOM-001-SEDE-2012\n\n⚠️ Regla crítica (Art. 250-122(B)): Si el conductor de fase se aumentó por caída de tensión, el de puesta a tierra también debe aumentarse en la misma proporción.`,
          detalles: resultado,
          modo: 'resultado_rapido'
        };
      }
    }
    
    // Fallback
    return {
      pregunta: "¿Qué dato específico necesita calcular? Ejemplos:\n• 'calibre para 50A'\n• 'puesta a tierra para interruptor 100A'\n• 'motor 50 HP 440V trifásico'\n• 'HVAC con 30A de placa'",
      modo: 'solicitud_dato_rapido'
    };
  }
  
  // ============================================
  // MODO COMPLETO (CORREGIDO CON AJUSTE POR CAÍDA)
  // ============================================
  
  /**
   * Modo completo: diálogo Baymax de 9+ parámetros
   * Incluye pregunta condicional sobre ajuste por caída de tensión
   */
  static async _modoCompleto(input, sesion) {
    // Verificar acceso por plan (solo Apex tiene diseño completo)
    const plan = sesion.usuario?.current_plan || 'apex';
    if (plan !== 'apex' && !PlanManager.checkFeatureAccess(plan, 'disenador')) {
      return {
        conclusion: PlanManager.getUpsellMessage('disenador', plan),
        modo: 'upgrade_required'
      };
    }
    
    // === PASO 1: Identificar qué parámetro falta ===
    // Primero los 9 parámetros base, luego el ajuste por caída (condicional)
    const faltantesBase = PARAMETROS_DISENO.filter(p => !sesion.parametros?.[p.key]);
    
    // Si ya tiene los 9 base, preguntar sobre ajuste por caída (si aplica)
    if (faltantesBase.length === 0 && !sesion.parametros?.ajuste_caida_preguntado) {
      // Guardar que ya se preguntó sobre ajuste
      let nuevaSesion = ContextManager.actualizarParametros(sesion, {
        ajuste_caida_preguntado: true
      });
      
      return {
        pregunta: PARAMETRO_AJUSTE_CAIDA.pregunta,
        ejemplo: PARAMETRO_AJUSTE_CAIDA.ejemplo,
        parametro_esperado: 'ajuste_caida_aplica',
        progreso: '9/9+1',
        modo: 'recopilacion_parametros',
        _sesion_actualizada: nuevaSesion
      };
    }
    
    // Si falta el ajuste por caída y el usuario responde
    if (sesion.parametros?.parametro_pendiente === 'ajuste_caida_aplica') {
      const valorLimpio = input.trim();
      
      if (PARAMETRO_AJUSTE_CAIDA.validacion(valorLimpio)) {
        const valorFinal = PARAMETRO_AJUSTE_CAIDA.transform(valorLimpio);
        
        const nuevaSesion = ContextManager.actualizarParametros(sesion, {
          ajuste_caida_aplica: valorFinal,
          parametro_pendiente: null
        });
        
        // Todos los parámetros listos → calcular
        return await this._calcularDisenoCompleto(nuevaSesion);
      } else {
        return {
          pregunta: `No entendí. ${PARAMETRO_AJUSTE_CAIDA.pregunta}\n${PARAMETRO_AJUSTE_CAIDA.ejemplo}`,
          parametro_esperado: 'ajuste_caida_aplica',
          progreso: '9/9+1',
          modo: 'solicitud_datos'
        };
      }
    }
    
    // Si faltan parámetros base, continuar con el flujo normal
    if (faltantesBase.length > 0) {
      const siguiente = faltantesBase[0];
      
      // Si el input del usuario parece una respuesta a la pregunta actual
      if (sesion.parametros?.parametro_pendiente === siguiente.key) {
        const valorLimpio = input.trim();
        
        if (siguiente.validacion(valorLimpio)) {
          const valorFinal = siguiente.transform ? siguiente.transform(valorLimpio) : valorLimpio;
          
          let nuevaSesion = ContextManager.actualizarParametros(sesion, {
            [siguiente.key]: valorFinal,
            parametro_pendiente: null
          });
          
          if (siguiente.key === 'temperatura_ambiente' && typeof valorFinal === 'number') {
            nuevaSesion = ContextManager.actualizarParametros(nuevaSesion, {
              temperatura_ambiente: valorFinal
            });
          }
          
          return await this._modoCompleto("", nuevaSesion);
        } else {
          return {
            pregunta: `No entendí ese valor. ${siguiente.pregunta}\n${siguiente.ejemplo}`,
            parametro_esperado: siguiente.key,
            progreso: `${PARAMETROS_DISENO.length - faltantesBase.length}/${PARAMETROS_DISENO.length}`,
            modo: 'solicitud_datos'
          };
        }
      }
      
      // Presentar la pregunta actual
      return {
        pregunta: `${siguiente.pregunta}\n${siguiente.ejemplo}${siguiente.nota ? `\n\n💡 ${siguiente.nota}` : ''}`,
        parametro_esperado: siguiente.key,
        progreso: `${PARAMETROS_DISENO.length - faltantesBase.length}/${PARAMETROS_DISENO.length}`,
        modo: 'recopilacion_parametros',
        _sesion_actualizada: ContextManager.actualizarParametros(sesion, {
          parametro_pendiente: siguiente.key
        })
      };
    }
    
    // Fallback de seguridad
    return await this._calcularDisenoCompleto(sesion);
  }
  
  // ============================================
  // CÁLCULO COMPLETO (CORREGIDO CON AJUSTE PROPORCIONAL)
  // ============================================
  
  /**
   * Calcula el diseño completo con los parámetros recopilados
   * Incluye ajuste proporcional por caída de tensión en puesta a tierra (Art. 250-122(B))
   */
  static async _calcularDisenoCompleto(sesion) {
    const p = sesion.parametros;
    
    try {
      // === CÁLCULO 1: Conductor de fase (Tabla 310-16 con factores) ===
      const resultadoFase = ConsultorTablas.consultarAmpacidad({
        corriente_requerida: parseFloat(p.corriente_requerida),
        material: p.material,
        tipo_aislamiento: p.tipo_aislamiento,
        temperatura_ambiente: parseFloat(p.temperatura_ambiente || 30),
        conductores_agrupados: parseInt(p.conductores_agrupados || 3)
      });
      
      // === CÁLCULO 2: Verificación de caída de tensión ===
      let resultadoCaida = null;
      let factorAjusteCaida = 1.0;
      
      if (p.longitud_m && resultadoFase.calibre) {
        const seccion_mm2 = CalibreConverter.a_mm2(resultadoFase.calibre);
        if (seccion_mm2) {
          const rho = p.material === 'cobre' ? 0.01724 : 0.0282;
          const tension = parseFloat(p.tension_v);
          const corriente = parseFloat(p.corriente_requerida);
          const longitud = parseFloat(p.longitud_m);
          
          const deltaV = (2 * longitud * corriente * rho) / seccion_mm2;
          const porcentaje = (deltaV / tension) * 100;
          
          resultadoCaida = {
            calculada_v: parseFloat(deltaV.toFixed(2)),
            calculada_percent: parseFloat(porcentaje.toFixed(2)),
            limite_recomendado: 3,
            cumple: porcentaje <= 3,
            nota: porcentaje > 3 
              ? "⚠️ Excede 3%. Considere aumentar calibre o reducir longitud." 
              : "✅ Cumple límite recomendado de 3%"
          };
          
          // Calcular factor de ajuste si excede 3% (para posible uso en puesta a tierra)
          if (!resultadoCaida.cumple) {
            // Factor proporcional: sección ajustada / sección base
            const seccionBase = CalibreConverter.a_mm2(resultadoFase.calibre);
            // Estimar sección necesaria para cumplir 3%
            const seccionRequerida = (2 * longitud * corriente * rho) / (tension * 0.03);
            factorAjusteCaida = seccionRequerida / seccionBase;
          }
        }
      }
      
      // === CÁLCULO 3: Conductor de puesta a tierra (Tabla 250-122 por interruptor) ===
      const resultadoPAT = ConsultorTablas.consultarPuestaATierra({
        interruptor_A: parseInt(p.interruptor_A),
        material: p.material
      });
      
      // === CÁLCULO 4: Ajuste proporcional por caída de tensión (Art. 250-122(B)) ===
      let patAjustado = null;
      let notaAjusteCaida = null;
      
      // Solo aplicar ajuste si:
      // 1. Hubo caída de tensión que excede 3% (o usuario confirmó ajuste manualmente)
      // 2. El usuario confirmó que los conductores de fase fueron aumentados
      if ((resultadoCaida && !resultadoCaida.cumple) || p.ajuste_caida_aplica === true) {
        const factor = p.ajuste_caida_aplica === true ? factorAjusteCaida : 1.0;
        
        if (factor > 1.0) {
          patAjustado = CalibreConverter.ajustarPorFactor(resultadoPAT.calibre, factor);
          notaAjusteCaida = `Ajustado por caída de tensión (factor ${factor.toFixed(2)}x) según Art. 250-122(B)`;
        }
      }
      
      // === CÁLCULO 5: Cálculos específicos por tipo de carga ===
      let resultadosEspeciales = {};
      
      if (p.tipo_carga === 'motor' && p.corriente_requerida) {
        const corrienteMotor = parseFloat(p.corriente_requerida);
        resultadosEspeciales.motor = {
          proteccion_termica: parseFloat((corrienteMotor * 1.25).toFixed(1)),
          proteccion_magnetica: parseFloat((corrienteMotor * 2.5).toFixed(1)),
          nota: "Art. 430-52: protección magnética puede ser hasta 250% para permitir arranque"
        };
      }
      
      if (p.tipo_carga === 'hvac' && p.corriente_placa_hvac) {
        const hvacResult = ConsultorTablas.consultarHVAC({ 
          corriente_placa: p.corriente_placa_hvac, 
          material: p.material 
        });
        resultadosEspeciales.hvac = hvacResult;
      }
      
      if (p.tipo_carga === 'soldadora' && p.corriente_primaria_soldadora) {
        const soldadoraResult = ConsultorTablas.consultarSoldadora({ 
          tipo: p.tipo_soldadora || 'arco', 
          corriente_primaria: p.corriente_primaria_soldadora,
          ciclo_trabajo: p.ciclo_trabajo || 0.5,
          material: p.material 
        });
        resultadosEspeciales.soldadora = soldadoraResult;
      }
      
      // === ENSAMBLAR RESPUESTA COMPLETA ===
      const resumen = this._generarResumenEjecutivo({
        conductor_fase: resultadoFase,
        puesta_a_tierra: resultadoPAT,
        puesta_a_tierra_ajustada: patAjustado,
        nota_ajuste_caida: notaAjusteCaida,
        caida_tension: resultadoCaida,
        especiales: resultadosEspeciales,
        parametros: p
      });
      
      // Limpiar parámetros temporales de la sesión
      let sesionLimpia = { ...sesion };
      delete sesionLimpia.parametros.parametro_pendiente;
      delete sesionLimpia.parametros.modo_diseno_confirmado;
      delete sesionLimpia.parametros.modo_diseno_rapido;
      delete sesionLimpia.parametros.ajuste_caida_preguntado;
      
      return {
        respuesta_directa: resumen,
        resultados_completos: {
          conductor_fase: resultadoFase,
          puesta_a_tierra: resultadoPAT,
          puesta_a_tierra_ajustada: patAjustado,
          caida_tension: resultadoCaida,
          especiales: resultadosEspeciales
        },
        fundamento: {
          norma: "NOM-001-SEDE-2012",
          articulos_aplicados: ["210-19(a)", "240-4", "240-6", "250-122", "250-122(B)", "310-16", "310-15(b)(3)(a)", "310-19"],
          version: "2012"
        },
        pregunta_baymax: "¿Está satisfecho con este diseño o desea ajustar algún parámetro?",
        opciones: ["Sí, está correcto", "No, quiero modificar un dato", "Generar reporte PDF"],
        modo: 'resultado_completo',
        _sesion_actualizada: sesionLimpia
      };
      
    } catch (error) {
      console.error('[Diseñador] Error en cálculo:', error);
      return {
        conclusion: `❌ Error en cálculo: ${error.message}`,
        modo: 'error',
        sugerencia: "Verifique que todos los parámetros sean válidos o contacte soporte."
      };
    }
  }
  
  // ============================================
  // GENERADOR DE RESUMEN EJECUTIVO (CORREGIDO)
  // ============================================
  
  /**
   * Genera resumen ejecutivo en formato legible
   * Incluye cita explícita de Tabla 250-122 y regla de ajuste por caída
   */
  static _generarResumenEjecutivo(resultados) {
    const r = resultados;
    const p = resultados.parametros;
    
    const lineas = [
      `📋 **RESUMEN DE DISEÑO** - NOM-001-SEDE-2012`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚡ **Circuito**: ${p.tension_v}V, ${p.corriente_requerida}A, ${p.tipo_carga}`,
      `🔌 **Conductor de fase**: ${r.conductor_fase.calibre} AWG ${p.material} (${r.conductor_fase.ampacidad_ajustada}A ajustados)`,
      `   • Temperatura: ${p.temperatura_ambiente || 30}°C (factor ${r.conductor_fase.factores_aplicados?.temperatura?.factor || 1.00})`,
      `   • Agrupamiento: ${p.conductores_agrupados || 3} conductores (factor ${r.conductor_fase.factores_aplicados?.agrupamiento?.factor || 1.00})`,
      ``,
      // PUESTA A TIERRA - CORREGIDO: citar Tabla 250-122 por interruptor
      `⚡ **Puesta a tierra**: ${r.puesta_a_tierra.calibre} AWG ${p.material} (por interruptor ${p.interruptor_A}A)`,
      `   • Según Tabla 250-122 NOM-001-SEDE-2012`,
      r.puesta_a_tierra_ajustada ? `   • ⚠️ Ajustado por caída de tensión: ${r.puesta_a_tierra_ajustada} AWG (${r.nota_ajuste_caida})` : '',
      ``,
      r.caida_tension ? `⚡ **Caída de tensión**: ${r.caida_tension.calculada_percent}% ${r.caida_tension.cumple ? '✅' : '⚠️'}\n   • ${r.caida_tension.nota}` : '',
      ``,
    ];
    
    // Agregar sección especial por tipo de carga
    if (r.especiales?.motor) {
      lineas.push(`🛡️ **Protección del motor**:`);
      lineas.push(`   • Térmica: ${r.especiales.motor.proteccion_termica} A (125%)`);
      lineas.push(`   • Magnética: ${r.especiales.motor.proteccion_magnetica} A (250%)`);
      lineas.push(`   • ${r.especiales.motor.nota}`);
    }
    
    if (r.especiales?.hvac) {
      lineas.push(`❄️ **HVAC**:`);
      lineas.push(`   • Conductor mínimo: ${r.especiales.hvac.corriente_conductor_minima}A (125% de placa)`);
      lineas.push(`   • Protección: ${r.especiales.hvac.proteccion_comercial_sugerida_175}A (175%) o ${r.especiales.hvac.proteccion_comercial_sugerida_225}A (225% excepción)`);
    }
    
    if (r.especiales?.soldadora) {
      lineas.push(`⚡ **Soldadora ${r.especiales.soldadora.tipo}**:`);
      lineas.push(`   • Conductor: ${r.especiales.soldadora.corriente_conductor}A (factor ${r.especiales.soldadora.conductor_factor})`);
      lineas.push(`   • Protección: ${r.especiales.soldadora.proteccion_comercial_sugerida}A (${r.especiales.soldadora.proteccion_factor}×)`);
    }
    
    lineas.push(``);
    lineas.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const cumpleFase = r.conductor_fase.cumple_despues_ajustes !== false;
    const cumpleCaida = !r.caida_tension || r.caida_tension.cumple;
    
    lineas.push(cumpleFase && cumpleCaida
      ? `🎯 **Diseño conforme con norma**`
      : `⚠️ **Revisar observaciones arriba**`);
    
    // Recordatorio final de regla crítica
    lineas.push(``);
    lineas.push(`💡 **Regla crítica**: El conductor de puesta a tierra se determina por la capacidad del INTERRUPTOR (Tabla 250-122), NO por el calibre del conductor de fase. Si el conductor de fase se aumentó por caída de tensión, el de puesta a tierra también debe aumentarse proporcionalmente (Art. 250-122(B)).`);
    
    return lineas.filter(l => l && l.trim()).join('\n');
  }
}