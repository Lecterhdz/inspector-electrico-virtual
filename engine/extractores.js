/**
 * @file extractores.js
 * @description Funciones reutilizables para extraer datos de textos de usuario
 */

/**
 * Extrae calibre AWG/kcmil de un texto
 * @param {string} texto - Texto del usuario
 * @returns {string|null} Calibre extraído (ej: "10", "1/0", "250kcmil") o null
 * 
 * @example
 * extraerCalibreAWG("Mi conductor es 10 AWG") // "10"
 * extraerCalibreAWG("Puesta a tierra 1/0 AWG") // "1/0"
 * extraerCalibreAWG("Conductor 250kcmil") // "250kcmil"
 */
export const extraerCalibreAWG = (texto) => {
  if (!texto) return null;
  const t = texto.trim().toUpperCase();
  
  // Patrón 1: Número + AWG
  let match = t.match(/\b(\d{1,3})\s*AWG\b/i);
  if (match) return match[1];
  
  // Patrón 2: Fracción (1/0, 2/0, 3/0, 4/0)
  match = t.match(/\b([1-4]\/0)\s*AWG\b/i);
  if (match) return match[1];
  
  // Patrón 3: Solo número (calibre común)
  match = t.match(/\b(14|12|10|8|6|4|3|2|1)\b(?!\s*[A-Z])/);
  if (match) return match[1];
  
  // Patrón 4: kcmil
  match = t.match(/\b(\d+)\s*KCMIL\b/i);
  if (match) return `${match[1]}kcmil`;
  
  // Patrón 5: Calibre dentro de frase
  match = t.match(/(?:calibre|conductor|tierra|puesta)\s*(?:es|de|:)?\s*(\d{1,3})\s*(?:AWG)?/i);
  if (match) return match[1];
  
  return null;
};

/**
 * Extrae amperaje del interruptor de un texto
 * @param {string} texto - Texto del usuario
 * @returns {number|null} Amperaje extraído o null
 * 
 * @example
 * extraerAmperajeInterruptor("interruptor de 40A") // 40
 * extraerAmperajeInterruptor("protegido con 100A") // 100
 */
export const extraerAmperajeInterruptor = (texto) => {
  if (!texto) return null;
  const t = texto.toLowerCase();
  
  // Patrón: "interruptor de 40A" o "interruptor 40A"
  let match = t.match(/interruptor\s+(?:de\s+)?(\d+)\s*a/i);
  if (match) return parseInt(match[1]);
  
  // Patrón: "protegido con 40A"
  match = t.match(/(?:protegido|con)\s+(?:de\s+)?(\d+)\s*a/i);
  if (match) return parseInt(match[1]);
  
  // Patrón: número + A cerca de palabras clave
  match = t.match(/(\d+)\s*a.*?(?:interruptor|protecci[oó]n)/i);
  if (match) return parseInt(match[1]);
  
  return null;
};

/**
 * Detecta si el texto se refiere a puesta a tierra
 * @param {string} texto - Texto del usuario
 * @returns {boolean}
 */
export const esPuestaATierra = (texto) => {
  return /puesta a tierra|tierra equipo|conductor de tierra/i.test(texto);
};

/**
 * Extrae todos los datos de validación de un texto
 * @param {string} texto - Texto del usuario
 * @returns {Object} { calibre, interruptor, esPuestaATierra }
 */
export const extraerDatosValidacion = (texto) => {
  return {
    calibre: extraerCalibreAWG(texto),
    interruptor: extraerAmperajeInterruptor(texto),
    esPuestaATierra: esPuestaATierra(texto)
  };
};

/**
 * Extrae corriente de un texto (ej: "50A")
 * @param {string} texto - Texto del usuario
 * @returns {number|null}
 */
export const extraerCorriente = (texto) => {
  const match = texto.match(/(\d+)\s*A/i);
  return match ? parseInt(match[1]) : null;
};

/**
 * Detecta si el texto es una pregunta de validación
 * @param {string} texto - Texto del usuario
 * @returns {boolean}
 */
export const esPreguntaValidacion = (texto) => {
  return /(?:est[áa] bien|es correcto|cumple|válido|válida|verificar|revisar)/i.test(texto);
};