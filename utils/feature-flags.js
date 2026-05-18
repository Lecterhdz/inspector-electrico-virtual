/**
 * @file utils/feature-flags.js
 * @description Feature flags y control de planes para el Inspector Eléctrico Virtual
 * @version 2.0 - Agregado soporte para HVAC y Soldadoras
 */

// ============================================
// DEFINICIÓN DE PLANES
// ============================================

export const PLANS = {
  BASE: {
    id: 'base',
    name: "Base",
    price: 1499,
    price_usd: 29,
    currency: "MXN",
    period: "mensual",
    features: {
      // Núcleo
      validador: { enabled: true, limit: null, note: "Validaciones básicas de puesta a tierra" },
      consultor: { enabled: true, limit: 50, note: "Hasta 50 consultas por mes" },
      profesor: { enabled: true, mode: 'basico', note: "Explicaciones básicas" },
      disenador: { enabled: false, note: "Disponible en Prime o Apex" },
      
      // Equipos especiales
      hvac: { enabled: false, mode: null, note: "Disponible en Prime" },
      soldadoras: { enabled: false, mode: null, note: "Disponible en Prime" },
      motores_avanzado: { enabled: false, note: "Disponible en Prime" },
      
      // Reportes y exportación
      reportes_pdf: { enabled: false, note: "Disponible en Apex" },
      exportacion_excel: { enabled: false, note: "Disponible en Apex" },
      
      // Ajustes avanzados
      ajuste_caida_tension: { enabled: false, mode: null, note: "Disponible en Apex" },
      factores_correccion: { enabled: false, note: "Disponible en Prime" },
      
      // API
      api_access: { enabled: false, limit: null, note: "Disponible en Apex" }
    }
  },
  
  PRIME: {
    id: 'prime',
    name: "Prime",
    price: 2499,
    price_usd: 49,
    currency: "MXN",
    period: "mensual",
    features: {
      // Núcleo
      validador: { enabled: true, limit: null, note: "Validaciones ilimitadas" },
      consultor: { enabled: true, limit: null, note: "Consultas ilimitadas" },
      profesor: { enabled: true, mode: 'completo', note: "Explicaciones detalladas con ejemplos" },
      disenador: { enabled: true, limit: 3, note: "Hasta 3 diseños completos por mes" },
      
      // Equipos especiales
      hvac: { enabled: true, mode: 'basico', note: "Cálculo básico según Art. 440" },
      soldadoras: { enabled: true, mode: 'basico', note: "Arco y resistencia con ciclo fijo" },
      motores_avanzado: { enabled: true, note: "Motores hasta 500 HP" },
      
      // Reportes y exportación
      reportes_pdf: { enabled: false, note: "Disponible en Apex" },
      exportacion_excel: { enabled: false, note: "Disponible en Apex" },
      
      // Ajustes avanzados
      ajuste_caida_tension: { enabled: false, mode: null, note: "Disponible en Apex" },
      factores_correccion: { enabled: true, note: "Temperatura y agrupamiento" },
      
      // API
      api_access: { enabled: false, limit: null, note: "Disponible en Apex" }
    }
  },
  
  APEX: {
    id: 'apex',
    name: "Apex",
    price: 3999,
    price_usd: 79,
    currency: "MXN",
    period: "mensual",
    features: {
      // Núcleo
      validador: { enabled: true, limit: null, note: "Validaciones ilimitadas" },
      consultor: { enabled: true, limit: null, note: "Consultas ilimitadas" },
      profesor: { enabled: true, mode: 'casos_reales', note: "Casos reales con ejemplos industriales" },
      disenador: { enabled: true, limit: null, note: "Diseños completos ilimitados" },
      
      // Equipos especiales
      hvac: { enabled: true, mode: 'avanzado', note: "Art. 440 completo + ajuste por caída" },
      soldadoras: { enabled: true, mode: 'avanzado', note: "Arco, resistencia, ciclo personalizado + PDF" },
      motores_avanzado: { enabled: true, note: "Motores de cualquier tamaño + VFD" },
      
      // Reportes y exportación
      reportes_pdf: { enabled: true, limit: null, note: "Reportes PDF ilimitados con trazabilidad" },
      exportacion_excel: { enabled: true, note: "Exportación a Excel con cálculos detallados" },
      
      // Ajustes avanzados
      ajuste_caida_tension: { enabled: true, mode: 'automatico', note: "Ajuste automático por caída de tensión (Art. 250-122(B))" },
      factores_correccion: { enabled: true, note: "Temperatura, agrupamiento y correcciones múltiples" },
      
      // API
      api_access: { enabled: true, limit: 1000, note: "API con 1000 consultas/mes" }
    }
  }
};

// ============================================
// CONTADORES DE USO (para limitar consultas)
// ============================================

const contadoresUso = new Map(); // { usuarioId: { plan, consultasUsadas, fechaReinicio } }

/**
 * Verifica si un usuario puede realizar una consulta según su plan
 * @param {string} usuarioId - ID del usuario
 * @param {string} plan - Plan actual ('base', 'prime', 'apex')
 * @returns {Object} { allowed: boolean, remaining: number, message: string }
 */
export const verificarLimiteConsulta = (usuarioId, plan) => {
  const planConfig = PLANS[plan.toUpperCase()];
  if (!planConfig) {
    return { allowed: false, remaining: 0, message: "Plan no reconocido" };
  }
  
  const limiteConsultor = planConfig.features.consultor.limit;
  
  // Planes sin límite (Prime, Apex)
  if (limiteConsultor === null) {
    return { allowed: true, remaining: Infinity, message: "Consultas ilimitadas" };
  }
  
  // Plan Base con límite de 50 consultas/mes
  const hoy = new Date();
  const registro = contadoresUso.get(usuarioId);
  
  if (!registro || registro.fechaReinicio.getMonth() !== hoy.getMonth()) {
    // Reiniciar contador al inicio del mes
    contadoresUso.set(usuarioId, {
      plan,
      consultasUsadas: 0,
      fechaReinicio: hoy
    });
    return { allowed: true, remaining: limiteConsultor, message: `${limiteConsultor - 0} consultas restantes este mes` };
  }
  
  const usadas = registro.consultasUsadas;
  const remaining = limiteConsultor - usadas;
  
  if (remaining <= 0) {
    return { 
      allowed: false, 
      remaining: 0, 
      message: "Has alcanzado el límite de 50 consultas este mes. Actualiza a Prime para consultas ilimitadas." 
    };
  }
  
  // Registrar uso
  contadoresUso.set(usuarioId, {
    ...registro,
    consultasUsadas: usadas + 1
  });
  
  return { allowed: true, remaining: remaining - 1, message: `${remaining - 1} consultas restantes este mes` };
};

/**
 * Verifica si una funcionalidad específica está disponible en el plan
 * @param {string} plan - Plan actual ('base', 'prime', 'apex')
 * @param {string} feature - Nombre de la funcionalidad
 * @returns {boolean} true si está disponible
 */
export const checkFeatureAccess = (plan, feature) => {
  const planKey = plan.toUpperCase();
  const planConfig = PLANS[planKey];
  if (!planConfig) return false;
  
  const featureConfig = planConfig.features[feature];
  if (!featureConfig) return false;
  
  return featureConfig.enabled === true;
};

/**
 * Obtiene la configuración completa de una funcionalidad para un plan
 * @param {string} plan - Plan actual
 * @param {string} feature - Nombre de la funcionalidad
 * @returns {Object} Configuración de la funcionalidad
 */
export const getFeatureConfig = (plan, feature) => {
  const planKey = plan.toUpperCase();
  const planConfig = PLANS[planKey];
  if (!planConfig) return null;
  
  return planConfig.features[feature] || null;
};

/**
 * Genera mensaje de upsell para una funcionalidad no disponible
 * @param {string} feature - Nombre de la funcionalidad
 * @param {string} currentPlan - Plan actual del usuario
 * @returns {string} Mensaje de upsell
 */
export const getUpsellMessage = (feature, currentPlan) => {
  const planUpper = currentPlan?.toUpperCase() || 'BASE';
  
  const messages = {
    hvac: {
      BASE: "❄️ El cálculo de HVAC (Art. 440) está disponible en Plan Prime o Apex. Actualice para calcular conductores y protecciones para sistemas de aire acondicionado y refrigeración.",
      PRIME: "❄️ Para cálculo avanzado de HVAC con ajuste por caída de tensión y reporte PDF, actualice a Plan Apex.",
      APEX: "❄️ Cálculo avanzado de HVAC activado. ¿Desea incluir ajuste por caída de tensión en el reporte?"
    },
    soldadoras: {
      BASE: "⚡ El cálculo de soldadoras (Art. 630) está disponible en Plan Prime o Apex. Actualice para calcular conductores y protecciones para equipos de soldadura.",
      PRIME: "⚡ Para cálculo avanzado de soldadoras con ciclo de trabajo personalizado y reporte PDF, actualice a Plan Apex.",
      APEX: "⚡ Cálculo avanzado de soldadoras activado. Especifique el ciclo de trabajo para mayor precisión."
    },
    disenador: {
      BASE: "🔧 El diseño completo de instalaciones (9 parámetros) está disponible en Plan Prime o Apex. Actualice para obtener diseños profesionales.",
      PRIME: "🔧 Diseño completo disponible. Tiene 3 diseños incluidos en su plan Prime.",
      APEX: "🔧 Diseño completo ilimitado activado."
    },
    reportes_pdf: {
      BASE: "📄 Los reportes PDF están disponibles en Plan Apex. Actualice para generar reportes con trazabilidad normativa.",
      PRIME: "📄 Los reportes PDF están disponibles en Plan Apex. Actualice para generar reportes profesionales.",
      APEX: "📄 Reporte PDF generado con trazabilidad completa."
    },
    ajuste_caida_tension: {
      BASE: "📐 El ajuste por caída de tensión (Art. 250-122(B)) está disponible en Plan Apex. Actualice para cálculos automáticos.",
      PRIME: "📐 El ajuste automático por caída de tensión está disponible en Plan Apex. Actualice para cálculos precisos.",
      APEX: "📐 Ajuste por caída de tensión aplicado automáticamente."
    },
    default: {
      BASE: "🔒 Esta funcionalidad está disponible en planes superiores. Consulte nuestros planes Prime y Apex para más información.",
      PRIME: "🔒 Esta funcionalidad está disponible en Plan Apex. Actualice para acceder.",
      APEX: "✅ Funcionalidad disponible en su plan Apex."
    }
  };
  
  const featureMessages = messages[feature] || messages.default;
  const planKey = planUpper === 'APEX' ? 'APEX' : (planUpper === 'PRIME' ? 'PRIME' : 'BASE');
  
  return featureMessages[planKey] || featureMessages.default.BASE;
};

/**
 * Registra el uso de una consulta para un usuario
 * @param {string} usuarioId - ID del usuario
 * @param {string} plan - Plan actual
 * @returns {Object} Estado actualizado
 */
export const registrarConsulta = (usuarioId, plan) => {
  const hoy = new Date();
  const registro = contadoresUso.get(usuarioId);
  
  if (!registro || registro.fechaReinicio.getMonth() !== hoy.getMonth()) {
    const nuevoRegistro = {
      plan,
      consultasUsadas: 1,
      fechaReinicio: hoy
    };
    contadoresUso.set(usuarioId, nuevoRegistro);
    return { consultasUsadas: 1, remaining: 49 };
  }
  
  const nuevoRegistro = {
    ...registro,
    consultasUsadas: registro.consultasUsadas + 1
  };
  contadoresUso.set(usuarioId, nuevoRegistro);
  
  const limite = PLANS[plan.toUpperCase()]?.features.consultor.limit || 50;
  return {
    consultasUsadas: nuevoRegistro.consultasUsadas,
    remaining: limite - nuevoRegistro.consultasUsadas
  };
};

/**
 * Obtiene el estado de uso actual de un usuario
 * @param {string} usuarioId - ID del usuario
 * @returns {Object} Estado de uso
 */
export const obtenerEstadoUso = (usuarioId) => {
  const registro = contadoresUso.get(usuarioId);
  if (!registro) {
    return { consultasUsadas: 0, remaining: 50, fechaReinicio: null };
  }
  
  const limite = PLANS[registro.plan.toUpperCase()]?.features.consultor.limit || 50;
  return {
    plan: registro.plan,
    consultasUsadas: registro.consultasUsadas,
    remaining: limite - registro.consultasUsadas,
    fechaReinicio: registro.fechaReinicio
  };
};

// ============================================
// CLASE PLAN MANAGER (API unificada)
// ============================================

export class PlanManager {
  
  /**
   * Obtiene la configuración completa de un plan
   * @param {string} planId - 'base', 'prime', 'apex'
   * @returns {Object} Configuración del plan
   */
  static getPlan(planId) {
    return PLANS[planId.toUpperCase()] || PLANS.BASE;
  }
  
  /**
   * Obtiene las features de un plan
   * @param {string} planId - 'base', 'prime', 'apex'
   * @returns {Object} Features del plan
   */
  static getPlanFeatures(planId) {
    const plan = this.getPlan(planId);
    return { features: plan.features, plan: plan };
  }
  
  /**
   * Verifica acceso a una feature específica
   * @param {string} planId - Plan del usuario
   * @param {string} feature - Nombre de la feature
   * @returns {boolean}
   */
  static checkFeatureAccess(planId, feature) {
    return checkFeatureAccess(planId, feature);
  }
  
  /**
   * Obtiene mensaje de upsell para una feature
   * @param {string} feature - Nombre de la feature
   * @param {string} currentPlan - Plan actual
   * @returns {string}
   */
  static getUpsellMessage(feature, currentPlan) {
    return getUpsellMessage(feature, currentPlan);
  }
  
  /**
   * Verifica límite de consultas para un usuario
   * @param {string} usuarioId - ID del usuario
   * @param {string} plan - Plan actual
   * @returns {Object}
   */
  static verificarLimite(usuarioId, plan) {
    return verificarLimiteConsulta(usuarioId, plan);
  }
  
  /**
   * Compara dos planes y muestra diferencias (para marketing)
   * @param {string} plan1 - Primer plan
   * @param {string} plan2 - Segundo plan
   * @returns {Object} Diferencias entre planes
   */
  static compararPlanes(plan1, plan2) {
    const p1 = this.getPlan(plan1);
    const p2 = this.getPlan(plan2);
    
    const diferencias = [];
    const features = new Set([...Object.keys(p1.features), ...Object.keys(p2.features)]);
    
    for (const feature of features) {
      const f1 = p1.features[feature];
      const f2 = p2.features[feature];
      
      if (f1?.enabled !== f2?.enabled) {
        diferencias.push({
          feature,
          [p1.name]: f1?.enabled ? `✅ ${f1.note || 'Disponible'}` : '❌ No disponible',
          [p2.name]: f2?.enabled ? `✅ ${f2.note || 'Disponible'}` : '❌ No disponible'
        });
      }
    }
    
    return {
      plan1: p1,
      plan2: p2,
      diferencias
    };
  }
}

// Exportación por defecto
export default PlanManager;