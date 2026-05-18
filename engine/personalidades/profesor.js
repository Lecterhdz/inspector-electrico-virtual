/**
 * @file engine/personalidades/profesor.js
 * @description Personalidad PROFESOR - Versión tolerante a input truncado
 * @version 3.2 - Coincidencias parciales para inputs cortados (~20 chars)
 */

export class Profesor {
  
  static async ejecutar(input, sesion) {
    const texto = input.toLowerCase().trim();
    
    // 🔍 Logging de debug
    console.log(`[Profesor Debug] Input completo: "${input}"`);
    console.log(`[Profesor Debug] Input procesado: "${texto.substring(0, 30)}..."`);

    // ==========================================
    // 1. TABLA 250-122 (PUESTA A TIERRA DE EQUIPO)
    // Coincidencia con prefijo truncado: "250-12"
    // ==========================================
    if (texto.includes('250-122') || texto.includes('250-12') || (texto.includes('puesta a tierra') && texto.includes('equipo'))) {
      console.log('[Profesor] Match: 250-122');
      return {
        explicacion: `📊 **Tabla 250-122: Calibre mínimo del conductor de puesta a tierra de equipo**

🔑 **Regla principal**: El calibre del conductor de puesta a tierra se determina por la capacidad del **INTERRUPTOR automático** que protege el circuito, **NO** por el calibre del conductor de fase.

📋 **Valores típicos (cobre)**:
• Interruptor 15-20A → 14 AWG
• Interruptor 30-60A → 10 AWG  
• Interruptor 100A → 8 AWG
• Interruptor 200A → 6 AWG
• Interruptor 400A → 3 AWG

⚠️ **Regla crítica (Art. 250-122(B))**: Si el conductor de fase se aumentó por caída de tensión, el conductor de puesta a tierra también debe aumentarse en la **misma proporción**.

🔧 **Ejemplo**:
- Interruptor 90A → requiere mínimo 8 AWG cobre.
- Si usaras 10 AWG con ese interruptor → ❌ INCORRECTO.

💡 ¿Quieres validar una puesta a tierra? Proporciona: calibre declarado y capacidad del interruptor.`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "250-122", tabla: "250-122" },
        modo: 'explicacion_tabla'
      };
    }

    // ==========================================
    // 2. TABLA 250-66 (PUESTA A TIERRA DEL SISTEMA)
    // ==========================================
    if (texto.includes('250-66') || texto.includes('electrodo') || texto.includes('tierra sistema')) {
      console.log('[Profesor] Match: 250-66');
      return {
        explicacion: `📊 **Tabla 250-66: Calibre del conductor de puesta a tierra del sistema**

🔑 **Regla principal**: Define el calibre mínimo del conductor que conecta el sistema a tierra (electrodo), basado en el calibre del **conductor de fase más grande** del servicio.

📋 **Valores típicos (cobre)**:
• Fase ≤ 2 AWG → Tierra: 8 AWG
• Fase 1/0 a 2/0 → Tierra: 6 AWG
• Fase 3/0 a 350 kcmil → Tierra: 4 AWG

⚠️ **Diferencia clave con 250-122**:
• 250-122: Puesta a tierra de **equipo** (por interruptor)
• 250-66: Puesta a tierra del **sistema** (por calibre de fase)

💡 ¿Quieres dimensionar un conductor de electrodo? Proporciona: calibre del conductor de fase más grande.`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "250-66", tabla: "250-66" },
        modo: 'explicacion_tabla'
      };
    }

    // ==========================================
    // 3. TABLA 310-16 (AMPACIDAD DE CONDUCTORES)
    // ==========================================
    if (texto.includes('310-16') || texto.includes('ampacidad') || texto.includes('capacidad corriente')) {
      console.log('[Profesor] Match: 310-16');
      return {
        explicacion: `📊 **Tabla 310-16: Ampacidades de conductores aislados (0-2000V)**

🔑 **Regla principal**: Define la corriente máxima permisible para conductores de cobre/aluminio con aislamientos THW, THHN, etc., a **30°C en aire, sin agrupamiento**.

📋 **Valores típicos (cobre, 75°C)**:
• 14 AWG → 20A | 12 AWG → 25A | 10 AWG → 35A
• 8 AWG → 50A | 6 AWG → 65A | 4 AWG → 85A
• 3 AWG → 100A | 2 AWG → 115A | 1 AWG → 130A

⚠️ **Factores de corrección obligatorios**:
• Temperatura ambiente >30°C: aplicar factor (Tabla 310-19)
• Más de 3 conductores en canalización: aplicar factor de agrupamiento (Tabla 310-15(b)(3)(a))
• Temperatura de terminales: usar columna 60/75/90°C según Art. 110-14(c)

🔧 **Ejemplo**:
- 50A requeridos, 4 conductores agrupados, 40°C ambiente:
  • Calibre base: 8 AWG (50A)
  • Factor agrupamiento: 0.80 | Factor temp: 0.88
  • Corriente ajustada: 50A / (0.80 × 0.88) = 71A → usar 4 AWG (85A) ✅

💡 ¿Quieres calcular un calibre? Proporciona: corriente requerida, material y condiciones.`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "310-16", tabla: "310-16" },
        modo: 'explicacion_tabla'
      };
    }

    // ==========================================
    // 4. TABLA 430-250 (CORRIENTE DE MOTORES)
    // Coincidencia con prefijo truncado: "430-25"
    // ==========================================
    if (texto.includes('430-250') || texto.includes('430-25') || (texto.includes('motor') && texto.includes('corriente'))) {
      console.log('[Profesor] Match: 430-250');
      return {
        explicacion: `📊 **Tabla 430-250: Corriente a plena carga de motores de CA**

🔑 **Regla principal**: Proporciona la corriente nominal (A) de motores para dimensionar conductores (125%) y protecciones (hasta 250%).

📋 **Ejemplos típicos (trifásicos 440V)**:
• 10 HP → 14 A | 25 HP → 34 A
• 50 HP → 65 A | 75 HP → 96 A
• 100 HP → 124 A | 150 HP → 180 A

⚠️ **Reglas de aplicación**:
• Usar valores de placa cuando estén disponibles (Art. 430-6)
• Conductor del motor: 125% de corriente (Art. 430-22)
• Protección magnética: hasta 250% para permitir arranque (Art. 430-52)

🔧 **Ejemplo - Motor 75 HP, 440V, trifásico**:
• Corriente de tabla: 96 A
• Conductor mínimo: 96A × 1.25 = 120A → 3 AWG
• Protección térmica: 120 A | Protección magnética: 240 A

💡 ¿Quieres calcular un motor? Proporciona: HP, tensión (V) y si es monofásico o trifásico.`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "430-250", tabla: "430-250" },
        modo: 'explicacion_tabla'
      };
    }

    // ==========================================
    // 5. ART. 430-22 (CONDUCTORES PARA MOTOR - 125%)
    // ==========================================
    if (texto.includes('430-22') || (texto.includes('125%') && texto.includes('motor'))) {
      console.log('[Profesor] Match: 430-22');
      return {
        explicacion: `📘 **Art. 430-22: Conductores para un motor**

🔑 **Regla principal**: Los conductores que alimentan un solo motor deben tener ampacidad no menor al **125% de la corriente a plena carga** del motor.

📋 **Fórmula**: I_conductor ≥ I_motor × 1.25

🔧 **Ejemplo**:
- Motor 50 HP, 440V → I_placa = 65 A
- Conductor mínimo: 65A × 1.25 = 81.25 A
- Calibre cobre THW: 4 AWG (85A) ✅

⚠️ Aplicar factores de temperatura y agrupamiento DESPUÉS del 125%.

💡 ¿Quieres dimensionar un conductor para motor? Proporciona: HP, tensión y fases.`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "430-22" },
        modo: 'explicacion_tabla'
      };
    }

    // ==========================================
    // 6. ART. 430-52 (PROTECCIÓN MAGNÉTICA PARA MOTORES)
    // ==========================================
    if (texto.includes('430-52') || (texto.includes('250%') && texto.includes('motor'))) {
      console.log('[Profesor] Match: 430-52');
      return {
        explicacion: `📘 **Art. 430-52: Protección contra cortocircuito para motores**

🔑 **Regla principal**: La protección magnética para un motor puede ser hasta **250% de la corriente a plena carga** para permitir el arranque.

📋 **Límites máximos**:
• Interruptor termomagnético: hasta 250% de I_placa
• Fusible de no-retardo: hasta 300% de I_placa

⚠️ **Diferencia clave**:
• Protección térmica (sobrecarga): 115-125% (Art. 430-32)
• Protección magnética (cortocircuito): hasta 250% (Art. 430-52)

🔧 **Ejemplo - Motor 75 HP, 440V**:
• I_placa: 96 A
• Protección térmica: 96A × 1.25 = 120 A
• Protección magnética máxima: 96A × 2.50 = 240 A

💡 ¿Quieres coordinar protecciones de motor? Proporciona: HP, tensión y tipo de protección.`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "430-52" },
        modo: 'explicacion_tabla'
      };
    }

    // ==========================================
    // 7. TABLA 240-6 (TAMAÑOS ESTÁNDAR DE PROTECCIONES)
    // ==========================================
    if (texto.includes('240-6') || (texto.includes('interruptor') && texto.includes('estándar'))) {
      console.log('[Profesor] Match: 240-6');
      return {
        explicacion: `📊 **Tabla 240-6: Tamaños estándar de protecciones contra sobrecorriente**

🔑 **Regla principal**: Lista los valores comerciales estándar de interruptores termomagnéticos y fusibles.

📋 **Valores estándar (A)**:
15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200...

⚠️ **Regla del "siguiente tamaño" (Art. 240-4(B))**:
Si el cálculo no coincide con un valor estándar, se permite usar el **siguiente tamaño estándar mayor** (hasta 800A), siempre que el conductor lo permita.

🔧 **Ejemplo**:
- Cálculo da 47A → usar siguiente tamaño: 50A ✅
- Cálculo da 53A → usar 60A ✅

💡 ¿Quieres coordinar una protección? Proporciona: corriente calculada y calibre del conductor.`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "240-6", tabla: "240-6" },
        modo: 'explicacion_tabla'
      };
    }

    // ==========================================
    // 8. ART. 110-14(c) (TEMPERATURA DE TERMINALES)
    // ==========================================
    if (texto.includes('110-14') || (texto.includes('temperatura') && texto.includes('terminal'))) {
      console.log('[Profesor] Match: 110-14');
      return {
        explicacion: `📘 **Art. 110-14(c): Limitación de temperatura en terminales de equipos**

🔑 **Regla principal**: Las terminales de los equipos determinan la columna de temperatura a usar en la Tabla 310-16.

📋 **Límites por corriente**:
• Circuitos ≤ 100A: Default 60°C (usar 75°C solo si terminales están listadas)
• Circuitos > 100A: Default 75°C (usar 90°C solo si terminales están listadas)

⚠️ **Error común**: Usar conductor THHN a 90°C para dimensionar, cuando la terminal solo soporta 75°C.

💡 ¿Quieres verificar la temperatura correcta? Proporciona: corriente, tipo de aislamiento y equipo de conexión.`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "110-14(c)" },
        modo: 'explicacion_tabla'
      };
    }

    // ==========================================
    // 9. ART. 440-32 (CONDUCTORES PARA HVAC)
    // ==========================================
    if (texto.includes('440-32') || texto.includes('hvac') || texto.includes('aire acondicionado')) {
      console.log('[Profesor] Match: 440-32');
      return {
        explicacion: `📘 **Art. 440-32: Conductores para equipo de aire acondicionado (HVAC)**

🔑 **Regla principal**: Los conductores que alimentan un compresor de HVAC deben tener ampacidad no menor al **125% de la corriente de placa** (RLA).

📋 **Fórmula**: I_conductor ≥ (RLA_compresor × 1.25) + I_otros_cargas

⚠️ **Diferencia con motores generales**: HVAC usa corriente de **placa del equipo** (no Tabla 430-250).

🔧 **Ejemplo**:
- Condensadora con RLA = 30 A, ventilador = 3 A:
  • Conductor mínimo: (30A × 1.25) + 3A = 40.5 A
  • Calibre cobre THW: 8 AWG (50A) ✅

💡 ¿Quieres dimensionar conductores para HVAC? Proporciona: RLA del compresor y cargas adicionales.`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "440-32" },
        modo: 'explicacion_tabla'
      };
    }

    // ==========================================
    // 10. ART. 630 (SOLDADORAS)
    // Coincidencia con prefijo: "63" para capturar "630" truncado
    // ==========================================
    if (texto.includes('630') || texto.startsWith('63') && texto.includes('soldadora') || texto.includes('welder')) {
      console.log('[Profesor] Match: 630');
      return {
        explicacion: `📘 **Art. 630: Conductores y protecciones para equipos de soldadura**

🔑 **Regla principal**: La ampacidad se calcula aplicando un **factor multiplicador** a la corriente primaria, según el tipo de soldadora y su ciclo de trabajo.

📋 **Factores típicos para conductores**:
• Soldadora de arco (manual): 100% de I_primaria
• Soldadora de resistencia: factor según ciclo (ej: 50% ciclo → factor 0.71)

📋 **Factores para protección**:
• Soldadora de arco: hasta 200% de I_primaria
• Soldadora de resistencia: hasta 300% de I_primaria

⚠️ **Ciclo de trabajo**: Porcentaje de tiempo en 10 min que la soldadora puede operar sin sobrecalentarse.

🔧 **Ejemplo - Soldadora de arco 50A, 60% ciclo**:
• Conductor: 50A × 1.00 = 50A → 8 AWG cobre ✅
• Protección: 50A × 2.00 = 100A → interruptor 100A ✅

💡 ¿Quieres dimensionar para soldadora? Proporciona: tipo, corriente primaria y ciclo de trabajo.`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "630" },
        modo: 'explicacion_tabla'
      };
    }

    // ==========================================
    // 11. ART. 210-19(a) (CIRCUITOS RAMALES)
    // Coincidencia con prefijo: "210-1" para capturar "210-19" truncado
    // ==========================================
    if (texto.includes('210-19') || texto.includes('210-1') || texto.includes('ramal') || texto.includes('carga continua')) {
      console.log('[Profesor] Match: 210-19');
      return {
        explicacion: `📘 **Art. 210-19(a): Conductores de circuitos ramales**

🔑 **Regla principal**: Los conductores de circuitos ramales deben tener ampacidad no menor a la **carga no continua + 125% de la carga continua**.

📋 **Fórmula**: I_conductor ≥ I_no_continua + (I_continua × 1.25)

⚠️ **Definiciones**:
• Carga continua: Operación por 3 horas o más (ej: iluminación comercial)
• Carga no continua: Operación menor a 3 horas (ej: tomacorrientes)

🔧 **Ejemplo**:
- Iluminación LED 20A (continua) + tomacorrientes 10A (no continua):
  • Cálculo: 10A + (20A × 1.25) = 35A
  • Calibre cobre THW: 8 AWG (50A) ✅

💡 ¿Quieres dimensionar un circuito ramal? Proporciona: cargas continuas y no continuas en amperes.`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "210-19(a)" },
        modo: 'explicacion_tabla'
      };
    }

    // ==========================================
    // 12. ART. 215-2 (ALIMENTADORES)
    // Coincidencia con prefijo: "215" para capturar "215-2" truncado
    // ==========================================
    if (texto.includes('215-2') || texto.startsWith('215') && texto.includes('alimentador') || texto.includes('feeder')) {
      console.log('[Profesor] Match: 215-2');
      return {
        explicacion: `📘 **Art. 215-2: Conductores de alimentadores**

🔑 **Regla principal**: Los conductores de alimentadores (entre tableros) deben tener ampacidad no menor a la **carga total calculada** después de aplicar factores de demanda, más 125% de cargas continuas.

📋 **Proceso**:
1. Sumar todas las cargas conectadas
2. Aplicar factores de demanda (Art. 220)
3. Agregar 125% de cargas continuas
4. Aplicar factores de corrección si aplican

🔧 **Ejemplo**:
- Alimentador con carga calculada 150A (incluye 40A continuos):
  • Cálculo: 110A + (40A × 1.25) = 160A
  • Calibre cobre THW: 2/0 AWG (175A) ✅

💡 ¿Quieres dimensionar un alimentador? Proporciona: carga total calculada y porcentaje de carga continua.`,
        fundamento: { norma: "NOM-001-SEDE-2012", articulo: "215-2" },
        modo: 'explicacion_tabla'
      };
    }

    // ==========================================
    // FALLBACK: MENÚ DE OPCIONES
    // ==========================================
    console.log('[Profesor] No match - mostrando menú fallback');
    return {
      explicacion: "Puedo explicarte estos conceptos clave de la NOM-001-SEDE-2012:",
      temas_disponibles: [
        "🔌 250-122: Puesta a tierra de equipo (por interruptor)",
        "⚡ 250-66: Puesta a tierra del sistema (por calibre de fase)",
        "📏 310-16: Ampacidad de conductores (THW, THHN, etc.)",
        "⚙️ 430-250: Corriente a plena carga de motores",
        "🔧 430-22: Conductores para motores (regla 125%)",
        "🛡️ 430-52: Protección magnética para motores (hasta 250%)",
        "📋 240-6: Tamaños estándar de interruptores",
        "🌡️ 110-14(c): Temperatura de terminales 60/75/90°C",
        "❄️ 440-32: Conductores para HVAC (aire acondicionado)",
        "🔥 630: Equipos de soldadura (arco/resistencia)",
        "🔌 210-19(a): Circuitos ramales (cargas continuas +125%)",
        "⚡ 215-2: Alimentadores entre tableros"
      ],
      instruccion: "Escríbeme el número de artículo/tabla o el concepto, ej: '250-122', 'ampacidad' o 'motor 125%'",
      modo: 'seleccion_tema'
    };
  }
}