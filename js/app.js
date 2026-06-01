/**
 * @file js/app.js
 * @description Lógica del chat PWA + Supabase Auth + Licencias + Gating por plan
 * @version 4.0 - Mejorado: manejo de API, mensaje de bienvenida dinámico, fallback offline
 */

// ============================================
// CONFIGURACIÓN SUPABASE (REEMPLAZA CON TUS DATOS REALES)
// ============================================
const SUPABASE_URL = 'https://eeymrugligeojechkcma.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVleW1ydWdsaWdlb2plY2hrY21hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTMyODEsImV4cCI6MjA5NDM2OTI4MX0.wVmp2GZZa574pM0ghKJ4t99wyZLWjIcX8_cm3N_dlFk';

// Configuración de API
const API_URL = import.meta?.env?.VITE_API_URL || 'https://inspector-electrico-api.dialectycam.workers.dev';
const LOCAL_API_URL = 'http://localhost:3000/api';

// Importar Supabase (CDN para PWA estática)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================
// ESTADO GLOBAL
// ============================================
let session = {
  user: null,
  plan: 'BASE',
  license: null,
  expiresAt: null,
  historial: [],
  parametros: {},
  modoOffline: false
};

let isLoading = false;

// ============================================
// REFERENCIAS DOM
// ============================================
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const btnSend = document.getElementById('btnSend');
const toast = document.getElementById('toast');
const authModal = document.getElementById('authModal');
const planBadge = document.getElementById('planBadge');

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function obtenerTextoRespuesta(resp) {
  if (!resp) return '';
  if (typeof resp === 'string') return resp;
  return resp.texto || resp.conclusion || resp.explicacion || resp.respuesta_directa || 
         resp.pregunta || resp.mensaje || resp.mensaje_baymax || 
         (typeof resp === 'object' ? JSON.stringify(resp, null, 2) : String(resp));
}

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
  const avatar = sender === 'bot' ? '🤖' : '👤';
  const formatted = formatContent(content);
  messageEl.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-content">${formatted}</div>`;
  chatMessages.appendChild(messageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}


// ============================================
// MENSAJE DE BIENVENIDA DINÁMICO POR PLAN
// ============================================

function loadWelcomeMessage() {
  const plan = session.plan || 'BASE';
  const isLoggedIn = !!session.user;
  
  const messages = {
    BASE: {
      title: '¡Hola! Soy Berymax, tu asistente experto en **NOM-001-SEDE-2012**. ⚡',
      features: [
        '✅ Validar puesta a tierra (Tabla 250-122)',
        '✅ Calcular calibre por amperaje (Tabla 310-16)',
        '✅ Tablas básicas de consulta'
      ],
      footer: '⚡ **Plan Base** - Actualiza a Prime para motores, HVAC y soldadoras.\n\n💡 *Ejemplo: "Mi puesta a tierra es 10 AWG con interruptor de 40A, ¿está bien?"*'
    },
    PRIME: {
      title: '¡Hola! Soy Baymax, tu asistente experto en **NOM-001-SEDE-2012**. ⚡',
      features: [
        '✅ Validar puesta a tierra (Tabla 250-122)',
        '✅ Calcular calibre por amperaje (Tabla 310-16)',
        '✅ Dimensionar motores (Tabla 430-250)',
        '✅ Calcular HVAC (Art. 440)',
        '✅ Soldadoras (Art. 630)'
      ],
      footer: '⭐ **Plan Prime** - Funcionalidades completas para profesionales.\n\n💡 *Ejemplo: "motor 75 HP 440V trifásico"*'
    },
    APEX: {
      title: '¡Hola! Soy Baymax, tu asistente experto en **NOM-001-SEDE-2012**. ⚡',
      features: [
        '✅ Validar puesta a tierra (Tabla 250-122)',
        '✅ Calcular calibre por amperaje (Tabla 310-16)',
        '✅ Dimensionar motores (Tabla 430-250)',
        '✅ Calcular HVAC (Art. 440)',
        '✅ Soldadoras (Art. 630)',
        '✅ Reportes PDF con trazabilidad',
        '✅ Soporte prioritario'
      ],
      footer: '🏆 **Plan Apex** - Todo incluido + reportes PDF y soporte prioritario.\n\n💡 *Ejemplo: "generar reporte PDF de este diseño"*'
    }
  };
  
  const data = messages[plan] || messages.BASE;
  const featuresHtml = data.features.map(f => `<li>${f}</li>`).join('');
  
  let authMessage = '';
  if (!isLoggedIn) {
    authMessage = `<p style="margin-top:0.75rem; padding:0.5rem; background:#f0f0f0; border-radius:0.5rem; font-size:0.8rem;">
      🔐 <strong>Inicia sesión</strong> para guardar tu historial y acceder a todas las funciones.<br>
      👉 Haz clic en <strong>🎟️ Licencia</strong> para registrarte o ingresar.
    </p>`;
  }
  
  const offlineNote = session.modoOffline ? 
    `<p style="margin-top:0.5rem; font-size:0.75rem; color: var(--warning);">
      ⚠️ <strong>Modo offline</strong> - Funciones limitadas. Conéctate para validación oficial.
    </p>` : '';
  
  const welcomeHtml = `
    <div class="message bot">
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <p>${data.title}</p>
        <p><strong>Puedo ayudarte con:</strong></p>
        <ul>${featuresHtml}</ul>
        <p style="margin-top:0.5rem; font-size:0.85rem; opacity:0.9;">
          ${data.footer}
        </p>
        ${authMessage}
        ${offlineNote}
      </div>
    </div>
  `;
  
  if (chatMessages) {
    chatMessages.innerHTML = welcomeHtml;
  }
}

// ============================================
// SUPABASE AUTH y PERFIL
// ============================================

async function loadProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('plan, license_code, expires_at').eq('id', userId).single();
  if (error || !data) return;
  
  session.user = { id: userId };
  session.plan = data.plan || 'BASE';
  session.license = data.license_code;
  session.expiresAt = data.expires_at;
  
  // Obtener email del usuario autenticado
  const { data: { user } } = await supabase.auth.getUser();
  if (user) session.user.email = user.email;
  
  // Verificar expiración de licencia
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    session.plan = 'BASE';
    showToast('⚠️ Licencia expirada. Plan revertido a BASE.', 'warning');
  }
  
  updatePlanUI();
  updateUserInfoModal();
  loadWelcomeMessage(); // Recargar mensaje con nuevo plan
}

// Manejar login/registro
window.handleAuth = async (type) => {
  const email = document.getElementById('authEmail')?.value.trim();
  const password = document.getElementById('authPass')?.value.trim();
  
  if (!email || !password) return showToast('Completa correo y contraseña', 'warning');
  if (type === 'signup' && password.length < 6) return showToast('Contraseña debe tener al menos 6 caracteres', 'warning');
  
  showToast(type === 'signup' ? 'Registrando...' : 'Iniciando sesión...', 'info');
  
  const { error } = type === 'signup' 
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });
  
  if (error) return showToast(error.message, 'error');
  
  showToast(type === 'signup' ? '✅ Registro exitoso. Ya puedes iniciar sesión.' : '✅ Sesión iniciada', 'success');
  
  if (type === 'signup') {
    // Limpiar campos para login
    document.getElementById('authPass').value = '';
    return;
  }
  
  // Recargar perfil tras auth exitoso
  const { data: { session: authSession } } = await supabase.auth.getSession();
  if (authSession?.user) {
    await loadProfile(authSession.user.id);
    if (authModal) authModal.style.display = 'none';
  }
};

// Canjear licencia
window.redeemLicense = async () => {
  if (!session.user) return showToast('Inicia sesión primero', 'warning');
  
  const codeInput = document.getElementById('licenseCode');
  const code = codeInput?.value.trim().toUpperCase();
  if (!code) return showToast('Ingresa un código de licencia', 'warning');
  
  try {
    console.log('[License] Buscando:', code);
    
    // 1. Buscar licencia
    const { data: lic, error: licErr } = await supabase
      .from('licenses')
      .select('*')
      .eq('code', code)
      .single();
      
    if (licErr) {
      console.error('[License] Error Supabase:', licErr);
      throw new Error(licErr.code === 'PGRST116' ? 'Licencia no encontrada' : licErr.message);
    }
    
    if (!lic) throw new Error('Licencia no encontrada');
    if (!lic.is_active) throw new Error('Licencia ya usada o desactivada');
    if (new Date(lic.expires_at) < new Date()) throw new Error('Licencia expirada');
    
    // 2. Actualizar perfil
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ 
        plan: lic.plan, 
        license_code: lic.code, 
        expires_at: lic.expires_at 
      })
      .eq('id', session.user.id);
      
    if (updateErr) throw new Error('Error al activar: ' + updateErr.message);
    
    // 3. Marcar como usada
    const { error: markErr } = await supabase
      .from('licenses')
      .update({ is_active: false, used_by: session.user.id })  // ← Solo lo que sí existe
      .eq('code', code);
      
    if (markErr) throw new Error('Error al marcar usada: ' + markErr.message);
    
    // 4. Recargar sesión
    await loadProfile(session.user.id);
    updatePlanUI();
    updateUserInfoModal();
    showToast(`✅ Plan ${session.plan} activado por 30 días`, 'success');
    if (codeInput) codeInput.value = '';
    
  } catch (err) {
    console.error('[License] Fallo:', err);
    showToast(`❌ ${err.message}`, 'error');
  }
};

// Actualizar UI de planes
function updatePlanUI() {
  if (planBadge) {
    planBadge.textContent = session.plan;
    planBadge.className = `badge ${session.plan.toLowerCase()}`;
  }
  
  document.querySelectorAll('.plan-card-mini').forEach(card => {
    card.classList.toggle('active', card.dataset.plan === session.plan);
    if (card.dataset.plan === session.plan) {
      const btn = card.querySelector('.btn-plan-mini');
      if (btn) btn.textContent = '✓ Activo';
    }
  });
}

function updateUserInfoModal() {
  const userInfo = document.getElementById('userInfo');
  const userEmail = document.getElementById('userEmail');
  const userPlan = document.getElementById('userPlan');
  const userExpiry = document.getElementById('userExpiry');
  
  if (userInfo && userEmail && userPlan && userExpiry && session.user) {
    userInfo.style.display = 'block';
    userEmail.textContent = session.user.email || 'Usuario';
    userPlan.textContent = session.plan;
    userExpiry.textContent = session.expiresAt 
      ? new Date(session.expiresAt).toLocaleDateString('es-MX') 
      : 'Sin expiración';
  }
}

// ============================================
// CHAT + API
// ============================================

async function processQuery(input) {
  // Verificar si estamos offline
  if (!navigator.onLine) {
    session.modoOffline = true;
    return processQueryLocalFallback(input, session.plan);
  }
  
  session.modoOffline = false;
  
  // Obtener token de auth
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const token = authSession?.access_token || '';
  
  const sessionData = {
    plan: session.plan,
    license: session.license,
    parametros: session.parametros,
    historial: session.historial.slice(-5),
    usuario: session.user ? { id: session.user.id, email: session.user.email } : null
  };
  
  // Intentar API remota primero
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ input, session: sessionData }),
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Error en servidor');
    
    return data.respuesta;
    
  } catch (error) {
    console.warn('[API Remote] Error:', error.message);
    
    // Intentar API local
    try {
      const localResponse = await fetch(LOCAL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, session: sessionData }),
        signal: AbortSignal.timeout(5000)
      });
      
      if (localResponse.ok) {
        const data = await localResponse.json();
        return data.respuesta;
      }
    } catch (localError) {
      console.warn('[API Local] Error:', localError.message);
    }
    
    // Fallback offline
    session.modoOffline = true;
    return processQueryLocalFallback(input, session.plan);
  }
}

// Fallback local (offline)
async function processQueryLocalFallback(input, plan = 'BASE') {
  await new Promise(r => setTimeout(r, 300));
  const texto = input.toLowerCase();
  
  // Validación de puesta a tierra
  const patMatch = texto.match(/(\d+)\s*awg/i);
  const interruptorMatch = texto.match(/(\d+)\s*a(?!\s*wg)/i);
  
  if (patMatch && interruptorMatch && /puesta a tierra|tierra/i.test(texto)) {
    const awg = parseInt(patMatch[1]);
    const interruptor = parseInt(interruptorMatch[1]);
    
    let minimo = '10';
    if (interruptor <= 20) minimo = '14';
    else if (interruptor <= 60) minimo = '10';
    else if (interruptor <= 100) minimo = '8';
    else if (interruptor <= 200) minimo = '6';
    else minimo = '4';
    
    const awgNum = parseInt(awg);
    const minNum = parseInt(minimo);
    
    if (awgNum <= minNum) {
      return { conclusion: `✅ CORRECTO (offline): ${awg} AWG cumple para interruptor ${interruptor}A. Mínimo requerido: ${minimo} AWG.\n\n📚 Tabla 250-122 NOM-001-SEDE-2012 (modo local)` };
    } else {
      return { conclusion: `❌ INCORRECTO (offline): Se requiere mínimo ${minimo} AWG para interruptor ${interruptor}A.\n\n📚 Tabla 250-122 NOM-001-SEDE-2012 (modo local)` };
    }
  }
  
  // Calibre por corriente
  const ampMatch = texto.match(/(\d+)\s*a/i);
  if (ampMatch && /calibre|necesito|conductor/i.test(texto)) {
    const amp = parseInt(ampMatch[1]);
    let awg = '14';
    if (amp > 20 && amp <= 35) awg = '12';
    else if (amp > 35 && amp <= 50) awg = '10';
    else if (amp > 50 && amp <= 70) awg = '8';
    else if (amp > 70 && amp <= 90) awg = '6';
    else if (amp > 90 && amp <= 110) awg = '4';
    else if (amp > 110 && amp <= 130) awg = '2';
    else if (amp > 130 && amp <= 170) awg = '1/0';
    else if (amp > 170) awg = '2/0';
    
    return { respuesta_directa: `📐 Para ${amp}A: calibre sugerido ${awg} AWG cobre (THW, 30°C).\n\n📚 Tabla 310-16 NOM-001-SEDE-2012 (modo local)` };
  }
  
  // Motores (solo Prime/Apex)
  if (texto.includes('motor') && plan !== 'BASE') {
    const hpMatch = texto.match(/(\d+)\s*hp/i);
    if (hpMatch) {
      const hp = parseInt(hpMatch[1]);
      let corriente = 65;
      if (hp === 75) corriente = 96;
      else if (hp === 50) corriente = 65;
      else if (hp === 100) corriente = 124;
      else corriente = Math.round(hp * 1.3);
      
      return { respuesta_directa: `📊 MOTOR ${hp} HP, 440V, 3 fases (offline):\n• Corriente a placa: ${corriente} A\n• Protección térmica: ${Math.round(corriente * 1.25)} A\n• Protección magnética: ${Math.round(corriente * 2.5)} A\n\n📚 Modo local - Conecta para validación oficial.` };
    }
    return { pregunta: "Para calcular el motor, necesito: HP, tensión (V) y fases.\nEjemplo: 'motor 75 HP 440V trifásico'" };
  }
  
  if (plan === 'BASE' && (texto.includes('motor') || texto.includes('hvac') || texto.includes('soldadora'))) {
    return { conclusion: `🔒 La función "${texto.includes('motor') ? 'motores' : (texto.includes('hvac') ? 'HVAC' : 'soldadoras')}" requiere Plan Prime o Apex.\n\n🎟️ Adquiere una licencia en la sección "Licencia".` };
  }
  
  return { pregunta: "⚠️ Sin conexión a internet. Las funciones avanzadas requieren conexión.\n\nFunciones disponibles offline:\n• Calibre por corriente (ej: 'calibre para 50A')\n• Validación básica de puesta a tierra\n\nConéctate para validación oficial NOM-001-SEDE-2012." };
}

// Enviar mensaje
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = userInput.value.trim();
  if (!input || isLoading) return;
  
  // Verificar autenticación
  if (!session.user) {
    showToast('Inicia sesión para usar el inspector', 'warning');
    if (authModal) authModal.style.display = 'flex';
    return;
  }
  
  addMessage(input, 'user');
  userInput.value = '';
  isLoading = true;
  btnSend.disabled = true;
  showTypingIndicator();
  
  try {
    const response = await processQuery(input);
    hideTypingIndicator();
    addMessage(obtenerTextoRespuesta(response), 'bot');
    
    session.historial.push({ input, response, timestamp: new Date().toISOString() });
    localStorage.setItem('inspector-session', JSON.stringify({ 
      historial: session.historial.slice(-50), 
      parametros: session.parametros 
    }));
    
  } catch (error) {
    hideTypingIndicator();
    addMessage('❌ Error de conexión. Verifica tu red.', 'bot');
    console.error('[App Error]:', error);
    showToast('Error de conexión', 'error');
  } finally {
    isLoading = false;
    btnSend.disabled = false;
    userInput.focus();
  }
});

// ============================================
// FUNCIONES GLOBALES UI
// ============================================

window.fillInput = (text) => { 
  if (userInput) { 
    userInput.value = text; 
    userInput.focus(); 
  } 
};

window.selectPlan = (plan) => {
  // Demo preview - en producción el plan viene de licencia
  if (!session.user) {
    showToast('Inicia sesión para cambiar de plan', 'warning');
    if (authModal) authModal.style.display = 'flex';
    return;
  }
  showToast(`ℹ️ Plan ${plan.toUpperCase()}. Adquiere una licencia para activar.`, 'info');
};

window.submitPayment = () => {
  showToast('✅ Comprobante enviado. Activación en 24-48h (simulado)', 'success');
};

window.clearChat = () => {
  if (confirm('¿Limpiar historial del chat?')) {
    session.historial = [];
    localStorage.removeItem('inspector-session');
    loadWelcomeMessage();
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
  session = { 
    user: null, 
    plan: 'BASE', 
    license: null, 
    expiresAt: null, 
    historial: [], 
    parametros: {},
    modoOffline: false
  };
  localStorage.removeItem('inspector-session');
  
  if (authModal) authModal.style.display = 'flex';
  updatePlanUI();
  loadWelcomeMessage();
  
  const userInfo = document.getElementById('userInfo');
  if (userInfo) userInfo.style.display = 'none';
  
  showToast('Sesión cerrada', 'info');
};

window.openAuthModal = () => {
  if (authModal) authModal.style.display = 'flex';
};

window.closeAuthModal = () => {
  if (authModal) authModal.style.display = 'none';
};

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Configurar modal
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) {
        authModal.style.display = 'none';
      }
    });
  }
  
  // Detectar estado de conexión
  window.addEventListener('online', () => {
    session.modoOffline = false;
    showToast('🟢 Conexión recuperada. Validación oficial disponible.', 'success');
    loadWelcomeMessage();
  });
  
  window.addEventListener('offline', () => {
    session.modoOffline = true;
    showToast('🔴 Sin conexión. Usando modo offline limitado.', 'warning');
    loadWelcomeMessage();
  });
  
  session.modoOffline = !navigator.onLine;
  
  // Cargar sesión auth de Supabase
  const { data: { session: authSession } } = await supabase.auth.getSession();
  
  if (authSession?.user) {
    await loadProfile(authSession.user.id);
    if (authModal) authModal.style.display = 'none';
  } else {
    loadWelcomeMessage();
  }
  
  // Cargar historial local
  const saved = localStorage.getItem('inspector-session');
  if (saved) {
    try { 
      const local = JSON.parse(saved);
      session.historial = local.historial || [];
      session.parametros = local.parametros || {};
    } catch {}
  }
  
  updatePlanUI();
  
  if (userInput) userInput.focus();
});
// Agregar al final de app.js
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'jedi';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  // Crear botón en header (se inyecta automáticamente)
  const headerContent = document.querySelector('.header-content');
  if (headerContent && !document.getElementById('themeToggle')) {
    const btn = document.createElement('button');
    btn.id = 'themeToggle';
    btn.className = 'theme-toggle';
    btn.innerHTML = savedTheme === 'sith' ? '🔴 Sith' : '🔵 Jedi';
    btn.onclick = () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'sith' ? 'jedi' : 'sith';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      btn.innerHTML = next === 'sith' ? '🔴 Sith' : '🔵 Jedi';
    };
    headerContent.appendChild(btn);
  }
});
