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

// ============================================
// PROCESAMIENTO DE CONSULTAS (Simulación → Motor Real)
// ============================================

/**
 * Procesa la consulta del usuario
 * @param {string} input - Texto del usuario
 * @returns {Promise<Object>} Respuesta formateada
 */
async function processQuery(input) {
  // Simular delay de red para UX realista
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 800));
  
  const texto = input.toLowerCase();
  
  // ==========================================
  // 1. VALIDACIÓN DE PUESTA A TIERRA (250-122)
  // ==========================================
  if (texto.includes('puesta a tierra') && /\d+\s*awg/i.test(texto) && /\d+\s*a/i.test(texto)) {
    const matchCalibre = texto.match(/(\d+)\s*awg/i);
    const matchAmp = texto.match(/(\d+)\s*a/i);
    
    if (matchCalibre && matchAmp) {
      const calibre = parseInt(matchCalibre[1]);
      const interruptor = parseInt(matchAmp[1]);
      
      // Lógica simplificada de Tabla 250-122
      const minimo = interruptor <= 20 ? 14 : 
                     interruptor <= 60 ? 10 : 
                     interruptor <= 100 ? 8 : 6;
      const cumple = calibre >= minimo;
      
      return {
        conclusion: cumple 
          ? `✅ **CORRECTO**: ${calibre} AWG cumple con Tabla 250-122 para interruptor ${interruptor}A`
          : `❌ **INCORRECTO**: Se requiere mínimo **${minimo} AWG** según Tabla 250-122 (tienes ${calibre} AWG para interruptor ${interruptor}A)`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "250-122", tabla: "250-122" },
        modo: 'validacion'
      };
    }
  }
  
  // ==========================================
  // 2. CÁLCULO DE CALIBRE POR AMPERAJE (310-16)
  // ==========================================
  if (texto.includes('calibre') && /\d+\s*a/i.test(texto)) {
    const match = texto.match(/(\d+)\s*a/i);
    if (match) {
      const amperaje = parseInt(match[1]);
      const calibre = amperaje <= 20 ? '14 AWG' : 
                      amperaje <= 35 ? '12 AWG' : 
                      amperaje <= 50 ? '10 AWG' : 
                      amperaje <= 65 ? '8 AWG' : '6 AWG';
      
      return {
        respuesta_directa: `Para **${amperaje}A**: calibre sugerido **${calibre}** cobre (THW, 30°C, sin agrupamiento)`,
        fundamento: { norma: "NOM-001-SEDE-2012", tabla: "310-16" },
        modo: 'calculo'
      };
    }
  }
  
  // ==========================================
  // 3. EXPLICACIÓN DE TABLAS NORMATIVAS
  // ==========================================
  if (texto.includes('explica') && texto.includes('tabla')) {
    // Extraer número de tabla si está presente
    const matchTabla = texto.match(/tabla\s+(\d{3}-\d{2,3}|\d{3})/i);
    const tablaId = matchTabla ? matchTabla[1] : '';
    
    // Base de conocimiento de tablas (hard-coded para MVP)
    const respuestasTablas = {
      '250-122': `📊 **Tabla 250-122: Calibre mínimo del conductor de puesta a tierra de equipo**

🔑 **Regla principal**: El calibre se determina por la capacidad del **INTERRUPTOR automático**, NO por el conductor de fase.

📋 **Valores típicos (cobre)**:
• Interruptor 15-20A → 14 AWG
• Interruptor 30-60A → 10 AWG  
• Interruptor 100A → 8 AWG
• Interruptor 200A → 6 AWG
• Interruptor 400A → 3 AWG

⚠️ **Regla crítica (Art. 250-122(B))**: Si el conductor de fase se aumentó por caída de tensión, el de puesta a tierra también debe aumentarse **proporcionalmente**.

🔧 **Ejemplo**: Interruptor 90A → requiere mínimo **8 AWG** cobre.

💡 *¿Quieres validar una puesta a tierra? Proporciona: calibre declarado y capacidad del interruptor.*`,
      
      '310-16': `📊 **Tabla 310-16: Ampacidades de conductores aislados (0-2000V)**

🔑 **Regla principal**: Corriente máxima permisible para conductores a **30°C en aire, sin agrupamiento**.

📋 **Valores típicos (cobre, 75°C)**:
• 14 AWG → 20A | 12 AWG → 25A | 10 AWG → 35A
• 8 AWG → 50A | 6 AWG → 65A | 4 AWG → 85A
• 3 AWG → 100A | 2 AWG → 115A | 1 AWG → 130A

⚠️ **Factores de corrección obligatorios**:
• Temperatura ambiente >30°C: aplicar factor (Tabla 310-19)
• Más de 3 conductores agrupados: aplicar factor (Tabla 310-15(b)(3)(a))
• Temperatura de terminales: usar columna 60/75/90°C (Art. 110-14(c))

💡 *¿Quieres calcular un calibre? Proporciona: corriente requerida y condiciones de instalación.*`,
      
      '430-250': `📊 **Tabla 430-250: Corriente a plena carga de motores de CA**

🔑 **Regla principal**: Corriente nominal para dimensionar conductores (125%) y protecciones (hasta 250%).

📋 **Ejemplos (trifásicos 440V)**:
• 10 HP → 14 A | 25 HP → 34 A
• 50 HP → 65 A | 75 HP → 96 A
• 100 HP → 124 A | 150 HP → 180 A

⚠️ **Reglas de aplicación**:
• Usar valores de placa cuando estén disponibles (Art. 430-6)
• Conductor del motor: 125% de corriente (Art. 430-22)
• Protección magnética: hasta 250% para permitir arranque (Art. 430-52)

💡 *¿Quieres calcular un motor? Proporciona: HP, tensión (V) y si es monofásico o trifásico.*`,

      '240-6': `📊 **Tabla 240-6: Tamaños estándar de protecciones contra sobrecorriente**

🔑 **Regla principal**: Lista los valores comerciales estándar de interruptores termomagnéticos y fusibles.

📋 **Valores estándar (A)**:
15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200...

⚠️ **Regla del "siguiente tamaño" (Art. 240-4(B))**:
Si el cálculo no coincide con un valor estándar, se permite usar el **siguiente tamaño estándar mayor** (hasta 800A), siempre que el conductor lo permita.

🔧 **Ejemplo**: Cálculo da 47A → usar siguiente tamaño: **50A** ✅

💡 *¿Quieres coordinar una protección? Proporciona: corriente calculada y calibre del conductor.*`
    };
    
    const contenido = respuestasTablas[tablaId] || 
      `📊 **Tabla ${tablaId || 'solicitada'}**

Para explicaciones detalladas de tablas normativas:

✅ **Plan Base**: Tablas 250-122, 310-16 básicas
✅ **Plan Prime**: + Motores (430-250), HVAC (440), Soldadoras (630)
✅ **Plan Apex**: + Reportes PDF con logo y trazabilidad

💡 *Selecciona un plan en el panel lateral para acceder al contenido completo.*`;

    return {
      explicacion: contenido,
      fundamento: { norma: "NOM-001-SEDE-2012", tabla: tablaId || 'general' },
      modo: 'explicacion_tabla'
    };
  }
  
  // ==========================================
  // 4. MOTORES (Simulación básica)
  // ==========================================
  if (texto.includes('motor') && /\d+\s*hp/i.test(texto) && /\d+\s*v/i.test(texto)) {
    const matchHP = texto.match(/(\d+)\s*hp/i);
    const matchV = texto.match(/(\d+)\s*v/i);
    const trifasico = texto.includes('trifásico') || texto.includes('3 fases');
    
    if (matchHP && matchV) {
      const hp = parseInt(matchHP[1]);
      const voltaje = parseInt(matchV[1]);
      
      // Cálculo simplificado basado en Tabla 430-250 (440V trifásico)
      if (trifasico && voltaje >= 400) {
        const corrienteBase = { 10: 14, 25: 34, 50: 65, 75: 96, 100: 124, 150: 180 };
        const Ipc = corrienteBase[hp] || Math.round(hp * 1.2); // Fallback aproximado
        
        return {
          respuesta_directa: `📊 **MOTOR ${hp} HP, ${voltaje}V, ${trifasico ? '3' : '1'} fases**:
• Corriente a placa: **${Ipc} A**
• Protección térmica: **${Math.round(Ipc * 1.25)} A** (125% según Art. 430-22)
• Protección magnética: **${Math.round(Ipc * 2.5)} A** (250% según Art. 430-52)
• Conductor sugerido: **${Ipc <= 50 ? '8 AWG' : Ipc <= 65 ? '6 AWG' : Ipc <= 100 ? '3 AWG' : '1 AWG'}** (cobre, THW)

📚 Fundamento: Tabla 430-250 NOM-001-SEDE-2012`,
          fundamento: { norma: "NOM-001-SEDE-2012", tabla: "430-250", articulo: "430-22, 430-52" },
          modo: 'calculo_motor'
        };
      }
    }
  }
  
  // ==========================================
  // 5. FALLBACK GENÉRICO CON SUGERENCIAS
  // ==========================================
  return {
    pregunta: `¿Podrías especificar qué dato necesitas? Ejemplos:

• \`calibre para 50A\`
• \`puesta a tierra para interruptor 100A\`
• \`motor 75 HP 440V trifásico\`
• \`Explica la tabla 250-122\`
• \`¿Qué dice el artículo 110-12?\``,
    modo: 'clarificacion',
    sugerencias: [
      'calibre para 50A',
      'puesta a tierra 10 AWG 40A',
      'motor 75 HP 440V trifásico',
      'Explica la tabla 250-122'
    ]
  };
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
