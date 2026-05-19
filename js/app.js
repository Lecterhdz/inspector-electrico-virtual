/**
 * @file js/app.js
 * @description Lógica del chat PWA + Supabase Auth + Licencias + Gating por plan
 * @version 3.0 - Auth profesional + licencias 30 días + control BASE/PRIME/APEX
 */

// 🔗 CONFIGURACIÓN SUPABASE (REEMPLAZA CON TUS DATOS REALES)
const SUPABASE_URL = 'https://eeymrugligeojechkcma.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVleW1ydWdsaWdlb2plY2hrY21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTMyODEsImV4cCI6MjA5NDM2OTI4MX0.wVmp2GZZa574pM0ghKJ4t99wyZLWjIcX8_cm3N_dlFk';

// Importar Supabase (CDN para PWA estática)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// Estado global de sesión
let session = {
  user: null,
  plan: 'BASE',
  license: null,
  expiresAt: null,
  historial: [],
  parametros: {}
};

// Referencias DOM
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const btnSend = document.getElementById('btnSend');
const toast = document.getElementById('toast');
const authModal = document.getElementById('authModal');

// ============================================
// FUNCIONES AUXILIARES (formato, UI, etc.)
// ============================================

const obtenerTextoRespuesta = (resp) => {
  if (!resp) return '';
  if (typeof resp === 'string') return resp;
  return resp.texto || resp.conclusion || resp.explicacion || resp.respuesta_directa || 
         resp.pregunta || resp.mensaje || resp.mensaje_baymax || 
         (typeof resp === 'object' ? JSON.stringify(resp, null, 2) : String(resp));
};

function formatContent(text) {
  if (!text) return '';
  if (typeof text !== 'string') {
    try { text = JSON.stringify(text, null, 2); } catch { return '⚠️ Respuesta no formateable'; }
  }
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^(•|\-|\*)\s(.+)$/gm, '<li>$2</li>');
  html = html.replace(/(<li>.+?<\/li>(?:\s*<li>.+?<\/li>)+)/g, '<ul>$1</ul>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function showTypingIndicator() {
  if (document.getElementById('typingIndicator')) return;
  const indicator = document.createElement('div');
  indicator.className = 'message bot typing';
  indicator.id = 'typingIndicator';
  indicator.innerHTML = `<div class="message-avatar">🤖</div><div class="message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;
  chatMessages.appendChild(indicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function showToast(message, type = 'info') {
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function addMessage(content, sender) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${sender}`;
  const avatar = sender === 'bot' ? '🤖' : '🧑';
  const formatted = formatContent(content);
  messageEl.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-content">${formatted}</div>`;
  chatMessages.appendChild(messageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ============================================
// INICIALIZACIÓN + AUTH
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Cargar sesión auth de Supabase
  const { data: { session: authSession } } = await supabase.auth.getSession();
  
  if (authSession?.user) {
    await loadProfile(authSession.user.id);
    if (authModal) authModal.style.display = 'none';
    updatePlanUI();
  }
  
  // Cargar historial local si existe
  const saved = localStorage.getItem('inspector-session');
  if (saved) {
    try { 
      const local = JSON.parse(saved);
      session.historial = local.historial || [];
      session.parametros = local.parametros || {};
    } catch {}
  }
  
  if (userInput) userInput.focus();
});

// Cargar perfil desde Supabase
async function loadProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('plan, license_code, expires_at').eq('id', userId).single();
  if (error || !data) return;
  
  session.user = { id: userId };
  session.plan = data.plan || 'BASE';
  session.license = data.license_code;
  session.expiresAt = data.expires_at;
  
  // Verificar expiración de licencia
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    session.plan = 'BASE';
    showToast('⚠️ Licencia expirada. Plan revertido a BASE.', 'warning');
  }
}

// Manejar login/registro
window.handleAuth = async (type) => {
  const email = document.getElementById('authEmail')?.value.trim();
  const password = document.getElementById('authPass')?.value.trim();
  
  if (!email || !password) return showToast('Completa correo y contraseña', 'warning');
  
  const { error } = type === 'signup' 
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });
  
  if (error) return showToast(error.message, 'error');
  
  showToast(type === 'signup' ? '✅ Registro exitoso. Revisa tu correo.' : '✅ Sesión iniciada', 'success');
  
  // Recargar perfil tras auth exitoso
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (authSession?.user) {
    await loadProfile(authSession.user.id);
    if (authModal) authModal.style.display = 'none';
    updatePlanUI();
  }
};

// Canjear licencia
window.redeemLicense = async () => {
  if (!session.user) return showToast('Inicia sesión primero', 'warning');
  
  const code = document.getElementById('licenseCode')?.value.trim().toUpperCase();
  if (!code) return showToast('Ingresa un código de licencia', 'warning');
  
  // 1. Verificar licencia en Supabase
  const { data: lic, error: licErr } = await supabase.from('licenses')
    .select('*').eq('code', code).single();
  
  if (licErr || !lic || !lic.is_active) return showToast('Licencia inválida o ya usada', 'error');
  if (new Date(lic.expires_at) < new Date()) return showToast('Licencia expirada', 'error');
  
  // 2. Actualizar perfil del usuario
  const { error: updateErr } = await supabase.from('profiles')
    .update({ plan: lic.plan, license_code: lic.code, expires_at: lic.expires_at })
    .eq('id', session.user.id);
  
  if (updateErr) return showToast('Error al activar licencia', 'error');
  
  // 3. Marcar licencia como usada
  await supabase.from('licenses').update({ is_active: false, used_by: session.user.id }).eq('code', code);
  
  // 4. Recargar sesión
  await loadProfile(session.user.id);
  updatePlanUI();
  showToast(`✅ Plan ${session.plan} activado por 30 días`, 'success');
};

// Actualizar UI de planes
function updatePlanUI() {
  document.querySelectorAll('.plan-card').forEach(card => {
    card.classList.toggle('active', card.dataset.plan === session.plan);
    card.style.pointerEvents = session.plan ? 'none' : 'auto'; // Desactivar tras activar
  });
  
  // Mostrar info de expiración si existe
  if (session.expiresAt) {
    const expiry = new Date(session.expiresAt).toLocaleDateString('es-MX');
    showToast(`Plan activo: ${session.plan} | Vence: ${expiry}`, 'info');
  }
}

// ============================================
// MANEJO DEL CHAT + API
// ============================================

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = userInput.value.trim();
  if (!input) return;
  
  // Verificar autenticación
  if (!session.user) {
    showToast('Inicia sesión para usar el inspector', 'warning');
    if (authModal) authModal.style.display = 'flex';
    return;
  }
  
  addMessage(input, 'user');
  userInput.value = '';
  btnSend.disabled = true;
  showTypingIndicator();
  
  try {
    const response = await processQuery(input);
    hideTypingIndicator();
    addMessage(obtenerTextoRespuesta(response), 'bot');
    
    // Guardar en historial local
    session.historial.push({ input, response, timestamp: new Date().toISOString() });
    localStorage.setItem('inspector-session', JSON.stringify({ historial: session.historial, parametros: session.parametros }));
    
  } catch (error) {
    hideTypingIndicator();
    addMessage('❌ Error de conexión. Verifica tu red o licencia.', 'bot');
    console.error('[App Error]:', error);
    showToast('Error de conexión', 'error');
  }
  
  btnSend.disabled = false;
  userInput.focus();
});

// Procesar consulta con API + fallback
async function processQuery(input) {
  const API_URL = 'https://inspector-electrico-api.dialectycam.workers.dev';
  
  // Obtener token de auth si existe
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const token = authSession?.access_token || '';
  
  const sessionData = {
    plan: session.plan,
    license: session.license,
    parametros: session.parametros,
    historial: session.historial.slice(-5)
  };
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ input, session: sessionData }),
      signal: AbortSignal.timeout(12000)
    });
    
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Error en servidor');
    
    return data.respuesta;
    
  } catch (error) {
    console.warn('[API Fallback]:', error.message);
    return processQueryLocalFallback(input, session.plan);
  }
}

// Fallback local (offline o error de API)
async function processQueryLocalFallback(input, plan = 'BASE') {
  await new Promise(r => setTimeout(r, 500));
  const texto = input.toLowerCase();
  
  // Funciones BASE disponibles offline
  if (/calibre.*\d+\s*a|\d+\s*a.*calibre/i.test(texto)) {
    const amp = parseInt(texto.match(/(\d+)\s*a/i)?.[1]);
    if (amp) {
      const awg = amp <= 20 ? '14' : amp <= 35 ? '12' : amp <= 50 ? '10' : amp <= 65 ? '8' : '6';
      return { respuesta_directa: `📱 Offline: Para ${amp}A → ${awg} AWG cobre (THW). *Conecta para validación oficial NOM-001*` };
    }
  }
  
  if (texto.includes('puesta a tierra') && /\d+\s*awg/i.test(texto) && /(\d+)\s*a(?!\s*wg)/i.test(texto)) {
    return { pregunta: `📱 Offline: Validación de puesta a tierra requiere conexión. *Conecta para verificar con Tabla 250-122*` };
  }
  
  // Funciones PRIME/APEX bloqueadas offline
  if (texto.includes('motor') && plan !== 'BASE') {
    return { error: `🔒 Función de motores requiere conexión activa (Plan ${plan})` };
  }
  
  return { pregunta: "⚠️ Sin conexión. Reconecta para validar con la NOM-001-SEDE-2012." };
}

// ============================================
// FUNCIONES GLOBALES (UI helpers)
// ============================================

window.fillInput = (text) => { if (userInput) { userInput.value = text; userInput.focus(); } };

window.selectPlan = (plan) => {
  // Solo para demo/preview - en producción el plan viene de licencia
  session.plan = plan;
  updatePlanUI();
  showToast(`Preview: Plan ${plan.toUpperCase()} seleccionado`, 'info');
};

window.submitPayment = () => {
  showToast('✅ Comprobante enviado. Activación en 24-48h (simulado)', 'success');
};

window.clearChat = () => {
  if (confirm('¿Limpiar historial del chat?')) {
    session.historial = [];
    localStorage.removeItem('inspector-session');
    chatMessages.innerHTML = '';
    showToast('Historial limpiado', 'info');
  }
};

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

window.logout = async () => {
  await supabase.auth.signOut();
  session = { user: null, plan: 'BASE', license: null, expiresAt: null, historial: [], parametros: {} };
  localStorage.removeItem('inspector-session');
  if (authModal) authModal.style.display = 'flex';
  updatePlanUI();
  showToast('Sesión cerrada', 'info');
};
// Al final de js/app.js, después de definir las funciones:
window.handleAuth = handleAuth;
window.redeemLicense = redeemLicense;
window.fillInput = fillInput;
window.selectPlan = selectPlan;
window.submitPayment = submitPayment;
window.clearChat = clearChat;
window.exportHistory = exportHistory;
window.logout = logout;
