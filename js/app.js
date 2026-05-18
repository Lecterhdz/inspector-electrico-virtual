/**
 * @file public/js/app.js
 * @description Lógica del chat PWA + conexión al motor determinístico
 */

// Estado de la sesión
let session = {
  usuario: null,
  plan: null,
  historial: [],
  parametros: {}
};

// Referencias DOM
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const btnSend = document.getElementById('btnSend');
const toast = document.getElementById('toast');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  // Cargar sesión desde localStorage si existe
  const saved = localStorage.getItem('inspector-session');
  if (saved) {
    try { session = { ...session, ...JSON.parse(saved) }; } catch {}
  }
  
  // Actualizar UI según plan
  if (session.plan) {
    document.querySelectorAll('.plan-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.plan === session.plan);
    });
    document.getElementById('paymentForm').style.display = 'none';
    showToast(`Plan ${session.plan.toUpperCase()} activo`, 'success');
  }
  
  // Focus en input
  userInput.focus();
});

// Manejar envío de formulario
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const input = userInput.value.trim();
  if (!input) return;
  
  // Agregar mensaje del usuario
  addMessage(input, 'user');
  userInput.value = '';
  btnSend.disabled = true;
  
  // Mostrar indicador de "escribiendo..."
  showTypingIndicator();
  
  try {
    // Procesar consulta (simulación - reemplazar con llamada real al motor)
    const response = await processQuery(input);
    
    // Ocultar indicador y mostrar respuesta
    hideTypingIndicator();
    addMessage(response.texto || response.conclusion || response, 'bot');
    
    // Guardar en historial
    session.historial.push({ input, response, timestamp: new Date().toISOString() });
    localStorage.setItem('inspector-session', JSON.stringify(session));
    
  } catch (error) {
    hideTypingIndicator();
    addMessage('❌ Error al procesar tu consulta. Intenta de nuevo.', 'bot');
    console.error('Error:', error);
    showToast('Error de conexión', 'error');
  }
  
  btnSend.disabled = false;
  userInput.focus();
});

// Agregar mensaje al chat
function addMessage(content, sender) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${sender}`;
  
  const avatar = sender === 'bot' ? '🤖' : '🧑';
  
  // Formatear contenido (soporta markdown básico)
  const formatted = formatContent(content);
  
  messageEl.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">${formatted}</div>
  `;
  
  chatMessages.appendChild(messageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Formatear contenido con soporte básico de markdown
function formatContent(text) {
  if (!text) return '';
  
  // Escape HTML básico
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Negritas **texto**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Listas con viñetas
  html = html.replace(/^(•|\-|\*)\s(.+)$/gm, '<li>$2</li>');
  html = html.replace(/(<li>.+<\/li>\n?)+/, '<ul>$&</ul>');
  
  // Saltos de línea
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// Mostrar indicador de "escribiendo..."
function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'message bot typing';
  indicator.id = 'typingIndicator';
  indicator.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-content">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chatMessages.appendChild(indicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Ocultar indicador
function hideTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

// Mostrar toast de notificación
function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Función helper para hints de consulta
function fillInput(text) {
  userInput.value = text;
  userInput.focus();
}

// ============================================
// PROCESAMIENTO DE CONSULTAS (Simulación)
// ============================================

/**
 * Procesa la consulta del usuario
 * @param {string} input - Texto del usuario
 * @returns {Promise<Object>} Respuesta formateada
 */
async function processQuery(input) {
  // Simular delay de red
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  
  // === AQUÍ CONECTAR CON TU MOTOR REAL ===
  // Por ahora, respuestas simuladas basadas en keywords:
  
  const texto = input.toLowerCase();
  
  // Validación de puesta a tierra
  if (texto.includes('puesta a tierra') && /\d+\s*awg/i.test(texto) && /\d+\s*a/i.test(texto)) {
    const matchCalibre = texto.match(/(\d+)\s*awg/i);
    const matchAmp = texto.match(/(\d+)\s*a/i);
    if (matchCalibre && matchAmp) {
      const calibre = parseInt(matchCalibre[1]);
      const interruptor = parseInt(matchAmp[1]);
      // Lógica simplificada de Tabla 250-122
      const minimo = interruptor <= 20 ? 14 : interruptor <= 60 ? 10 : interruptor <= 100 ? 8 : 6;
      const cumple = calibre >= minimo;
      return {
        conclusion: cumple 
          ? `✅ CORRECTO: ${calibre} AWG cumple con Tabla 250-122 para interruptor ${interruptor}A`
          : `❌ INCORRECTO: Se requiere mínimo ${minimo} AWG según Tabla 250-122`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "250-122" }
      };
    }
  }
  
  // Cálculo de calibre por amperaje
  if (texto.includes('calibre') && /\d+\s*a/i.test(texto)) {
    const match = texto.match(/(\d+)\s*a/i);
    if (match) {
      const amperaje = parseInt(match[1]);
      const calibre = amperaje <= 20 ? '14 AWG' : amperaje <= 35 ? '12 AWG' : 
                      amperaje <= 50 ? '10 AWG' : amperaje <= 65 ? '8 AWG' : '6 AWG';
      return {
        respuesta_directa: `Para ${amperaje}A: calibre sugerido ${calibre} cobre (THW, 30°C, sin agrupamiento)`,
        fundamento: { norma: "NOM-001-SEDE-2012", tabla: "310-16" }
      };
    }
  }
  
  // Explicación de tabla
  if (texto.includes('explica') && texto.includes('tabla')) {
    return {
      explicacion: `📊 **Tabla solicitada**: Para explicaciones detalladas de tablas normativas, selecciona un plan Prime o Apex para acceder al contenido completo con ejemplos prácticos y factores de corrección.`,
      modo: 'upsell'
    };
  }
  
  // Fallback genérico
  return {
    pregunta: "¿Podrías especificar qué dato necesitas? Ejemplos:\n• 'calibre para 50A'\n• 'puesta a tierra para interruptor 100A'\n• 'motor 75 HP 440V trifásico'",
    modo: 'clarificacion'
  };
}

// ============================================
// FUNCIONES GLOBALES (para onclick en HTML)
// ============================================
window.fillInput = fillInput;
window.selectPlan = (plan) => {
  session.plan = plan;
  localStorage.setItem('inspector-session', JSON.stringify(session));
  
  // Actualizar UI
  document.querySelectorAll('.plan-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.plan === plan);
  });
  
  // Mostrar formulario de pago si no es plan gratuito
  if (plan !== 'free') {
    document.getElementById('refCode').textContent = Math.random().toString(36).substr(2, 6).toUpperCase();
    document.getElementById('paymentForm').style.display = 'block';
    showToast(`Plan ${plan.toUpperCase()} seleccionado. Sube tu comprobante para activar.`, 'success');
  } else {
    document.getElementById('paymentForm').style.display = 'none';
    showToast('Plan gratuito activado. Algunas funciones están limitadas.', 'info');
  }
};

window.submitPayment = () => {
  const file = document.getElementById('proofFile').files[0];
  if (!file) {
    showToast('Selecciona un archivo de comprobante', 'error');
    return;
  }
  
  // Simular envío
  showToast('✅ Comprobante enviado. Activación en 24-48 horas.', 'success');
  document.getElementById('paymentForm').style.display = 'none';
  
  // Aquí iría la lógica real de upload a Supabase/email
};