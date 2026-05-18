// /engine/sesion-manager.js
export class SesionManager {
  
  static crearSesion(usuario_id) {
    return {
      id: `${usuario_id}_${Date.now()}`,
      usuario_id,
      timestamp_inicio: new Date().toISOString(),
      personalidad_activa: null, // 'VALIDADOR' | 'CONSULTOR' | 'PROFESOR' | 'DISEÑADOR'
      parametros: {}, // Acumulador de datos del diálogo
      historial: [], // Array de exchanges {rol, contenido, timestamp}
      trazabilidad: {
        tablas_consultadas: [],
        reglas_aplicadas: [],
        decisiones: []
      },
      estado: 'activa' // 'activa' | 'completada' | 'escalada'
    };
  }
  
  static actualizarParametros(sesion, nuevos_parametros) {
    return {
      ...sesion,
      parametros: { ...sesion.parametros, ...nuevos_parametros },
      historial: [
        ...sesion.historial,
        { rol: 'sistema', accion: 'parametros_actualizados', timestamp: new Date().toISOString() }
      ]
    };
  }
  
static registrarConsulta(sesion, consulta, respuesta) {
  // ✅ Null checks para trazabilidad
  const trazabilidadActual = sesion.trazabilidad || {};
  const tablasActuales = trazabilidadActual.tablas_consultadas || [];
  
  // ✅ Extraer tabla consultada solo si existe y es string/array
  const nuevasTablas = [];
  if (respuesta?.fundamento?.tabla) {
    if (Array.isArray(respuesta.fundamento.tabla)) {
      nuevasTablas.push(...respuesta.fundamento.tabla);
    } else if (typeof respuesta.fundamento.tabla === 'string') {
      nuevasTablas.push(respuesta.fundamento.tabla);
    }
  }
  
  return {
    ...sesion,
    historial: [
      ...sesion.historial,
      { rol: 'usuario', contenido: consulta, timestamp: new Date().toISOString() },
      { 
        rol: 'agente', 
        contenido: typeof respuesta === 'object' 
          ? { texto: respuesta.texto, conclusion: respuesta.conclusion, modo: respuesta.modo } 
          : respuesta,
        timestamp: new Date().toISOString() 
      }
    ],
    trazabilidad: {
      ...trazabilidadActual,
      tablas_consultadas: [
        ...tablasActuales,
        ...nuevasTablas
      ].filter((v, i, a) => a.indexOf(v) === i) // Eliminar duplicados
    }
  };
}
  
  static cambiarPersonalidad(sesion, nueva_personalidad, motivo) {
    return {
      ...sesion,
      personalidad_activa: nueva_personalidad,
      historial: [
        ...sesion.historial,
        { 
          rol: 'sistema', 
          accion: 'cambio_personalidad',
          de: sesion.personalidad_activa,
          a: nueva_personalidad,
          motivo,
          timestamp: new Date().toISOString()
        }
      ]
    };
  }
  
  static finalizarSesion(sesion, motivo = 'completada') {
    return {
      ...sesion,
      estado: motivo,
      timestamp_fin: new Date().toISOString(),
      duracion_segundos: Math.round(
        (new Date(sesion.timestamp_fin || Date.now()) - new Date(sesion.timestamp_inicio)) / 1000
      )
    };
  }
}