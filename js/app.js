/**
 * @file js/app.js
 * @description Lógica del chat PWA + conexión al motor determinístico
 * @version 2.1 - Fix de manejo de respuestas + contenido real para tablas
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

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Extrae texto legible de cualquier estructura de respuesta
 * @param {Object|string} resp - Respuesta del motor/IA
 * @returns {string} Texto formateado para mostrar
 */
const obtenerTextoRespuesta = (resp) => {
  if (!resp) return '';
  if (typeof resp === 'string') return resp;
  
  // Prioridad de campos según tipo de respuesta
  return resp.texto || 
         resp.conclusion || 
         resp.explicacion || 
         resp.respuesta_directa || 
         resp.pregunta || 
         resp.mensaje_baymax ||
         (typeof resp === 'object' ? JSON.stringify(resp, null, 2) : String(resp));
};

/**
 * Formatea contenido con soporte básico de markdown (robusto)
 * @param {string|object} text - Contenido a formatear
 * @returns {string} HTML seguro para insertar en el DOM
 */
function formatContent(text) {
  // Convertir a string si es objeto, null o undefined
  if (!text) return '';
  if (typeof text !== 'string') {
    try {
      text = JSON.stringify(text, null, 2);
    } catch {
      return '⚠️ Respuesta no formateable';
    }
  }
  
  // Escape HTML básico para prevenir XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Negritas **texto**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Listas con viñetas (•, -, *)
  html = html.replace(/^(•|\-|\*)\s(.+)$/gm, '<li>$2</li>');
  // Envolver listas consecutivas en <ul>
  html = html.replace(/(<li>.+?<\/li>(?:\s*<li>.+?<\/li>)+)/g, '<ul>$1</ul>');
  
  // Saltos de línea
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

/**
 * Muestra indicador de "escribiendo..."
 */
function showTypingIndicator() {
  // Evitar duplicados
  if (document.getElementById('typingIndicator')) return;
  
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

/**
 * Oculta indicador de "escribiendo..."
 */
function hideTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

/**
 * Muestra toast de notificación
 */
function showToast(message, type = 'info') {
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

/**
 * Agrega mensaje al chat con formato
 */
function addMessage(content, sender) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${sender}`;
  
  const avatar = sender === 'bot' ? '🤖' : '🧑';
  
  // Formatear contenido de forma segura
  const formatted = formatContent(content);
  
  messageEl.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">${formatted}</div>
  `;
  
  chatMessages.appendChild(messageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Cargar sesión desde localStorage si existe
  const saved = localStorage.getItem('inspector-session');
  if (saved) {
    try { session = { ...session, ...JSON.parse(saved) }; } catch {}
  }
  
  // Actualizar UI según plan seleccionado
  if (session.plan) {
    document.querySelectorAll('.plan-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.plan === session.plan);
    });
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) paymentForm.style.display = 'none';
    showToast(`Plan ${session.plan.toUpperCase()} activo`, 'success');
  }
  
  // Focus en input para mejor UX
  if (userInput) userInput.focus();
});

// ============================================
// MANEJO DEL CHAT
// ============================================

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
    // Procesar consulta
    const response = await processQuery(input);
    
    // Ocultar indicador y mostrar respuesta (con extracción segura de texto)
    hideTypingIndicator();
    addMessage(obtenerTextoRespuesta(response), 'bot');
    
    // Guardar en historial para persistencia offline
    session.historial.push({ input, response, timestamp: new Date().toISOString() });
    localStorage.setItem('inspector-session', JSON.stringify(session));
    
  } catch (error) {
    hideTypingIndicator();
    addMessage('❌ Error al procesar tu consulta. Intenta de nuevo.', 'bot');
    console.error('[App Error]:', error);
    showToast('Error de conexión', 'error');
  }
  
  btnSend.disabled = false;
  userInput.focus();
});

/**
 * Procesa la consulta llamando a tu API en Cloudflare Workers
 */
async function processQuery(input) {
  // 🔗 ⚠️ REEMPLAZA CON TU URL REAL DE CLOUDFLARE WORKERS
  const API_URL = 'https://inspector-electrico-api.dialectycam.workers.dev';
  
  const sessionData = {
    plan: session.plan,
    parametros: session.parametros,
    historial: session.historial.slice(-5)
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, session: sessionData }),
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    if (!data.success) throw new Error(data.error || 'Error en servidor');
    
    return data.respuesta;
  } catch (error) {
    console.warn('[API Fallback]:', error.message);
    // Fallback local si la API falla (offline/error temporal)
    return processQueryLocalFallback(input);
  }
}

/**
 * Fallback local mínimo (mantiene la PWA funcional sin internet)
 */
async function processQueryLocalFallback(input) {
  await new Promise(r => setTimeout(r, 500));
  const texto = input.toLowerCase();
  
  if (texto.includes('calibre') && /\d+\s*a/i.test(texto)) {
    return { respuesta_directa: `📱 Modo offline: Para ${input}, usa la app con conexión activa para validación precisa.` };
  }
  return { pregunta: "⚠️ Sin conexión. Reconecta para validar con la NOM-001-SEDE-2012." };
}

// ============================================
// FUNCIONES GLOBALES (para onclick en HTML)
// ============================================

window.fillInput = (text) => {
  if (userInput) {
    userInput.value = text;
    userInput.focus();
  }
};

window.selectPlan = (plan) => {
  session.plan = plan;
  localStorage.setItem('inspector-session', JSON.stringify(session));
  
  // Actualizar UI de tarjetas
  document.querySelectorAll('.plan-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.plan === plan);
  });
  
  // Mostrar formulario de pago si aplica
  const paymentForm = document.getElementById('paymentForm');
  const refCode = document.getElementById('refCode');
  
  if (paymentForm && refCode) {
    if (plan && plan !== 'free') {
      refCode.textContent = Math.random().toString(36).substr(2, 6).toUpperCase();
      paymentForm.style.display = 'block';
      showToast(`Plan ${plan.toUpperCase()} seleccionado. Sube tu comprobante para activar.`, 'success');
    } else {
      paymentForm.style.display = 'none';
      showToast('Plan gratuito activado. Algunas funciones están limitadas.', 'info');
    }
  }
};

window.submitPayment = () => {
  const proofFile = document.getElementById('proofFile');
  const file = proofFile?.files?.[0];
  
  if (!file) {
    showToast('Selecciona un archivo de comprobante', 'error');
    return;
  }
  
  // Simular envío (aquí iría upload real a Supabase/email)
  showToast('✅ Comprobante enviado. Activación en 24-48 horas.', 'success');
  
  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm) paymentForm.style.display = 'none';
  
  // Aquí iría la lógica real:
  // await uploadComprobante(file, session.plan, session.usuario);
};

// ============================================
// UTILIDADES ADICIONALES
// ============================================

/**
 * Limpia el historial del chat (para debug o nueva sesión)
 */
window.clearChat = () => {
  if (confirm('¿Limpiar historial del chat?')) {
    session.historial = [];
    localStorage.removeItem('inspector-session');
    chatMessages.innerHTML = '';
    showToast('Historial limpiado', 'info');
  }
};

/**
 * Exporta el historial como JSON (para backup o soporte)
 */
window.exportHistory = () => {
  const blob = new Blob([JSON.stringify(session.historial, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inspector-historial-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Historial exportado', 'success');
};
