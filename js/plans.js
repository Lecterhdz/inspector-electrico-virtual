/**
 * @file public/js/plans.js
 * @description Lógica del selector de planes y upsell
 */

// Configuración de planes
const PLANS = {
  base: {
    name: 'Base',
    price: 1499,
    features: [
      'Validación puesta a tierra (250-122)',
      'Cálculo de calibre por amperaje (310-16)',
      'Consultas básicas de la norma',
      'Soporte por email'
    ],
    limitations: [
      'Sin motores, HVAC o soldadoras',
      'Sin reportes PDF',
      'Actualizaciones manuales'
    ]
  },
  prime: {
    name: 'Prime',
    price: 2499,
    features: [
      'Todo lo de Base',
      '✅ Motores (430-250, 430-22, 430-52)',
      '✅ HVAC (Art. 440)',
      '✅ Soldadoras (Art. 630)',
      'Explicaciones de artículos',
      'Soporte prioritario'
    ],
    limitations: [
      'Sin reportes PDF con logo',
      'Sin trazabilidad con hash'
    ]
  },
  apex: {
    name: 'Apex',
    price: 3999,
    features: [
      'Todo lo de Prime',
      '✅ Reportes PDF profesionales',
      '✅ Logo corporativo en reportes',
      '✅ Hash de trazabilidad normativa',
      '✅ Actualizaciones automáticas',
      '✅ Soporte 24/7 por WhatsApp'
    ],
    limitations: []
  }
};

// Renderizar tarjetas de planes dinámicamente
function renderPlans() {
  const container = document.querySelector('.plans-sidebar');
  if (!container) return;
  
  // Mantener el header y formulario existentes
  const header = container.querySelector('h3');
  const paymentForm = container.querySelector('.payment-form');
  
  // Limpiar tarjetas existentes
  container.querySelectorAll('.plan-card').forEach(el => el.remove());
  
  // Crear tarjetas
  Object.entries(PLANS).forEach(([key, plan]) => {
    const card = document.createElement('div');
    card.className = `plan-card ${key === 'prime' ? 'featured' : ''}`;
    card.dataset.plan = key;
    
    const featuresList = [...plan.features, ...plan.limitations.map(f => `<span style="opacity:0.6">${f}</span>`)].join('');
    
    card.innerHTML = `
      <div class="plan-header">
        <span class="plan-name">${plan.name}</span>
        <span class="plan-price">$${plan.price.toLocaleString('es-MX')}/mes</span>
      </div>
      <ul class="plan-features">
        ${plan.features.map(f => `<li>✅ ${f}</li>`).join('')}
        ${plan.limitations.map(f => `<li style="opacity:0.6">❌ ${f}</li>`).join('')}
      </ul>
      <button class="btn-plan ${key === 'prime' ? 'btn-primary' : ''}" onclick="selectPlan('${key}')">
        Seleccionar ${key === 'prime' ? '⭐' : ''}
      </button>
    `;
    
    // Insertar después del header, antes del formulario
    if (header) {
      header.after(card);
    } else {
      container.prepend(card);
    }
  });
}

// Inicializar al cargar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderPlans);
} else {
  renderPlans();
}

// Exportar para uso global
window.PLANS = PLANS;
window.renderPlans = renderPlans;