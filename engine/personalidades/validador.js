/**
 * @file personalidades/validador.js
 * @description Personalidad VALIDADOR - Verifica si declaraciones cumplen la norma
 * @version 2.0 - Corregido: eliminada pregunta automática de ajuste por caída
 */

import { ConsultorTablas } from '../consultor-tablas.js';
import { CalibreConverter } from '../../utils/conversion-calibres.js';
import { extraerDatosValidacion, esPuestaATierra } from '../extractores.js';
import { ContextManager } from '../context-manager.js';

/**
 * Orden de AWG para comparación (menor índice = menor calibre)
 */
const AWG_ORDER = ['18', '16','14', '12', '10', '8', '6', '4', '3', '2', '1', '1/0', '2/0', '3/0', '4/0'];

/**
 * Compara dos calibres AWG
 * @returns {number} -1 si a < b, 0 si igual, 1 si a > b
 */
const compararAWG = (a, b) => {
  const idxA = AWG_ORDER.indexOf(a);
  const idxB = AWG_ORDER.indexOf(b);
  if (idxA === -1 || idxB === -1) return 0;
  if (idxA < idxB) return -1;
  if (idxA > idxB) return 1;
  return 0;
};

/**
 * Formatea un calibre para display
 */
const formatearCalibre = (calibre) => {
  if (!calibre) return '?';
  if (calibre.includes('kcmil')) return calibre.toUpperCase();
  if (calibre.includes('/')) return calibre; // ← Mantener 1/0, 2/0, etc.
  return `${calibre} AWG`;
};

export class Validador {
  
  /**
   * Ejecuta la validación de una declaración
   * @param {string} input - Texto del usuario
   * @param {Object} sesion - Estado de la sesión
   * @returns {Promise<Object>} Respuesta de validación
   */
  static async ejecutar(input, sesion) {
    const { calibre: calibreValor, interruptor: interruptorValor, esPuestaATierra: esPuesta } = extraerDatosValidacion(input);
    
    // Validar presencia de calibre
    if (!calibreValor) {
      return {
        conclusion: "⚠️ No identifiqué un calibre AWG/kcmil en tu declaración",
        siguiente_paso: "Por favor, indica el calibre (ej: '8 AWG', '1/0 AWG', '250kcmil')",
        ejemplo: "Ejemplo: 'Mi puesta a tierra es 10 AWG con interruptor de 40A'",
        modo: 'solicitud_datos'
      };
    }
    
    const calibreDisplay = formatearCalibre(calibreValor);
    const esPuestaConfirmado = esPuesta || esPuestaATierra(input);
    
    if (esPuestaConfirmado) {
      return await this._validarPuestaATierra(input, sesion, calibreValor, calibreDisplay, interruptorValor);
    }
    
    // Validación genérica
    return {
      conclusion: "🔍 Validación en proceso...",
      nota: "Para validación específica de puesta a tierra, incluye: calibre declarado y capacidad del interruptor",
      modo: 'solicitud_contexto',
      ejemplo: "Ejemplo: 'Mi puesta a tierra es 10 AWG con interruptor de 40A, ¿está bien?'"
    };
  }
  
  /**
   * Validación específica para puesta a tierra (Tabla 250-122)
   * CORREGIDO: Ya no pregunta automáticamente por ajuste de caída
   */
  static async _validarPuestaATierra(input, sesion, calibreValor, calibreDisplay, interruptorValor) {
    // Buscar interruptor en input o sesión
    let interruptor = interruptorValor;
    if (!interruptor && sesion.parametros?.interruptor_A) {
      interruptor = sesion.parametros.interruptor_A;
    }
    
    // Si no hay interruptor, guardar contexto pendiente
    if (!interruptor) {
      const nuevaSesion = ContextManager.guardarContextoPendiente(sesion, {
        tipo: 'puesta_a_tierra',
        calibre_declarado: calibreDisplay,
        calibre_valor: calibreValor,
        datos_faltantes: ['interruptor_A']
      });
      
      return {
        conclusion: `🔍 Validando ${calibreDisplay} para puesta a tierra...`,
        datos_faltantes: ["capacidad del interruptor automático (en Amperes)"],
        pregunta: "¿De qué capacidad es el interruptor que protege este circuito? (ej: 40A, 100A)",
        modo: 'solicitud_datos',
        contexto: { calibre_declarado: calibreDisplay, tipo: 'puesta_a_tierra' },
        ejemplo: "Responde algo como: 'El interruptor es de 40A'",
        _sesion_actualizada: nuevaSesion
      };
    }
    
    // Consultar Tabla 250-122
    const material = sesion.parametros?.material || 'cobre';
    const resultado = ConsultorTablas.consultarPuestaATierra({
      interruptor_A: interruptor,
      material: material
    });
    
    if (resultado?.error) {
      return {
        conclusion: `❌ Error en consulta: ${resultado.error}`,
        modo: 'error',
        siguiente_paso: "Verifica que el amperaje del interruptor sea válido (15-6000A)"
      };
    }
    
    const calibreMinimoValor = resultado.calibre;
    const calibreMinimoDisplay = formatearCalibre(calibreMinimoValor);
    
    // Comparar calibres
    const comparacion = compararAWG(calibreValor, calibreMinimoValor);
    const cumple = comparacion >= 0;
    
    // ========== CORRECCIÓN: Ya no pregunta por ajuste automáticamente ==========
    // El ajuste por caída de tensión es un caso avanzado que el usuario debe solicitar explícitamente
    // Por ahora, validación simple y directa
    
    if (cumple) {
      return {
        conclusion: `✅ CORRECTO: ${calibreDisplay} cumple con Tabla 250-122 para interruptor ${interruptor}A (mínimo requerido: ${calibreMinimoDisplay})`,
        calibre_declarado: calibreDisplay,
        calibre_minimo_requerido: calibreMinimoDisplay,
        interruptor_aplicado: interruptor,
        fundamento: resultado.fundamento,
        nivel_confianza: 0.95,
        siguiente_paso: "¿Deseas validar otro componente?",
        modo: 'resultado'
      };
    }
    
    // No cumple
    return {
      conclusion: `❌ INCORRECTO: Se requiere mínimo ${calibreMinimoDisplay} según Tabla 250-122 (tienes ${calibreDisplay} para interruptor ${interruptor}A)`,
      calibre_declarado: calibreDisplay,
      calibre_minimo_requerido: calibreMinimoDisplay,
      interruptor_aplicado: interruptor,
      fundamento: resultado.fundamento,
      correccion_sugerida: `Reemplace el conductor de puesta a tierra por calibre ${calibreMinimoDisplay} o superior`,
      nivel_confianza: 0.95,
      siguiente_paso: "¿Necesitas validar otro componente?",
      modo: 'resultado'
    };
  }
  
  /**
   * Procesa la respuesta a la pregunta de ajuste por caída de tensión
   * (Mantenido para casos donde el usuario solicita explícitamente el ajuste)
   * @param {string} input - Respuesta del usuario (SI/NO)
   * @param {Object} sesion - Sesión con contexto pendiente
   * @returns {Promise<Object>}
   */
  static async procesarAjusteCaida(input, sesion) {
    const contexto = sesion.contexto_validacion_pendiente;
    if (!contexto || contexto.tipo !== 'ajuste_caida_tension') {
      return null;
    }
    
    const respuesta = input.toLowerCase().trim();
    const necesitaAjuste = /^(si|sí|yes|y)/i.test(respuesta);
    
    if (!necesitaAjuste) {
      // No necesita ajuste, validación completa
      let nuevaSesion = ContextManager.limpiarContextoPendiente(sesion);
      nuevaSesion = ContextManager.actualizarParametros(nuevaSesion, {
        respondio_ajuste_caida: true,
        ajuste_aplicado: false
      });
      
      return {
        respuesta: {
          conclusion: `✅ VALIDACIÓN COMPLETA: ${contexto.calibre_display} es correcto para interruptor ${contexto.interruptor}A.`,
          calibre_declarado: contexto.calibre_display,
          interruptor_aplicado: contexto.interruptor,
          modo: 'resultado'
        },
        sesion: nuevaSesion
      };
    }
    
    // Necesita ajuste - preguntar por el factor
    return {
      respuesta: {
        pregunta: "Para aplicar el ajuste proporcional del Art. 250-122(B), necesito: ¿cuál era el calibre ORIGINAL del conductor de fase (sin ajuste) y cuál es el NUEVO calibre instalado por caída de tensión?",
        ejemplo: "Ejemplo: 'Original 8 AWG, nuevo 4 AWG'",
        modo: 'solicitud_factor_ajuste'
      },
      sesion: sesion
    };
  }
  
  /**
   * Aplica el ajuste proporcional por caída de tensión
   * @param {string} input - "Original X AWG, nuevo Y AWG"
   * @param {Object} sesion - Sesión con contexto
   * @returns {Promise<Object>}
   */
  static async aplicarAjusteProporcional(input, sesion) {
    const contexto = sesion.contexto_validacion_pendiente;
    if (!contexto) return null;
    
    // Extraer calibres original y nuevo
    const calibres = input.match(/(\d+\/?\d*)\s*AWG/g);
    if (!calibres || calibres.length < 2) {
      return {
        respuesta: {
          pregunta: "No entendí los calibres. Por favor, indica: 'Original 8 AWG, nuevo 4 AWG'",
          modo: 'solicitud_factor_ajuste'
        },
        sesion
      };
    }
    
    const originalRaw = calibres[0].replace(' AWG', '');
    const nuevoRaw = calibres[1].replace(' AWG', '');
    
    const mm2Original = CalibreConverter.a_mm2(originalRaw);
    const mm2Nuevo = CalibreConverter.a_mm2(nuevoRaw);
    
    if (!mm2Original || !mm2Nuevo) {
      return {
        respuesta: {
          pregunta: "No pude convertir los calibres. Asegúrate de usar formatos válidos (8 AWG, 4 AWG, 1/0 AWG)",
          modo: 'solicitud_factor_ajuste'
        },
        sesion
      };
    }
    
    const factor = mm2Nuevo / mm2Original;
    const calibreBase = contexto.calibre_base;
    const calibreAjustado = CalibreConverter.ajustarPorFactor(calibreBase, factor);
    const calibreAjustadoDisplay = calibreAjustado.includes('kcmil') 
      ? calibreAjustado.toUpperCase() 
      : `${calibreAjustado} AWG`;
    const calibreDeclaradoDisplay = contexto.calibre_display;
    
    // Verificar si el calibre declarado cumple con el ajuste
    const mm2Declarado = CalibreConverter.a_mm2(contexto.calibre_valor);
    const mm2Ajustado = CalibreConverter.a_mm2(calibreAjustado);
    const cumpleAjuste = mm2Declarado >= mm2Ajustado;
    
    let nuevaSesion = ContextManager.limpiarContextoPendiente(sesion);
    nuevaSesion = ContextManager.actualizarParametros(nuevaSesion, {
      respondio_ajuste_caida: true,
      ajuste_aplicado: true,
      factor_ajuste: factor,
      calibre_ajustado: calibreAjustado,
      calibre_original_puesta_tierra: calibreBase,
      calibre_ajustado_puesta_tierra: calibreAjustado
    });
    
    if (cumpleAjuste) {
      return {
        respuesta: {
          conclusion: `✅ CORRECTO CON AJUSTE: ${contexto.calibre_display} cumple con Tabla 250-122 después de aplicar el ajuste proporcional por caída de tensión (factor ${factor.toFixed(2)}x). El mínimo requerido ajustado es ${calibreAjustadoDisplay}.`,
          calibre_declarado: calibreDeclaradoDisplay,
          calibre_minimo_requerido_ajustado: calibreAjustadoDisplay,
          factor_ajuste_aplicado: factor,
          fundamento: { norma: "NOM-001-SEDE-2012", articulo: "250-122(B)" },
          modo: 'resultado'
        },
        sesion: nuevaSesion
      };
    }
    
    return {
      respuesta: {
        conclusion: `❌ INCORRECTO CON AJUSTE: Con el ajuste por caída de tensión (factor ${factor.toFixed(2)}x), se requiere mínimo ${calibreAjustadoDisplay} según Art. 250-122(B). Tu calibre ${contexto.calibre_display} es insuficiente.`,
        calibre_declarado: calibreDeclaradoDisplay,
        calibre_minimo_requerido_ajustado: calibreAjustadoDisplay,
        factor_ajuste_aplicado: factor,
        correccion_sugerida: `Reemplace el conductor de puesta a tierra por calibre ${calibreAjustadoDisplay} o superior`,
        modo: 'resultado'
      },
      sesion: nuevaSesion
    };
  }
}