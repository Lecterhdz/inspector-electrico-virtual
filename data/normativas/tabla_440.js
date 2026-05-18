/**
 * @file data/normativas/articulo_440.js
 * @description Artículo 440 NOM-001-SEDE-2012: Equipos de aire acondicionado y refrigeración
 * @reference NEC 440 (adoptado por NOM-001)
 */

export const articulo_440 = {
  meta: {
    norma: "NOM-001-SEDE-2012",
    articulo: "440",
    titulo: "Equipos de aire acondicionado y refrigeración",
    version: "2012",
    hash_fuente: "sha256:pendiente-calculo",
    fecha_indexado: "2024-01-15T00:00:00Z",
    estado: "vigente"
  },
  
  configuracion: {
    aplica_a: "hvac_compresor_condensadora",
    base_calculo: "corriente_placa_equipo", // ← Clave: NO usar tablas genéricas de motores
    material_default: "cobre",
    tension_maxima: 600, // Baja tensión
    requiere_etiqueta_fabricante: true
  },
  
  reglas: {
    conductor: {
      factor_minimo: 1.25,
      base: "corriente_placa",
      referencia: "440-32",
      nota: "El conductor debe tener ampacidad no menor al 125% de la corriente nominal de placa (MCA)"
    },
    proteccion_cortocircuito: {
      factor_maximo: 1.75,
      factor_excepcion: 2.25,
      referencia: "440-22(a)",
      nota: "Máximo 175% de corriente de placa; excepción hasta 225% si la protección no permite arranque"
    },
    sobrecarga: {
      interna_equipo: true,
      referencia: "440-22(b)",
      nota: "La protección contra sobrecarga la proporciona internamente el equipo; no requiere protección adicional en el circuito derivado"
    },
    puesta_a_tierra: {
      referencia: "250-122",
      base: "capacidad_interruptor",
      nota: "El conductor de puesta a tierra se dimensiona por la capacidad del interruptor, NO por la corriente de placa del HVAC"
    }
  },
  
  // Valores de referencia para tamaños comerciales de protecciones (Art. 240-6)
  protecciones_comerciales: [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200],
  
  // Referencias cruzadas para resolución automática
  referencias_cruzadas: {
    '440-4': ['etiqueta_fabricante'],
    '440-22': ['240-6', '430-52'],
    '440-32': ['310-16', '110-14(c)'],
    '440-62': ['250-122'] // Puesta a tierra para equipos portátiles
  }
};