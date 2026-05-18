/**
 * @file data/normativas/articulo_630.js
 * @description Artículo 630 NOM-001-SEDE-2012: Equipos de soldadura eléctrica
 * @reference NEC 630 (adoptado por NOM-001)
 */

export const articulo_630 = {
  meta: {
    norma: "NOM-001-SEDE-2012",
    articulo: "630",
    titulo: "Equipos de soldadura eléctrica",
    version: "2012",
    hash_fuente: "sha256:pendiente-calculo",
    fecha_indexado: "2024-01-15T00:00:00Z",
    estado: "vigente"
  },
  
  configuracion: {
    aplica_a: "soldadora_arco_resistencia",
    base_calculo: "corriente_primaria_nominal",
    material_default: "cobre",
    carga_intermitente: true,
    requiere_ciclo_trabajo: true
  },
  
  tipos: {
    arco: {
      descripcion: "Soldadora de arco (CA, CC o CA/CC)",
      conductor: {
        factor: 1.0,
        base: "corriente_primaria_nominal",
        referencia: "630-11"
      },
      proteccion: {
        factor: 2.0,
        referencia: "630-12",
        nota: "Protección contra cortocircuito no mayor al 200% de corriente primaria"
      },
      sobrecarga: {
        interna: true,
        nota: "Carga intermitente; no requiere protección contra sobrecarga adicional"
      }
    },
    resistencia: {
      descripcion: "Soldadora de resistencia (punto, costura, proyección, topo)",
      conductor: {
        factor_base: 0.7,
        aplica_ciclo_trabajo: true,
        formula: "factor = √(ciclo_trabajo) × 0.7",
        referencia: "630-31"
      },
      proteccion: {
        factor: 3.0,
        referencia: "630-32",
        nota: "Protección contra cortocircuito no mayor al 300% de corriente primaria"
      }
    }
  },
  
  // Factores de ciclo de trabajo típicos
  ciclos_trabajo_tipicos: {
    manual: 0.2,    // Soldadura manual intermitente
    semi_automatico: 0.4,
    automatico: 0.6,
    continuo: 1.0
  },
  
  // Valores de referencia para tamaños comerciales de protecciones
  protecciones_comerciales: [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400],
  
  // Referencias cruzadas
  referencias_cruzadas: {
    '630-11': ['310-16', '110-14(c)'],
    '630-12': ['240-6'],
    '630-31': ['310-15(b)(3)(a)'], // Agrupamiento aplica si hay múltiples soldadoras
    '630-32': ['250-122'] // Puesta a tierra por interruptor
  }
};