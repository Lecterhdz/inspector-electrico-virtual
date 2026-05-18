/**
 * @file context-manager.js
 * @description Manejo de sesión y contexto pendiente para diálogos multi-turno
 */

/**
 * Estado inicial de una sesión
 */
export const sesionInicial = {
  personalidad_activa: null,
  parametros: {},
  historial: [],
  contexto_validacion_pendiente: null,
  timestamp_pendiente: null,
  trazabilidad: {
    tablas_consultadas: [],
    reglas_aplicadas: [],
    decisiones: []
  }
};

/**
 * Clase para manejar el estado de la sesión
 */
export class ContextManager {
  
  /**
   * Cambia la personalidad activa
   */
  static cambiarPersonalidad(sesion, nueva, motivo) {
    return {
      ...sesion,
      personalidad_activa: nueva,
      ultimo_cambio_personalidad: new Date().toISOString(),
      motivo_cambio: motivo
    };
  }
  
  /**
   * Registra una consulta en el historial
   */
  static registrarConsulta(sesion, input, respuesta) {
    return {
      ...sesion,
      historial: [...(sesion.historial || []), {
        input,
        respuesta,
        personalidad: sesion.personalidad_activa,
        timestamp: new Date().toISOString()
      }]
    };
  }
  
  /**
   * Actualiza parámetros de la sesión
   */
  static actualizarParametros(sesion, params) {
    return {
      ...sesion,
      parametros: { ...sesion.parametros, ...params }
    };
  }
  
  /**
   * Guarda un contexto de validación pendiente
   */
  static guardarContextoPendiente(sesion, contexto) {
    return {
      ...sesion,
      contexto_validacion_pendiente: contexto,
      timestamp_pendiente: new Date().toISOString()
    };
  }
  
  /**
   * Limpia el contexto pendiente
   */
  static limpiarContextoPendiente(sesion) {
    const nuevaSesion = { ...sesion };
    delete nuevaSesion.contexto_validacion_pendiente;
    delete nuevaSesion.timestamp_pendiente;
    return nuevaSesion;
  }
  
  /**
   * Verifica si hay una validación pendiente
   */
  static tieneValidacionPendiente(sesion) {
    return sesion.contexto_validacion_pendiente !== null &&
           sesion.personalidad_activa === 'VALIDADOR';
  }
  
  /**
   * Agrega una tabla consultada a la trazabilidad
   */
  static agregarTablaConsultada(sesion, tabla) {
    return {
      ...sesion,
      trazabilidad: {
        ...sesion.trazabilidad,
        tablas_consultadas: [...(sesion.trazabilidad.tablas_consultadas || []), tabla]
      }
    };
  }
  
  /**
   * Agrega una regla aplicada a la trazabilidad
   */
  static agregarReglaAplicada(sesion, regla) {
    return {
      ...sesion,
      trazabilidad: {
        ...sesion.trazabilidad,
        reglas_aplicadas: [...(sesion.trazabilidad.reglas_aplicadas || []), regla]
      }
    };
  }
}