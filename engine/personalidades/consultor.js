/**
 * @file engine/personalidades/consultor.js
 * @description Personalidad CONSULTOR - Responde preguntas específicas
 * @version 2.3 - Corregido: proteccion_termica como valor directo (no objeto)
 */

import { ConsultorTablas } from '../consultor-tablas.js';
import { CalibreConverter } from '../../utils/conversion-calibres.js';
import { extraerCorriente, extraerCalibreAWG } from '../extractores.js';
import { PlanManager } from '../../utils/feature-flags.js';
import { ContextManager } from '../context-manager.js';

// ============================================
// FUNCIONES AUXILIARES PRIVADAS
// ============================================

/**
 * Limpia el input de frases comunes
 */
const limpiarInput = (texto) => {
  return texto
    .replace(/^(tengo un|necesito un|quiero un|me falta un|dame el|calcular el|para un|tengo una|necesito una)\s*/i, '')
    .trim();
};

/**
 * Extrae el ciclo de trabajo de un texto
 * @param {string} texto - Texto del usuario
 * @returns {number|null} Ciclo de trabajo (0.1 a 1.0) o null
 */
const extraerCicloTrabajo = (texto) => {
  const matchPorcentaje = texto.match(/(\d+(?:\.\d+)?)\s*%/);
  if (matchPorcentaje) {
    return parseFloat(matchPorcentaje[1]) / 100;
  }
  
  const matchDecimal = texto.match(/\b(0\.[1-9]|0\.[1-9][0-9]?|0\.[1-9][0-9]?[0-9]?)\b/);
  if (matchDecimal) {
    return parseFloat(matchDecimal[1]);
  }
  
  return null;
};

/**
 * Extrae HP de un texto
 */
const extraerHP = (texto) => {
  const match = texto.match(/(\d+(?:\.\d+)?)\s*(?:HP|Hp|hp|caballos?)/i);
  return match ? parseFloat(match[1]) : null;
};

/**
 * Extrae tensión de un texto
 */
const extraerTension = (texto) => {
  const match = texto.match(/(\d+)\s*(?:V|volt|voltios|volts)/i);
  return match ? parseInt(match[1]) : null;
};

/**
 * Extrae fases de un texto
 */
const extraerFases = (texto) => {
  if (/trifasico|trifásica|3 fases|3f|3 ph|3\s*fases|trifásico|3$/i.test(texto)) return 3;
  if (/monofasico|monofásica|1 fase|1f|1 ph|monofásico|1$/i.test(texto)) return 1;
  return null;
};

// ============================================
// CLASE CONSULTOR
// ============================================

export class Consultor {
  
  static async ejecutar(input, sesion) {
    // Limpiar input de frases comunes
    const inputLimpio = limpiarInput(input);
    const texto = inputLimpio.toLowerCase().trim();
    
    // ========== PRIORIDAD ALTA: PUESTA A TIERRA ==========
    if (/puesta a tierra|conductor de tierra|tierra fisica|tierra física/i.test(texto) ||
        (texto.includes('interruptor') && /\d+\s*a/.test(texto) && !texto.includes('motor') && !texto.includes('hvac') && !texto.includes('soldadora'))) {
      return await this._consultarPuestaATierra(inputLimpio, sesion);
    }
    
    // ========== DETECCIÓN DE HVAC (Art. 440) ==========
    if (/(hvac|aire acondicionado|condensadora|compresor|unidad condensadora|refrigeracion|minisplit|central de aire)/i.test(texto)) {
      return await this._consultarHVAC(inputLimpio, sesion);
    }
    
    // ========== DETECCIÓN DE SOLDADORAS (Art. 630) ==========
    if (/(soldadora|welder|arco|resistencia|punto|costura|proyeccion|soldar|soldadura)/i.test(texto)) {
      return await this._consultarSoldadora(inputLimpio, sesion);
    }
    
    // ========== CONSULTA DE MOTOR (Art. 430) ==========
    if (/motor|hp|caballos/i.test(texto)) {
      return await this._consultarMotor(inputLimpio, sesion);
    }
    
    // ========== CONSULTA GENÉRICA DE CALIBRE POR CORRIENTE ==========
    const corriente = extraerCorriente(inputLimpio);
    if (corriente && (texto.includes('calibre') || texto.includes('conductor') || texto.includes('para'))) {
      return await this._consultarCalibreBase(corriente, sesion);
    }
    
    // ========== FALLBACK: PREGUNTAR QUÉ NECESITA ==========
    return {
      pregunta: "¿Podrías especificar qué dato necesitas? Ejemplos:\n" +
        "   • 'calibre para 50A'\n" +
        "   • 'motor 50 HP 440V trifásico'\n" +
        "   • 'puesta a tierra para interruptor 100A'\n" +
        "   • 'HVAC con 30A de placa'\n" +
        "   • 'soldadora de arco 50A'",
      modo: 'clarificacion'
    };
  }
  
  // ============================================
  // PUESTA A TIERRA (Tabla 250-122)
  // ============================================
  
  /**
   * Consulta específica para puesta a tierra (Tabla 250-122)
   */
  static async _consultarPuestaATierra(input, sesion) {
    const amperaje = extraerCorriente(input);
    
    if (!amperaje) {
      return {
        pregunta: "Para el conductor de puesta a tierra, necesito la capacidad del interruptor. ¿De cuántos amperes es?",
        ejemplo: "Ejemplo: 'puesta a tierra para interruptor 100A' o 'interruptor de 40A'",
        modo: 'solicitud_datos'
      };
    }
    
    const material = sesion.parametros?.material || 'cobre';
    const resultado = ConsultorTablas.consultarPuestaATierra({
      interruptor_A: amperaje,
      material: material
    });
    
    if (resultado.error) {
      return {
        conclusion: `❌ Error: ${resultado.error}`,
        modo: 'error'
      };
    }
    
    return {
      respuesta_directa: `Para un interruptor de ${amperaje}A:
• Conductor de puesta a tierra mínimo: ${resultado.calibre} AWG ${material}
• Según Tabla 250-122 NOM-001-SEDE-2012
• Nota: Si el conductor de fase se aumentó por caída de tensión, el de puesta a tierra también debe aumentarse proporcionalmente (Art. 250-122(B))`,
      detalles: resultado,
      fundamento: resultado.fundamento,
      modo: 'resultado'
    };
  }
  
  // ============================================
  // HVAC (Art. 440)
  // ============================================
  
  /**
   * Consulta específica para HVAC (Art. 440)
   */
  static async _consultarHVAC(input, sesion) {
    const plan = sesion.usuario?.current_plan || 'apex';
    const tieneAccesoHVAC = PlanManager.checkFeatureAccess(plan, 'hvac');
    
    if (!tieneAccesoHVAC && plan !== 'apex') {
      return {
        conclusion: PlanManager.getUpsellMessage('hvac', plan),
        modo: 'upgrade_required'
      };
    }
    
    let corriente_placa = extraerCorriente(input);
    if (!corriente_placa && sesion.parametros?.corriente_placa_hvac) {
      corriente_placa = sesion.parametros.corriente_placa_hvac;
    }
    
    if (!corriente_placa) {
      const nuevaSesion = ContextManager.guardarContextoPendiente(sesion, {
        tipo: 'hvac',
        paso_actual: 'corriente_placa'
      });
      
      return {
        pregunta: "Para calcular HVAC según Art. 440, necesito la corriente nominal de placa (MCA) que indica la etiqueta del equipo. ¿Me la indica?",
        ejemplo: "Ejemplo: '30A' o 'corriente de placa 25A'",
        modo: 'solicitud_datos_hvac',
        _sesion_actualizada: nuevaSesion
      };
    }
    
    const material = sesion.parametros?.material || 'cobre';
    const resultado = ConsultorTablas.consultarHVAC({ corriente_placa, material });
    
    if (resultado.error) {
      return { conclusion: `❌ ${resultado.error}`, modo: 'error' };
    }
    
    let calibre = '?';
    try {
      const amp = ConsultorTablas.consultarAmpacidad({ corriente_requerida: resultado.corriente_conductor_minima, material });
      calibre = amp.calibre;
    } catch (e) {
      calibre = '8 (estimado)';
    }
    
    return {
      respuesta_directa: `❄️ HVAC con corriente de placa ${corriente_placa}A:
• Conductor mínimo: ${resultado.corriente_conductor_minima}A (125% según Art. 440-32)
• Calibre sugerido: ${calibre} AWG ${material}
• Protección: ${resultado.proteccion_comercial_sugerida_175}A (175%) o ${resultado.proteccion_comercial_sugerida_225}A (225% excepción)`,
      detalles: resultado,
      fundamento: resultado.fundamento,
      modo: 'resultado_hvac'
    };
  }
  
  // ============================================
  // SOLDADORAS (Art. 630)
  // ============================================
  
  /**
   * Consulta específica para Soldadoras (Art. 630)
   */
  static async _consultarSoldadora(input, sesion) {
    const plan = sesion.usuario?.current_plan || 'apex';
    const tieneAccesoSoldadoras = PlanManager.checkFeatureAccess(plan, 'soldadoras');
    
    if (!tieneAccesoSoldadoras && plan !== 'apex') {
      return {
        conclusion: PlanManager.getUpsellMessage('soldadoras', plan),
        modo: 'upgrade_required'
      };
    }
    
    const texto = input.toLowerCase();
    const tipo = /resistencia|punto|costura|proyeccion|spot/i.test(texto) ? 'resistencia' : 'arco';
    
    let corriente_primaria = extraerCorriente(input);
    if (!corriente_primaria && sesion.parametros?.corriente_primaria_soldadora) {
      corriente_primaria = sesion.parametros.corriente_primaria_soldadora;
    }
    
    if (!corriente_primaria) {
      const nuevaSesion = ContextManager.guardarContextoPendiente(sesion, {
        tipo: 'soldadora',
        paso_actual: 'corriente_primaria',
        tipo_soldadora: tipo
      });
      
      return {
        pregunta: `Para calcular soldadora ${tipo} según Art. 630, necesito la corriente primaria nominal. ¿Me la indica?`,
        ejemplo: "Ejemplo: 'soldadora de arco 50A'",
        modo: 'solicitud_datos_soldadora',
        _sesion_actualizada: nuevaSesion
      };
    }
    
    let ciclo_trabajo = null;
    if (tipo === 'resistencia') {
      ciclo_trabajo = extraerCicloTrabajo(input);
      if (!ciclo_trabajo && sesion.parametros?.ciclo_trabajo) {
        ciclo_trabajo = sesion.parametros.ciclo_trabajo;
      }
      
      if (!ciclo_trabajo) {
        const nuevaSesion = ContextManager.guardarContextoPendiente(sesion, {
          tipo: 'soldadora',
          paso_actual: 'ciclo_trabajo',
          tipo_soldadora: tipo,
          corriente_primaria: corriente_primaria
        });
        
        return {
          pregunta: "¿Cuál es el ciclo de trabajo de la soldadora? (ej: 40%, 0.4)",
          ejemplo: "Manual=20%, semi-automático=40%, automático=60%, continuo=100%",
          modo: 'solicitud_ciclo_trabajo',
          _sesion_actualizada: nuevaSesion
        };
      }
    }
    
    const material = sesion.parametros?.material || 'cobre';
    const resultado = ConsultorTablas.consultarSoldadora({ tipo, corriente_primaria, ciclo_trabajo, material });
    
    if (resultado.error) {
      return { conclusion: `❌ ${resultado.error}`, modo: 'error' };
    }
    
    let calibre = '?';
    try {
      const amp = ConsultorTablas.consultarAmpacidad({ corriente_requerida: resultado.corriente_conductor, material });
      calibre = amp.calibre;
    } catch (e) {
      calibre = '8 (estimado)';
    }
    
    let respuesta = `⚡ Soldadora ${tipo}:
• Corriente primaria: ${corriente_primaria}A
• Conductor: ${resultado.corriente_conductor.toFixed(1)}A (factor ${resultado.conductor_factor})
• Calibre sugerido: ${calibre} AWG ${material}
• Protección: ${resultado.proteccion_comercial_sugerida}A (${resultado.proteccion_factor}× según Art. 630)`;
    
    if (tipo === 'resistencia' && resultado.ciclo_trabajo) {
      respuesta += `\n• Ciclo de trabajo aplicado: ${(resultado.ciclo_trabajo * 100)}%`;
    }
    
    return {
      respuesta_directa: respuesta,
      detalles: resultado,
      fundamento: resultado.fundamento,
      modo: 'resultado_soldadora'
    };
  }
  
  // ============================================
  // CALIBRE POR CORRIENTE (Tabla 310-16)
  // ============================================
  
  /**
   * Consulta genérica de calibre por corriente (Tabla 310-16)
   */
  static async _consultarCalibreBase(corriente, sesion) {
    const material = sesion.parametros?.material || 'cobre';
    
    try {
      const resultado = ConsultorTablas.consultarAmpacidad({ 
        corriente_requerida: corriente, 
        material 
      });
      
      return {
        respuesta_directa: `Para ${corriente}A: calibre sugerido ${resultado.calibre} AWG ${material} (THW, 30°C, sin agrupamiento)`,
        detalles: resultado,
        opcion_precision: "¿Desea ajustar por temperatura ambiente, agrupamiento o verificar caída de tensión?",
        fundamento: "Tabla 310-16 NOM-001-SEDE-2012",
        modo: 'resultado_con_opcion'
      };
    } catch (error) {
      return {
        respuesta_directa: `Para ${corriente}A: calibre estimado 8 AWG ${material}`,
        nota: "Cálculo preciso requiere tipo de conductor y condiciones de instalación",
        modo: 'resultado_estimado'
      };
    }
  }
  
  // ============================================
  // MOTORES (Art. 430)
  // ============================================
  
  /**
   * Consulta para motores (Art. 430) - CORREGIDO
   */
  static async _consultarMotor(input, sesion) {
    // Extraer datos del input
    let hp = extraerHP(input);
    let tension = extraerTension(input);
    let fases = extraerFases(input);
    
    // Usar datos de sesión si están disponibles
    if (!hp && sesion.parametros?.motor_hp) hp = sesion.parametros.motor_hp;
    if (!tension && sesion.parametros?.motor_tension) tension = sesion.parametros.motor_tension;
    if (!fases && sesion.parametros?.motor_fases) fases = sesion.parametros.motor_fases;
    
    // Caso 1: Datos completos - calcular
    if (hp && tension && fases) {
      const resultado = ConsultorTablas.consultarMotor({ hp, tension_v: tension, fases });
      
      if (resultado.error) {
        return { conclusion: `❌ ${resultado.error}`, modo: 'error' };
      }
      
      const ampacidad = ConsultorTablas.consultarAmpacidad({
        corriente_requerida: resultado.corriente_placa
      });
      
      // Limpiar parámetros temporales
      let nuevaSesion = sesion;
      if (sesion.parametros) {
        delete sesion.parametros.motor_hp;
        delete sesion.parametros.motor_tension;
        delete sesion.parametros.motor_fases;
      }
      
      return {
        respuesta_directa: `📊 MOTOR ${resultado.hp} HP, ${resultado.tension}V, ${resultado.fases} fases:
• Corriente a placa: ${resultado.corriente_placa} A
• Protección térmica: ${resultado.proteccion_termica} A (125% según Art. 430-22)
• Protección magnética: ${resultado.proteccion_magnetica} A (250% según Art. 430-52)
• Conductor sugerido: ${ampacidad.calibre} AWG (cobre, THW)

📚 Fundamento: Tabla 430-250 NOM-001-SEDE-2012`,
        modo: 'resultado',
        _sesion_actualizada: nuevaSesion
      };
    }
    
    // Caso 2: Datos parciales - guardar contexto y preguntar
    let nuevaSesion = sesion;
    let pregunta = "Para calcular motor según Art. 430, necesito:";
    
    if (!hp) {
      pregunta += "\n• Caballos de fuerza (HP)";
    } else if (!tension) {
      pregunta += "\n• Tensión nominal (V) - ej: 220V, 440V, 480V";
      nuevaSesion = ContextManager.actualizarParametros(sesion, { motor_hp: hp });
    } else if (!fases) {
      pregunta += "\n• Tipo: monofásico (1) o trifásico (3)";
      nuevaSesion = ContextManager.actualizarParametros(sesion, { 
        motor_hp: hp, 
        motor_tension: tension 
      });
    }
    
    return {
      pregunta: pregunta,
      ejemplo: "Ejemplo: 'motor 50 HP 440V trifásico'",
      modo: 'solicitud_datos_motor',
      _sesion_actualizada: nuevaSesion
    };
  }
}