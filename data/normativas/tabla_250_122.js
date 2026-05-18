// inspector/data/normativas/tabla_250_122.js
export const tabla_250_122 = {
  meta: {
    norma: "NOM-001-SEDE-2012",
    articulo: "250-122",
    titulo: "Conductores de puesta a tierra de equipo",
    version: "2012",
    hash_fuente: "sha256:pendiente-de-calculo",
    fecha_indexado: "2024-01-15T00:00:00Z"
  },
  configuracion: {
    aplica_a: "conductor_puesta_a_tierra_equipo",
    base_calculo: "capacidad_interruptor",
    material_default: "cobre",
    ajuste_caida_tension: {
      habilitado: true,
      regla: "Art. 250-122(B): si el conductor de fase se aumenta por caída de tensión, el de puesta a tierra debe aumentarse en la misma proporción",
      formula: "S_puesta_a_tierra_ajustada = S_base × (S_fase_ajustada / S_fase_base)"
    }
  },
  valores: {
    cobre: {
      15: '14', 20: '12', 30: '10', 40: '10', 60: '10',
      100: '8', 200: '6', 300: '4', 400: '3', 600: '2',
      800: '1', 1000: '1/0', 1200: '2/0', 1600: '3/0', 2000: '4/0',
      2500: '250kcmil', 3000: '350kcmil', 4000: '400kcmil',
      5000: '500kcmil', 6000: '600kcmil'
    },
    aluminio: {
      15: '12', 20: '10', 30: '8', 40: '8', 60: '8',
      100: '6', 200: '4', 300: '2', 400: '1', 600: '1/0',
      800: '2/0', 1000: '3/0', 1200: '4/0', 1600: '250kcmil'
    }
  }
};