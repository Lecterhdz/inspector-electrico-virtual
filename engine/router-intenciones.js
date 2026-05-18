/**
 * @file engine/router-intenciones.js
 * @description Router principal del Inspector Eléctrico Virtual
 * @version 7.7 - Corregido: manejo de input vacío, prioridad DISEÑADOR, flujo de ajuste por caída
 */

import { Validador } from './personalidades/validador.js';
import { Consultor } from './personalidades/consultor.js';
import { Profesor } from './personalidades/profesor.js';
import { Disenador } from './personalidades/disenador.js';
import { ContextManager, sesionInicial } from './context-manager.js';
import { esPreguntaValidacion } from './extractores.js';
import { PlanManager, getUpsellMessage, PLANS } from '../utils/feature-flags.js';
import { ConsultorTablas } from './consultor-tablas.js';
import { CalibreConverter } from '../utils/conversion-calibres.js';

// Datos bancarios para upsell
const CUENTA_BANCARIA = {
  banco: 'BBVA México',
  titular: 'Inspector Eléctrico Virtual S.A. de C.V.',
  clabe: '012345678901234567',
  prefijo_ref: 'IEV-'
};

// ============================================
// EXTRACTORES MEJORADOS (dentro del archivo)
// ============================================

const extraerCalibreAWG = (texto) => {
  if (!texto) return null;
  const t = texto.trim().toUpperCase();
  
  let match = t.match(/\b(\d{1,3})\s*AWG\b/i);
  if (match) return match[1];
  
  match = t.match(/\b([1-4]\/0)\s*AWG\b/i);
  if (match) return match[1];
  
  match = t.match(/\b(14|12|10|8|6|4|3|2|1)\b(?!\s*[A-Z])/);
  if (match) return match[1];
  
  match = t.match(/\b(\d+)\s*KCMIL\b/i);
  if (match) return `${match[1]}kcmil`;
  
  match = t.match(/(?:calibre|conductor|tierra|puesta)\s*(?:es|de|:)?\s*(\d{1,3})\s*(?:AWG)?/i);
  if (match) return match[1];
  
  return null;
};

const extraerAmperajeInterruptor = (texto) => {
  if (!texto) return null;
  const t = texto.toLowerCase();
  
  let match = t.match(/interruptor\s+(?:es\s+)?(?:de\s+)?(\d+)\s*a/i);
  if (match) return parseInt(match[1]);
  
  match = t.match(/(?:protegido|con|usando)\s+(?:un\s+)?(?:interruptor\s+)?(?:de\s+)?(\d+)\s*a/i);
  if (match) return parseInt(match[1]);
  
  match = t.match(/\b(\d+)\s*a\b/i);
  if (match && !/motor|hp|caballos|watts|volt/i.test(t)) {
    return parseInt(match[1]);
  }
  
  match = t.match(/(\d+)\s*(?:amperes|amperios|amps)/i);
  if (match) return parseInt(match[1]);
  
  return null;
};

const esPuestaATierra = (texto) => {
  return /puesta a tierra|tierra equipo|conductor de tierra/i.test(texto);
};

const extraerDatosValidacion = (texto) => {
  return {
    calibre: extraerCalibreAWG(texto),
    interruptor: extraerAmperajeInterruptor(texto),
    esPuestaATierra: esPuestaATierra(texto)
  };
};

// ============================================
// ROUTER PRINCIPAL - VERSIÓN v7.7
// ============================================

export class RouterIntenciones {
  
  /**
   * Detecta la intención del usuario basado en el texto de entrada
   * @param {string} input - Texto del usuario
   * @returns {string|null} Personalidad detectada o null para decidir por sesión
   */
  static detectarIntencion(input) {
    // Si input es vacío o solo espacios, no detectar por texto (dejar que sesión decida)
    if (!input || input.trim() === '') {
      return null;
    }
    
    const texto = input.toLowerCase().trim();
    
    // === VALIDADOR - PRIORIDAD MÁXIMA ===
    if (esPuestaATierra(texto) && esPreguntaValidacion(texto)) return 'VALIDADOR';
    if (/(?:debe ser|es|tiene)\s+\d+\s*(?:awg|a)/i.test(texto) && esPreguntaValidacion(texto)) return 'VALIDADOR';
    if (/(?:awg|calibre|tierra).*?(?:est[áa] bien|es correcto|cumple|con la norma|válido)/i.test(texto)) return 'VALIDADOR';
    
    // === DISEÑADOR - PRIORIDAD ALTA (antes que CONSULTOR) ===
    // Frases que indican diseño/proyecto, no consulta puntual
    if (/^(tengo un|necesito un|quiero un|diseñar|dimensionar|proyecto de|circuito de)/i.test(texto)) {
      return 'DISEÑADOR';
    }
    // Patrones específicos de motor con datos
    if (/motor\s+de\s+\d+\s*hp|hp\s+trifásico|hp\s+monofásico/i.test(texto)) {
      return 'DISEÑADOR';
    }
    
    // === CONSULTOR - Consultas específicas de datos ===
    if (/(?:qu[eé] calibre|cu[aá]l es|necesito\s+calibre|recomienda\s+conductor|sugiere\s+awg)/i.test(texto)) {
      return 'CONSULTOR';
    }
    if (/para\s+\d+\s*a\s+(conductor|calibre|awg)/i.test(texto)) {
      return 'CONSULTOR';
    }
    
    // === PROFESOR - Preguntas educativas ===
    if (/(?:c[oó]mo se|explica|qu[eé] significa|por qu[eé]|fundamento|art[íi]culo|definici[óo]n)/i.test(texto)) {
      return 'PROFESOR';
    }
    
    // Default: CONSULTOR para consultas genéricas
    return 'CONSULTOR';
  }
  
  /**
   * Procesa la consulta del usuario y retorna la respuesta apropiada
   */
  static async procesar(inputUsuario, sesion = null) {
    if (!sesion) sesion = JSON.parse(JSON.stringify(sesionInicial));
    
    // === MODO DEMO: asignar plan APEX si no hay usuario ===
    if (!sesion.usuario) {
      sesion.usuario = {
        id: 'demo_user',
        current_plan: 'apex'
      };
    }
    
    // === 1. Resolver contexto pendiente primero ===
    const contextoResuelto = await this._resolverContextoPendiente(inputUsuario, sesion);
    if (contextoResuelto) return contextoResuelto;
    
    // En router-intenciones.js, dentro de procesar(), después de contexto pendiente:

    // === 2. Detectar intención (manejar input vacío) ===
    let intencion = this.detectarIntencion(inputUsuario);

    // === CORRECCIÓN CLAVE v7.9: Forzar DISEÑADOR si sesión está en modo completo ===
    // Verificar explícitamente que está en modo diseño completo (no rápido)
    const enModoDisenoCompleto = 
      sesion.parametros?.modo_diseno_confirmado === true && 
      sesion.parametros?.modo_diseno_rapido !== true;

    // Si input es vacío pero sesión está en modo diseño completo, forzar DISEÑADOR
    if ((!intencion || inputUsuario?.trim() === '') && enModoDisenoCompleto) {
      intencion = 'DISEÑADOR';
    }

    // Fallback por defecto
    if (!intencion) {
      intencion = 'CONSULTOR';
    }

    // === 3. Verificar acceso por plan ===
    const planBloqueo = this._verificarAccesoPlan(inputUsuario, sesion, intencion);
    if (planBloqueo) return planBloqueo;
    
    // === 4. Manejo de modo rápido en Diseñador ===
    if (intencion === 'DISEÑADOR' && sesion.parametros?.modo_diseno_rapido === true) {
      const resultado = await Consultor.ejecutar(inputUsuario, sesion);
      const sesionActualizada = ContextManager.registrarConsulta(sesion, inputUsuario, resultado);
      return { respuesta: resultado, sesion: sesionActualizada };
    }
    
    // === 5. Activar modo rápido si usuario selecciona "2" ===
    if (inputUsuario === '2' && sesion.personalidad_activa === 'DISEÑADOR') {
      sesion = ContextManager.actualizarParametros(sesion, { modo_diseno_rapido: true });
    }
    
    // === 6. Cambiar personalidad si es necesario ===
    if (sesion.personalidad_activa !== intencion) {
      sesion = ContextManager.cambiarPersonalidad(sesion, intencion, `Detectado: ${intencion}`);
    }
    
    // === 7. Enrutar a personalidad ===
    const resultado = await this._enrutarPersonalidad(inputUsuario, sesion, intencion);
    
    // === 8. Garantizar estructura mínima de respuesta ===
    const respuestaSegura = this._formatearRespuestaSegura(resultado.respuesta);
    
    // === 9. Registrar en historial y retornar ===
    const sesionActualizada = ContextManager.registrarConsulta(resultado.sesion, inputUsuario, respuestaSegura);
    return { respuesta: respuestaSegura, sesion: sesionActualizada };
  }
  
  /**
   * Resuelve flujos de contexto pendiente (validación, motor, ajuste por caída)
   */
  static async _resolverContextoPendiente(input, sesion) {
    if (!ContextManager.tieneValidacionPendiente(sesion)) return null;
  
    const ctx = sesion.contexto_validacion_pendiente;
  
    // CASO 1: Ajuste por caída (paso 1: SI/NO)
    if (ctx.tipo === 'ajuste_caida_tension' && /^(si|sí|yes|no|n|y)/i.test(input)) {
      const resultado = await Validador.procesarAjusteCaida(input, sesion);
      if (resultado) {
        const sesionActualizada = ContextManager.registrarConsulta(resultado.sesion, input, resultado.respuesta);
        return { respuesta: resultado.respuesta, sesion: sesionActualizada };
      }
    }
  
    // CASO 2: Ajuste por caída (paso 2: calibres AWG)
    if (ctx.tipo === 'ajuste_caida_tension' && /AWG/i.test(input)) {
      const resultado = await Validador.aplicarAjusteProporcional(input, sesion);
      if (resultado) {
        const sesionActualizada = ContextManager.registrarConsulta(resultado.sesion, input, resultado.respuesta);
        return { respuesta: resultado.respuesta, sesion: sesionActualizada };
      }
    }
  
    // CASO 3: Motor pendiente (recopilación de HP, tensión, fases)
    if (ctx.tipo === 'motor') {
      const valor = input.trim();
      
      if (ctx.paso_actual === 'hp') {
        const hp = parseFloat(valor);
        if (isNaN(hp)) {
          return {
            respuesta: { pregunta: "Por favor, ingresa los caballos de fuerza (HP) como número (ej: 50)", modo: 'solicitud_datos' },
            sesion
          };
        }
        let nuevaSesion = ContextManager.actualizarParametros(sesion, { motor_hp: hp });
        nuevaSesion.contexto_validacion_pendiente.paso_actual = 'tension';
        return {
          respuesta: { pregunta: "¿Cuál es la tensión nominal del motor? (ej: 220V, 440V, 480V)", modo: 'solicitud_datos' },
          sesion: nuevaSesion
        };
      }
      
      if (ctx.paso_actual === 'tension') {
        const tension = parseInt(valor);
        if (isNaN(tension)) {
          return {
            respuesta: { pregunta: "Por favor, ingresa la tensión en Voltios (ej: 440)", modo: 'solicitud_datos' },
            sesion
          };
        }
        let nuevaSesion = ContextManager.actualizarParametros(sesion, { motor_tension: tension });
        nuevaSesion.contexto_validacion_pendiente.paso_actual = 'fases';
        return {
          respuesta: { 
            pregunta: "¿El motor es monofásico (1) o trifásico (3)?",
            opciones: ["1 - Monofásico", "3 - Trifásico"],
            modo: 'solicitud_datos'
          },
          sesion: nuevaSesion
        };
      }
      
      if (ctx.paso_actual === 'fases') {
        const fases = parseInt(valor);
        if (fases !== 1 && fases !== 3) {
          return {
            respuesta: { pregunta: "Por favor, responde '1' para monofásico o '3' para trifásico", modo: 'solicitud_datos' },
            sesion
          };
        }
        let nuevaSesion = ContextManager.actualizarParametros(sesion, { motor_fases: fases });
        nuevaSesion = ContextManager.limpiarContextoPendiente(nuevaSesion);
        
        const resultado = ConsultorTablas.consultarMotor({
          hp: nuevaSesion.parametros.motor_hp,
          tension_v: nuevaSesion.parametros.motor_tension,
          fases: fases
        });
        
        const ampacidad = ConsultorTablas.consultarAmpacidad({
          corriente_requerida: resultado.corriente_placa
        });
        
        return {
          respuesta: {
            respuesta_directa: `📊 MOTOR ${resultado.hp} HP, ${resultado.tension}V, ${resultado.fases} fases:\n- Corriente a placa: ${resultado.corriente_placa} A\n- Protección térmica: ${resultado.proteccion_termica} A (125%)\n- Protección magnética: ${resultado.proteccion_magnetica} A (250%)\n- Conductor sugerido: ${ampacidad.calibre} AWG (cobre, THW)\n\n📚 Tabla 430-250 NOM-001-SEDE-2012`,
            modo: 'resultado'
          },
          sesion: nuevaSesion
        };
      }
    }

    // CASO 4: Puesta a tierra pendiente (solo faltaba interruptor)
    if (ctx.tipo === 'puesta_a_tierra') {
      const interruptorNuevo = extraerAmperajeInterruptor(input);
      
      if (!interruptorNuevo) {
        return {
          respuesta: {
            pregunta: "Para continuar con la validación, necesito la capacidad del interruptor. ¿De cuántos amperes es? (ej: 40A, 100A)",
            modo: 'solicitud_datos'
          },
          sesion
        };
      }
    
      const calibreValor = ctx.calibre_valor;
      const calibreDisplay = ctx.calibre_declarado;
      const material = sesion.parametros?.material || 'cobre';
    
      const resultado = ConsultorTablas.consultarPuestaATierra({
        interruptor_A: interruptorNuevo,
        material: material
      });
    
      if (resultado?.error) {
        return {
          respuesta: {
            conclusion: `❌ Error en consulta: ${resultado.error}`,
            modo: 'error'
          },
          sesion: ContextManager.limpiarContextoPendiente(sesion)
        };
      }
    
      const mm2Declarado = CalibreConverter.a_mm2(calibreValor);
      const mm2Minimo = CalibreConverter.a_mm2(resultado.calibre);
      const cumple = (mm2Declarado !== null && mm2Minimo !== null && mm2Declarado >= mm2Minimo);
    
      const respuestaFinal = cumple
        ? {
            conclusion: `✅ CORRECTO: ${calibreDisplay} cumple con Tabla 250-122 para interruptor ${interruptorNuevo}A`,
            calibre_declarado: calibreDisplay,
            calibre_minimo_requerido: `${resultado.calibre} AWG`,
            interruptor_aplicado: interruptorNuevo,
            fundamento: resultado.fundamento || { norma: "NOM-001-SEDE-2012", articulo: "250-122" },
            modo: 'resultado'
          }
        : {
            conclusion: `❌ INCORRECTO: Se requiere mínimo ${resultado.calibre} AWG según Tabla 250-122 (tienes ${calibreDisplay} para interruptor ${interruptorNuevo}A)`,
            calibre_declarado: calibreDisplay,
            calibre_minimo_requerido: `${resultado.calibre} AWG`,
            interruptor_aplicado: interruptorNuevo,
            fundamento: resultado.fundamento || { norma: "NOM-001-SEDE-2012", articulo: "250-122" },
            modo: 'resultado'
          };
    
      let nuevaSesion = ContextManager.limpiarContextoPendiente(sesion);
      nuevaSesion = ContextManager.actualizarParametros(nuevaSesion, {
        interruptor_A: interruptorNuevo,
        ultima_validacion_puesta_tierra: {
          calibre: calibreDisplay,
          interruptor: interruptorNuevo,
          cumple: cumple,
          timestamp: new Date().toISOString()
        }
      });
    
      const sesionActualizada = ContextManager.registrarConsulta(nuevaSesion, input, respuestaFinal);
      return { respuesta: respuestaFinal, sesion: sesionActualizada };
    }
  
    return null;
  }
  
  /**
   * Verifica acceso por plan para funcionalidades premium
   */
  static _verificarAccesoPlan(input, sesion, intencion) {
    const plan = sesion.usuario?.current_plan || 'base';
    
    const texto = input.toLowerCase();
    const esHVAC = /hvac|aire acondicionado|condensadora/i.test(texto);
    const esSoldadora = /soldadora|welder|arco|resistencia/i.test(texto);
    
    // CORREGIDO: Manejar undefined vs false para modo_diseno_rapido
    const esDisenadorCompleto = intencion === 'DISEÑADOR' && 
                                sesion.parametros?.modo_diseno_confirmado === true && 
                                sesion.parametros?.modo_diseno_rapido !== true;
    
    // Para diseño completo (modo completo, no rápido), verificar acceso
    if (esDisenadorCompleto && plan !== 'apex' && !PlanManager.checkFeatureAccess(plan, 'disenador')) {
      return {
        respuesta: {
          conclusion: PlanManager.getUpsellMessage('disenador', plan),
          modo: 'upgrade_required'
        },
        sesion
      };
    }
    
    let featureKey = null;
    if (esHVAC) featureKey = 'hvac';
    if (esSoldadora) featureKey = 'soldadoras';
    
    if (featureKey && plan !== 'apex' && !PlanManager.checkFeatureAccess(plan, featureKey)) {
      return {
        respuesta: {
          conclusion: getUpsellMessage(featureKey, plan),
          modo: 'upgrade_required'
        },
        sesion
      };
    }
    
    return null;
  }
  
  /**
   * Enruta la consulta a la personalidad correspondiente
   */
  static async _enrutarPersonalidad(input, sesion, intencion) {
    let respuesta;
    try {
      switch (intencion) {
        case 'VALIDADOR':
          respuesta = await Validador.ejecutar(input, sesion);
          break;
        case 'CONSULTOR':
          respuesta = await Consultor.ejecutar(input, sesion);
          break;
        case 'PROFESOR':
          respuesta = await Profesor.ejecutar(input, sesion);
          break;
        case 'DISEÑADOR':
          respuesta = await Disenador.ejecutar(input, sesion);
          break;
        default:
          respuesta = { conclusion: "⚠️ No reconocí tu consulta. ¿Podrías reformularla?", modo: 'error' };
      }
      
      // Si la personalidad actualizó la sesión internamente
      if (respuesta?._sesion_actualizada) {
        sesion = respuesta._sesion_actualizada;
        delete respuesta._sesion_actualizada;
      }
    } catch (error) {
      console.error('[Router] Error al enrutar:', error);
      respuesta = {
        conclusion: `❌ Error interno: ${error.message}`,
        modo: 'error',
        sugerencia: "Reintente o contacte soporte si persiste."
      };
    }
    return { respuesta, sesion };
  }
  
  /**
   * Garantiza que la respuesta siempre tenga campos utilizables
   */
  static _formatearRespuestaSegura(resp) {
    if (!resp) return { conclusion: "⚠️ Sin respuesta generada.", modo: 'fallback' };
    if (resp.conclusion || resp.pregunta || resp.explicacion || resp.respuesta_directa || resp.mensaje_baymax) {
      return resp;
    }
    return {
      conclusion: "⚠️ Procesando... Proporcione más detalles técnicos (ej: calibre AWG, amperaje, tensión).",
      modo: 'error_formato',
      ejemplo: "Ejemplo válido: 'Mi puesta a tierra es 10 AWG con interruptor de 40A, ¿cumple?'"
    };
  }
}

export { sesionInicial };