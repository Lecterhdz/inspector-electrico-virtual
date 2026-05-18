/**
 * @file engine/data/tablas-referencia.js
 * @description Diccionario de tablas NOM-001-SEDE-2012 con descripciones reales
 * @version 2.0 - Ampliado: +10 tablas, búsqueda semántica, exportación contextual
 * @uso: Prevenir alucinaciones de IA al explicar tablas normativas
 */

// ============================================
// CATÁLOGO COMPLETO DE TABLAS NOM-001-SEDE-2012
// ============================================

export const TABLAS_REFERENCIA = {
  // ========================================
  // CAPÍTULO 2: ALAMBRADO Y PROTECCIÓN
  // ========================================

  '240-6': {
    clave: '240-6',
    nombre: 'Tamaños estándar de protecciones contra sobrecorriente',
    descripcion: 'Valores comerciales estándar de interruptores termomagnéticos y fusibles para coordinar con ampacidad de conductores.',
    categoria: 'proteccion',
    valores_estandar: [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000],
    ejemplo: 'Cálculo da 47A → usar protección estándar de 50A (siguiente tamaño, Art. 240-4(B))',
    nota_critica: 'Se permite usar el "siguiente tamaño estándar" mayor cuando el cálculo no coincide exactamente, siempre que no exceda 800A y el conductor lo permita (Art. 240-4(B)).',
    articulo_relacionado: '240-4, 240-6',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=120'
  },

  // ========================================
  // CAPÍTULO 2: CIRCUITOS RAMALES Y ALIMENTADORES
  // ========================================

  '210-19': {
    clave: '210-19',
    nombre: 'Conductores de circuitos ramales',
    descripcion: 'Los conductores de circuitos ramales deben tener ampacidad no menor a la carga no continua + 125% de la carga continua.',
    categoria: 'circuitos',
    formula: 'I_conductor ≥ I_no_continua + (I_continua × 1.25)',
    ejemplo: 'Iluminación continua 20A + tomacorrientes 10A: 10A + (20A × 1.25) = 35A → calibre 8 AWG (50A)',
    nota_critica: 'Carga continua = operación por 3 horas o más (iluminación comercial, equipos industriales).',
    articulo_relacionado: '210-19(a), 210-20',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=70'
  },

  '215-2': {
    clave: '215-2',
    nombre: 'Conductores de alimentadores',
    descripcion: 'Los conductores de alimentadores (entre tableros) deben tener ampacidad no menor a la carga total calculada después de factores de demanda, más 125% de cargas continuas.',
    categoria: 'circuitos',
    formula: 'I_alimentador ≥ I_no_continua + (I_continua × 1.25) después de factores de demanda',
    ejemplo: 'Alimentador con carga calculada 150A (40A continuos): 110A + (40A × 1.25) = 160A → calibre 2/0 AWG (175A)',
    nota_critica: 'Aplicar factores de demanda del Art. 220 antes del cálculo.',
    articulo_relacionado: '215-2, 215-3, 220',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=80'
  },

  // ========================================
  // CAPÍTULO 2: PUESTA A TIERRA
  // ========================================

  '250-66': {
    clave: '250-66',
    nombre: 'Conductor de puesta a tierra del SISTEMA (electrodo)',
    descripcion: 'Define el calibre mínimo del conductor que conecta el sistema a tierra (electrodo), basado en el calibre del conductor de fase más grande del servicio.',
    categoria: 'puesta_tierra',
    material: ['cobre', 'aluminio'],
    valores_tipicos: {
      cobre: [
        { fase: '14-10 AWG', conductor_tierra: '8 AWG' },
        { fase: '8-6 AWG', conductor_tierra: '8 AWG' },
        { fase: '4-2 AWG', conductor_tierra: '8 AWG' },
        { fase: '1-1/0 AWG', conductor_tierra: '6 AWG' },
        { fase: '2/0-3/0 AWG', conductor_tierra: '4 AWG' },
        { fase: '4/0-250 kcmil', conductor_tierra: '2 AWG' },
        { fase: '350-500 kcmil', conductor_tierra: '1/0 AWG' }
      ]
    },
    ejemplo: 'Conductor de fase 2/0 AWG cobre → conductor de tierra mínimo 4 AWG cobre',
    nota_critica: 'Diferencia clave con 250-122: 250-66 es para SISTEMA (electrodo), 250-122 es para EQUIPO (por interruptor).',
    articulo_relacionado: '250-66, 250-122',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=150'
  },

  '250-122': {
    clave: '250-122',
    nombre: 'Calibre mínimo del conductor de puesta a tierra de EQUIPO',
    descripcion: 'Establece el calibre AWG/kcmil mínimo del conductor de puesta a tierra de equipo según la capacidad del interruptor automático de sobrecorriente que protege el circuito.',
    categoria: 'puesta_tierra',
    material: ['cobre', 'aluminio'],
    base_calculo: 'capacidad del interruptor (NO calibre del conductor de fase)',
    valores_tipicos: {
      cobre: [
        { interruptor: '15-20A', calibre: '14 AWG' },
        { interruptor: '30-60A', calibre: '10 AWG' },
        { interruptor: '100A', calibre: '8 AWG' },
        { interruptor: '200A', calibre: '6 AWG' },
        { interruptor: '400A', calibre: '3 AWG' },
        { interruptor: '600A', calibre: '2 AWG' },
        { interruptor: '800A', calibre: '1 AWG' },
        { interruptor: '1000A', calibre: '1/0 AWG' }
      ],
      aluminio: [
        { interruptor: '15-20A', calibre: '12 AWG' },
        { interruptor: '30-60A', calibre: '8 AWG' },
        { interruptor: '100A', calibre: '6 AWG' },
        { interruptor: '200A', calibre: '4 AWG' },
        { interruptor: '400A', calibre: '2 AWG' }
      ]
    },
    ejemplo: 'Interruptor 40A → 10 AWG cobre | Interruptor 100A → 8 AWG cobre',
    nota_critica: '⚠️ REGLA CRÍTICA (Art. 250-122(B)): Si el conductor de fase se aumentó por caída de tensión, el conductor de puesta a tierra también debe aumentarse en la MISMA PROPORCIÓN.',
    articulo_relacionado: '250-122, 250-122(B)',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=152'
  },

  // ========================================
  // CAPÍTULO 3: CONDUCTORES (AMPACIDAD)
  // ========================================

  '310-16': {
    clave: '310-16',
    nombre: 'Ampacidades de conductores aislados (0-2000V, 60-90°C)',
    descripcion: 'Corriente máxima permisible (ampacidad) para conductores de cobre y aluminio con aislamientos THW, THHN, XHHW, etc., a 30°C en aire, sin agrupamiento.',
    categoria: 'conductores',
    material: ['cobre', 'aluminio'],
    aislamientos_soportados: ['THW', 'THHN', 'XHHW', 'USE', 'RHW'],
    valores_tipicos_cobre_thw: [
      { calibre: '14 AWG', ampacidad_60C: '15A', ampacidad_75C: '20A', ampacidad_90C: '25A' },
      { calibre: '12 AWG', ampacidad_60C: '20A', ampacidad_75C: '25A', ampacidad_90C: '30A' },
      { calibre: '10 AWG', ampacidad_60C: '30A', ampacidad_75C: '35A', ampacidad_90C: '40A' },
      { calibre: '8 AWG', ampacidad_60C: '40A', ampacidad_75C: '50A', ampacidad_90C: '55A' },
      { calibre: '6 AWG', ampacidad_60C: '55A', ampacidad_75C: '65A', ampacidad_90C: '75A' },
      { calibre: '4 AWG', ampacidad_60C: '70A', ampacidad_75C: '85A', ampacidad_90C: '95A' },
      { calibre: '3 AWG', ampacidad_60C: '85A', ampacidad_75C: '100A', ampacidad_90C: '110A' },
      { calibre: '2 AWG', ampacidad_60C: '95A', ampacidad_75C: '115A', ampacidad_90C: '130A' },
      { calibre: '1 AWG', ampacidad_60C: '110A', ampacidad_75C: '130A', ampacidad_90C: '150A' },
      { calibre: '1/0 AWG', ampacidad_60C: '125A', ampacidad_75C: '150A', ampacidad_90C: '170A' },
      { calibre: '2/0 AWG', ampacidad_60C: '145A', ampacidad_75C: '175A', ampacidad_90C: '195A' },
      { calibre: '3/0 AWG', ampacidad_60C: '165A', ampacidad_75C: '200A', ampacidad_90C: '225A' },
      { calibre: '4/0 AWG', ampacidad_60C: '195A', ampacidad_75C: '230A', ampacidad_90C: '260A' }
    ],
    ejemplo: '8 AWG cobre THW, 75°C → 50A | 3 AWG cobre THW, 75°C → 100A',
    nota_critica: '⚠️ Factores de corrección por temperatura (Tabla 310-19) y agrupamiento (Tabla 310-15(b)(3)(a)) deben aplicarse según condiciones de instalación. Ver Art. 110-14(c) para temperatura de terminales.',
    articulo_relacionado: '310-16, 310-15, 310-19, 110-14(c)',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=180'
  },

  '310-15(b)(3)(a)': {
    clave: '310-15(b)(3)(a)',
    nombre: 'Factores de ajuste por agrupamiento de conductores',
    descripcion: 'Cuando más de 3 conductores portadores de corriente son instalados en una misma canalización, su ampacidad debe reducirse aplicando un factor de ajuste.',
    categoria: 'conductores',
    valores: [
      { conductores: '1-3', factor: '1.00', nota: 'Sin reducción' },
      { conductores: '4-6', factor: '0.80', nota: '20% reducción' },
      { conductores: '7-9', factor: '0.70', nota: '30% reducción' },
      { conductores: '10-20', factor: '0.50', nota: '50% reducción' },
      { conductores: '21-30', factor: '0.45', nota: '55% reducción' },
      { conductores: '31-40', factor: '0.40', nota: '60% reducción' },
      { conductores: '41+', factor: '0.35', nota: '65% reducción' }
    ],
    formula: 'I_ajustada = I_base × factor_agrupamiento',
    ejemplo: '4 conductores en tubería, I_base = 50A → I_ajustada = 50A × 0.80 = 40A',
    nota_critica: 'El neutro que solo lleva corriente desbalanceada NO cuenta como conductor portador de corriente para este ajuste (Art. 310-15(b)(3)(a) Excepción).',
    articulo_relacionado: '310-15, 310-16',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=185'
  },

  '310-19': {
    clave: '310-19',
    nombre: 'Factores de corrección por temperatura ambiente',
    descripcion: 'Cuando la temperatura ambiente excede los 30°C, la ampacidad de los conductores debe reducirse aplicando un factor de corrección.',
    categoria: 'conductores',
    valores: [
      { temperatura: '30°C', factor: '1.00' },
      { temperatura: '35°C', factor: '0.94' },
      { temperatura: '40°C', factor: '0.88' },
      { temperatura: '45°C', factor: '0.82' },
      { temperatura: '50°C', factor: '0.75' },
      { temperatura: '55°C', factor: '0.67' },
      { temperatura: '60°C', factor: '0.58' }
    ],
    formula: 'I_ajustada = I_base × factor_temperatura',
    ejemplo: 'I_base = 50A, temperatura ambiente 40°C → I_ajustada = 50A × 0.88 = 44A',
    nota_critica: 'Aplicar DESPUÉS del factor de agrupamiento, o combinarlos: I_ajustada = I_base / (factor_temp × factor_agrup)',
    articulo_relacionado: '310-16, 310-15',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=190'
  },

  // ========================================
  // CAPÍTULO 4: EQUIPOS DE USO GENERAL
  // ========================================

  '430-250': {
    clave: '430-250',
    nombre: 'Corriente a plena carga de motores de CA (monofásicos y trifásicos)',
    descripcion: 'Corriente nominal (A) de motores de inducción tipo jaula de ardilla, para dimensionar conductores (125%) y protecciones (250%) según Art. 430.',
    categoria: 'motores',
    tipo_motor: ['monofásico', 'trifásico'],
    valores_tipicos_trifasico_440v: [
      { hp: '10 HP', corriente: '14 A' },
      { hp: '20 HP', corriente: '27 A' },
      { hp: '25 HP', corriente: '34 A' },
      { hp: '30 HP', corriente: '40 A' },
      { hp: '40 HP', corriente: '52 A' },
      { hp: '50 HP', corriente: '65 A' },
      { hp: '60 HP', corriente: '77 A' },
      { hp: '75 HP', corriente: '96 A' },
      { hp: '100 HP', corriente: '124 A' },
      { hp: '125 HP', corriente: '156 A' },
      { hp: '150 HP', corriente: '180 A' },
      { hp: '200 HP', corriente: '240 A' }
    ],
    ejemplo: 'Motor 75 HP, 440V, trifásico → 96 A | Motor 10 HP, 230V, monofásico → 50 A',
    nota_critica: '⚠️ Usar valores de placa del motor cuando estén disponibles (Art. 430-6(A)). Esta tabla es para diseño preliminar cuando no se tienen datos del fabricante.',
    articulo_relacionado: '430-6, 430-22, 430-52, 430-250',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=250'
  },

  '430-22': {
    clave: '430-22',
    nombre: 'Conductores para un motor (regla 125%)',
    descripcion: 'Los conductores que alimentan un solo motor deben tener ampacidad no menor al 125% de la corriente a plena carga del motor.',
    categoria: 'motores',
    formula: 'I_conductor ≥ I_motor × 1.25',
    ejemplo: 'Motor 50 HP, 440V → I_placa = 65A → Conductor mínimo: 65A × 1.25 = 81.25A → Calibre 4 AWG (85A)',
    nota_critica: 'Aplicar factores de corrección por temperatura y agrupamiento DESPUÉS del 125%.',
    articulo_relacionado: '430-22, 430-250',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=245'
  },

  '430-52': {
    clave: '430-52',
    nombre: 'Protección magnética para motores (hasta 250%)',
    descripcion: 'La protección contra cortocircuito para motores puede ser hasta el 250% de la corriente a plena carga para permitir el arranque.',
    categoria: 'motores',
    formula: 'I_proteccion_magnetica ≤ I_motor × 2.5',
    ejemplo: 'Motor 75 HP, 440V → I_placa = 96A → Protección magnética máxima: 96A × 2.5 = 240A',
    nota_critica: 'Diferencia clave: Protección térmica (sobrecarga) = 115-125% (Art. 430-32), Protección magnética (cortocircuito) = hasta 250% (Art. 430-52).',
    articulo_relacionado: '430-52, 430-32',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=248'
  },

  // ========================================
  // CAPÍTULO 4: HVAC (Artículo 440)
  // ========================================

  '440-32': {
    clave: '440-32',
    nombre: 'Conductores para equipo de aire acondicionado (HVAC)',
    descripcion: 'Los conductores que alimentan un compresor de HVAC deben tener ampacidad no menor al 125% de la corriente de placa (RLA) más la corriente de otros cargas.',
    categoria: 'hvac',
    formula: 'I_conductor ≥ (RLA_compresor × 1.25) + I_otras_cargas',
    ejemplo: 'Condensadora RLA=30A + ventilador=3A → (30A × 1.25) + 3A = 40.5A → Calibre 8 AWG (50A)',
    nota_critica: 'Usar corriente de placa del EQUIPO (MCA), NO tablas genéricas de motores.',
    articulo_relacionado: '440-32, 440-22',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=280'
  },

  '440-22': {
    clave: '440-22',
    nombre: 'Protección contra cortocircuito para HVAC',
    descripcion: 'La protección para HVAC puede ser hasta el 175% de la corriente de placa (excepción hasta 225% si el equipo no arranca).',
    categoria: 'hvac',
    formula: 'I_proteccion_max = I_placa × 1.75 (hasta 2.25 excepcionalmente)',
    ejemplo: 'Corriente placa HVAC 30A → Protección máxima: 30A × 1.75 = 52.5A → Interruptor 50A comercial',
    nota_critica: 'La protección contra sobrecarga la proporciona internamente el equipo (Art. 440-22(b)).',
    articulo_relacionado: '440-22, 440-32',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=278'
  },

  // ========================================
  // CAPÍTULO 6: SOLDADORAS (Artículo 630)
  // ========================================

  '630-11': {
    clave: '630-11',
    nombre: 'Conductores para soldadoras de arco',
    descripcion: 'Para soldadoras de arco, los conductores deben tener ampacidad no menor al 100% de la corriente primaria nominal.',
    categoria: 'soldadoras',
    formula: 'I_conductor ≥ I_primaria × 1.0',
    ejemplo: 'Soldadora arco 50A primaria → Conductor 50A → Calibre 8 AWG',
    nota_critica: 'Carga intermitente, no requiere protección contra sobrecarga adicional.',
    articulo_relacionado: '630-11, 630-12',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=350'
  },

  '630-12': {
    clave: '630-12',
    nombre: 'Protección para soldadoras de arco',
    descripcion: 'La protección contra cortocircuito para soldadoras de arco no debe exceder el 200% de la corriente primaria nominal.',
    categoria: 'soldadoras',
    formula: 'I_proteccion ≤ I_primaria × 2.0',
    ejemplo: 'Soldadora arco 50A primaria → Protección máxima: 100A → Interruptor 100A',
    nota_critica: 'Aplican factores de ciclo de trabajo para soldadoras de resistencia (Art. 630-31).',
    articulo_relacionado: '630-12, 630-31',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=352'
  },

  '630-31': {
    clave: '630-31',
    nombre: 'Conductores para soldadoras de resistencia',
    descripcion: 'Para soldadoras de resistencia, el conductor se dimensiona multiplicando la corriente primaria por √(ciclo_trabajo) × 0.7.',
    categoria: 'soldadoras',
    formula: 'I_conductor = I_primaria × √(ciclo_trabajo) × 0.7',
    ejemplo: 'Soldadora resistencia 100A primaria, ciclo 40%: I = 100A × √0.4 × 0.7 = 44.2A → Calibre 8 AWG',
    nota_critica: 'La protección para soldadoras de resistencia es hasta 300% de I_primaria (Art. 630-32).',
    articulo_relacionado: '630-31, 630-32',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=355'
  },

  // ========================================
  // CAPÍTULO 1: GENERAL (TERMINALES)
  // ========================================

  '110-14(c)': {
    clave: '110-14(c)',
    nombre: 'Limitación de temperatura en terminales de equipos',
    descripcion: 'Las terminales de los equipos determinan la columna de temperatura a usar en la Tabla 310-16.',
    categoria: 'general',
    reglas: [
      'Circuitos ≤ 100A: Default 60°C (usar 75°C solo si terminales están listadas)',
      'Circuitos > 100A: Default 75°C (usar 90°C solo si terminales están listadas)'
    ],
    ejemplo: 'Circuito 80A con conductor THHN (90°C) → Usar columna 75°C por default, a menos que terminales soporten 90°C',
    nota_critica: '⚠️ Error común: Usar ampacidad de 90°C cuando la terminal solo soporta 75°C → sobrecalentamiento.',
    articulo_relacionado: '110-14(c), 310-16',
    url_nom: 'https://www.gob.mx/cms/uploads/attachment/file/322804/NOM-001-SEDE-2012.pdf#page=35'
  }
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Busca una tabla por número o nombre parcial
 * @param {string} query - Ej: "250-122", "puesta a tierra", "ampacidad"
 * @returns {Object|null} Datos de la tabla o null si no encuentra
 */
export const buscarTabla = (query) => {
  if (!query) return null;
  
  const q = query.toLowerCase().trim();
  
  // Búsqueda directa por clave (ej: "250-122")
  if (TABLAS_REFERENCIA[q]) return TABLAS_REFERENCIA[q];
  
  // Búsqueda por contenido (nombre, descripción, ejemplo, artículo, categoría)
  for (const [key, data] of Object.entries(TABLAS_REFERENCIA)) {
    const searchable = [
      data.nombre,
      data.descripcion,
      data.ejemplo,
      data.articulo_relacionado,
      data.categoria,
      key
    ].join(' ').toLowerCase();
    
    // Búsqueda parcial (permite "ampacidad" encontrar "Ampacidades")
    if (searchable.includes(q) || q.split(' ').some(term => searchable.includes(term))) {
      return { clave: key, ...data };
    }
  }
  
  return null;
};

/**
 * Lista todas las tablas por categoría
 * @param {string} categoria - Opcional: 'proteccion', 'puesta_tierra', 'conductores', 'motores', 'hvac', 'soldadoras', 'general', 'circuitos'
 * @returns {Array} Lista de tablas en la categoría
 */
export const listarTablasPorCategoria = (categoria = null) => {
  const tablas = Object.entries(TABLAS_REFERENCIA).map(([key, data]) => ({
    clave: key,
    nombre: data.nombre,
    categoria: data.categoria
  }));
  
  if (categoria) {
    return tablas.filter(t => t.categoria === categoria);
  }
  
  return tablas;
};

/**
 * Obtiene todas las categorías disponibles
 * @returns {Array} Lista de categorías únicas
 */
export const obtenerCategorias = () => {
  const categorias = new Set();
  for (const data of Object.values(TABLAS_REFERENCIA)) {
    if (data.categoria) categorias.add(data.categoria);
  }
  return Array.from(categorias).sort();
};

/**
 * Genera resumen técnico de una tabla para inyectar en prompt de IA
 * @param {string} tablaClave - Ej: "250-122"
 * @returns {string} Texto formateado para contexto de IA
 */
export const generarContextoTabla = (tablaClave) => {
  const tabla = TABLAS_REFERENCIA[tablaClave];
  if (!tabla) return '';
  
  let contexto = `[CONTEXTO TÉCNICO - TABLA ${tabla.clave}]\n`;
  contexto += `NOMBRE: ${tabla.nombre}\n`;
  contexto += `DESCRIPCIÓN: ${tabla.descripcion}\n`;
  
  if (tabla.formula) contexto += `FÓRMULA: ${tabla.formula}\n`;
  if (tabla.ejemplo) contexto += `EJEMPLO: ${tabla.ejemplo}\n`;
  if (tabla.nota_critica) contexto += `NOTA CRÍTICA: ${tabla.nota_critica}\n`;
  if (tabla.articulo_relacionado) contexto += `ARTÍCULO: ${tabla.articulo_relacionado}\n`;
  
  contexto += `[FIN CONTEXTO - Usa esta información para responder con precisión técnica]`;
  return contexto;
};

/**
 * Genera contexto completo para todas las tablas de una categoría
 * @param {string} categoria - Categoría (ej: 'puesta_tierra', 'conductores')
 * @returns {string} Contexto combinado de todas las tablas de la categoría
 */
export const generarContextoCategoria = (categoria) => {
  const tablas = listarTablasPorCategoria(categoria);
  if (tablas.length === 0) return '';
  
  let contexto = `[CONTEXTO TÉCNICO - CATEGORÍA: ${categoria.toUpperCase()}]\n`;
  for (const tabla of tablas) {
    contexto += generarContextoTabla(tabla.clave) + '\n';
  }
  contexto += `[FIN CONTEXTO]`;
  return contexto;
};

// Exportación por defecto
export default {
  TABLAS_REFERENCIA,
  buscarTabla,
  listarTablasPorCategoria,
  obtenerCategorias,
  generarContextoTabla,
  generarContextoCategoria
};