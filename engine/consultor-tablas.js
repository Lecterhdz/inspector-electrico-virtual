/**
 * @file engine/consultor-tablas.js
 * @description Motor determinístico de consultas a tablas normativas NOM-001-SEDE-2012
 * @version 3.1 - Corregido: motor con tensión original y protección térmica directa
 */

import { CalibreConverter } from '../utils/conversion-calibres.js';
import { tabla_250_122 } from '../data/normativas/tabla_250_122.js';

// Tabla 310-16 - Ampacidad de conductores (cobre, THW, 75°C)
// Valores según NOM-001-SEDE-2012
const AMPACIDADES_CABLE = {
  cobre: {
    '14': 20,
    '12': 25,
    '10': 35,
    '8': 50,
    '6': 65,
    '4': 85,
    '3': 100,
    '2': 115,
    '1': 130,
    '1/0': 150,
    '2/0': 175,
    '3/0': 200,
    '4/0': 230
  },
  aluminio: {
    '12': 20,
    '10': 30,
    '8': 40,
    '6': 50,
    '4': 65,
    '2': 75,
    '1/0': 100,
    '2/0': 115,
    '3/0': 130,
    '4/0': 155
  }
};

// Factores de corrección por temperatura (Tabla 310-19)
const FACTORES_TEMPERATURA = {
  30: 1.00,
  35: 0.94,
  40: 0.88,
  45: 0.82,
  50: 0.75,
  55: 0.67,
  60: 0.58
};

// Factores de corrección por agrupamiento (Tabla 310-15(b)(3)(a))
const FACTORES_AGRUPAMIENTO = [
  { min: 1, max: 3, factor: 1.00 },
  { min: 4, max: 6, factor: 0.80 },
  { min: 7, max: 9, factor: 0.70 },
  { min: 10, max: 20, factor: 0.50 },
  { min: 21, max: 30, factor: 0.45 },
  { min: 31, max: Infinity, factor: 0.40 }
];

// Función para obtener factor de agrupamiento
const getFactorAgrupamiento = (cantidad) => {
  const rango = FACTORES_AGRUPAMIENTO.find(r => cantidad >= r.min && cantidad <= r.max);
  return rango ? rango.factor : 1.00;
};

export class ConsultorTablas {
  
  /**
   * Consulta Tabla 250-122 (Puesta a tierra de equipo)
   */
  static consultarPuestaATierra({ interruptor_A, material = 'cobre', ajuste_caida = null }) {
    const tabla = tabla_250_122;
    if (!tabla.valores[material]) {
      return { error: `Material "${material}" no soportado` };
    }
    
    const capacidades = Object.keys(tabla.valores[material]).map(Number).sort((a,b) => a-b);
    const capacidad_aplicable = capacidades.find(c => c >= interruptor_A) || capacidades[capacidades.length-1];
    const calibre_base = tabla.valores[material][capacidad_aplicable];
    
    let resultado = {
      calibre: calibre_base,
      base: calibre_base,
      interruptor_aplicado: capacidad_aplicable,
      material,
      nota: `Calibre base según Tabla 250-122 para interruptor ${capacidad_aplicable}A`,
      fundamento: { norma: tabla.meta.norma, articulo: tabla.meta.articulo, version: tabla.meta.version }
    };
    
    if (ajuste_caida && tabla.configuracion?.ajuste_caida_tension?.habilitado) {
      const { seccion_fase_base_mm2, seccion_fase_ajustada_mm2 } = ajuste_caida;
      const factor = seccion_fase_ajustada_mm2 / seccion_fase_base_mm2;
      const calibre_ajustado = CalibreConverter.ajustarPorFactor(calibre_base, factor);
      
      resultado = {
        ...resultado,
        calibre: calibre_ajustado,
        factor_ajuste: parseFloat(factor.toFixed(2)),
        nota: `Ajustado por caída de tensión (Art. 250-122(B)): factor ${factor.toFixed(2)}x`
      };
    }
    
    return resultado;
  }
  
  /**
   * Consulta Tabla 310-16 (Ampacidad de conductores)
   */
  static consultarAmpacidad({ 
    corriente_requerida, 
    material = 'cobre', 
    tipo_aislamiento = 'THW', 
    temperatura_ambiente = 30,
    conductores_agrupados = 3,
    temperatura_terminales = 75
  }) {
    if (!AMPACIDADES_CABLE[material]) {
      return { 
        error: `Material "${material}" no soportado. Usar 'cobre' o 'aluminio'`,
        calibre: '8',
        ampacidad_base: 50,
        nota: 'Valor estimado - material no reconocido'
      };
    }
    
    const ampacidades = AMPACIDADES_CABLE[material];
    
    let factorTemp = 1.00;
    if (temperatura_ambiente > 30) {
      const temps = Object.keys(FACTORES_TEMPERATURA).map(Number).sort((a,b) => a-b);
      const tempAplicable = temps.filter(t => t <= temperatura_ambiente).pop() || 30;
      factorTemp = FACTORES_TEMPERATURA[tempAplicable] || 1.00;
    }
    
    const factorAgrup = getFactorAgrupamiento(conductores_agrupados);
    const corrienteAjustada = corriente_requerida / (factorTemp * factorAgrup);
    
    let calibreSeleccionado = null;
    let ampacidadBase = null;
    
    const calibresOrdenados = Object.entries(ampacidades).sort((a, b) => a[1] - b[1]);
    
    for (const [calibre, amp] of calibresOrdenados) {
      if (amp >= corrienteAjustada) {
        calibreSeleccionado = calibre;
        ampacidadBase = amp;
        break;
      }
    }
    
    if (!calibreSeleccionado) {
      const ultimo = calibresOrdenados[calibresOrdenados.length - 1];
      calibreSeleccionado = ultimo[0];
      ampacidadBase = ultimo[1];
    }
    
    const ampacidadAjustada = ampacidadBase * factorTemp * factorAgrup;
    const cumple = ampacidadAjustada >= corriente_requerida;
    const calibreDisplay = calibreSeleccionado.includes('/') ? calibreSeleccionado : calibreSeleccionado;
    
    return {
      calibre: calibreDisplay,
      calibre_awg: calibreDisplay,
      ampacidad_base: ampacidadBase,
      ampacidad_ajustada: parseFloat(ampacidadAjustada.toFixed(1)),
      cumple: cumple,
      factores_aplicados: {
        temperatura: { valor: temperatura_ambiente, factor: factorTemp },
        agrupamiento: { cantidad: conductores_agrupados, factor: factorAgrup }
      },
      nota: cumple 
        ? `✅ Calibre ${calibreDisplay} AWG cumple con ${corriente_requerida}A (base ${ampacidadBase}A × ${(factorTemp*factorAgrup).toFixed(2)} = ${ampacidadAjustada.toFixed(1)}A)`
        : `⚠️ Calibre ${calibreDisplay} AWG NO cumple. Considere calibre superior o conductores en paralelo.`,
      fundamento: { 
        norma: "NOM-001-SEDE-2012", 
        articulo: "Tabla 310-16",
        temperatura: "Art. 110-14(c)",
        agrupamiento: "Tabla 310-15(b)(3)(a)"
      }
    };
  }
  
  /**
   * Consulta Tabla 430-250 (Corriente a placa de motores) - CORREGIDO
   */
  static consultarMotor({ hp, tension_v, fases = 3 }) {
    const MOTORES_TRIFASICOS = {
      0.5: { 230: 2.2, 460: 1.1, 575: 0.9 },
      1: { 230: 4.2, 460: 2.1, 575: 1.7 },
      2: { 230: 6.8, 460: 3.4, 575: 2.7 },
      3: { 230: 9.6, 460: 4.8, 575: 3.8 },
      5: { 230: 15.2, 460: 7.6, 575: 6.1 },
      7.5: { 230: 22, 460: 11, 575: 9 },
      10: { 230: 28, 460: 14, 575: 11 },
      15: { 230: 42, 460: 21, 575: 17 },
      20: { 230: 54, 460: 27, 575: 22 },
      25: { 230: 68, 460: 34, 575: 27 },
      30: { 230: 80, 460: 40, 575: 32 },
      40: { 230: 104, 460: 52, 575: 42 },
      50: { 230: 130, 460: 65, 575: 52 },
      60: { 460: 77, 575: 62 },
      75: { 460: 96, 575: 77 },
      100: { 460: 124, 575: 99 },
      125: { 460: 156, 575: 125 },
      150: { 460: 180, 575: 144 },
      200: { 460: 240, 575: 192 }
    };
    
    const MOTORES_MONOFASICOS = {
      0.5: { 115: 9.8, 230: 4.9 },
      1: { 115: 16, 230: 8 },
      1.5: { 115: 20, 230: 10 },
      2: { 115: 24, 230: 12 },
      3: { 230: 17 },
      5: { 230: 28 },
      7.5: { 230: 40 },
      10: { 230: 50 }
    };
    
    const tabla = fases === 1 ? MOTORES_MONOFASICOS : MOTORES_TRIFASICOS;
    const motor = tabla[hp];
    
    if (!motor) {
      return {
        error: `Motor de ${hp} HP no encontrado en Tabla 430-250`,
        corriente_estimada: null,
        nota: "Verifique que los HP sean correctos o consulte datos del fabricante"
      };
    }
    
    const tensiones = Object.keys(motor).map(Number).sort((a,b) => a-b);
    let tensionAplicable = tensiones.find(t => t >= tension_v);
    if (!tensionAplicable && tensiones.length > 0) {
      tensionAplicable = tensiones[tensiones.length - 1];
    }
    
    const corriente = motor[tensionAplicable];
    
    // Usar la tensión original del usuario para mostrar
    const tensionMostrada = tension_v;
    
    return {
      hp: hp,
      tension: tensionMostrada,
      fases: fases,
      corriente_placa: corriente,
      proteccion_termica: parseFloat((corriente * 1.25).toFixed(1)),
      proteccion_magnetica: parseFloat((corriente * 2.5).toFixed(1)),
      nota: `Según Tabla 430-250 NOM-001-SEDE-2012`,
      fundamento: { norma: "NOM-001-SEDE-2012", articulo: "Tabla 430-250" }
    };
  }
  
  // ============================================
  // MÉTODOS PARA EQUIPOS ESPECIALES (HVAC + SOLDADORAS)
  // ============================================

  /**
   * Calcula conductor y protección para equipos HVAC según Art. 440
   */
  static consultarHVAC({ corriente_placa, material = 'cobre', tension = 440 }) {
    if (!corriente_placa || corriente_placa <= 0) {
      return { error: "La corriente de placa debe ser un valor positivo" };
    }
    
    const corriente_conductor = corriente_placa * 1.25;
    const proteccion_175 = corriente_placa * 1.75;
    const proteccion_225 = corriente_placa * 2.25;
    
    const protecciones_comerciales = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200];
    const proteccion_sugerida_175 = protecciones_comerciales.find(p => p >= proteccion_175) || protecciones_comerciales[protecciones_comerciales.length - 1];
    const proteccion_sugerida_225 = protecciones_comerciales.find(p => p >= proteccion_225) || protecciones_comerciales[protecciones_comerciales.length - 1];
    
    return {
      corriente_placa: corriente_placa,
      corriente_conductor_minima: parseFloat(corriente_conductor.toFixed(1)),
      proteccion_maxima_175: parseFloat(proteccion_175.toFixed(1)),
      proteccion_maxima_225: parseFloat(proteccion_225.toFixed(1)),
      proteccion_comercial_sugerida_175: proteccion_sugerida_175,
      proteccion_comercial_sugerida_225: proteccion_sugerida_225,
      material: material,
      nota: "Art. 440 NOM-001-SEDE-2012: usar corriente de placa del equipo (MCA), NO tablas genéricas de motores.",
      fundamento: { 
        norma: "NOM-001-SEDE-2012", 
        articulo: "440",
        subarticulos: ["440-4", "440-22(a)", "440-32"]
      }
    };
  }

  /**
   * Calcula conductor y protección para soldadoras según Art. 630
   */
  static consultarSoldadora({ tipo, corriente_primaria, ciclo_trabajo = null, material = 'cobre' }) {
    if (!corriente_primaria || corriente_primaria <= 0) {
      return { error: "La corriente primaria debe ser un valor positivo" };
    }
    
    if (!['arco', 'resistencia'].includes(tipo)) {
      return { error: "Tipo no reconocido: use 'arco' o 'resistencia'" };
    }
    
    if (tipo === 'resistencia') {
      if (ciclo_trabajo === null) {
        return { 
          error: "Para soldadoras de resistencia, especifique ciclo_trabajo (ej: 0.4 para 40%)",
          ciclos_tipicos: { manual: 0.2, semi_automatico: 0.4, automatico: 0.6, continuo: 1.0 }
        };
      }
      if (ciclo_trabajo < 0.1 || ciclo_trabajo > 1.0) {
        return { error: "Ciclo de trabajo debe estar entre 0.1 y 1.0" };
      }
    }
    
    let resultado;
    
    if (tipo === 'arco') {
      const corriente_conductor = corriente_primaria;
      const proteccion = corriente_primaria * 2.0;
      const protecciones_comerciales = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300];
      const proteccion_comercial = protecciones_comerciales.find(p => p >= proteccion) || protecciones_comerciales[protecciones_comerciales.length - 1];
      
      resultado = {
        tipo: 'arco',
        corriente_primaria: corriente_primaria,
        conductor_factor: 1.0,
        proteccion_factor: 2.0,
        corriente_conductor: parseFloat(corriente_conductor.toFixed(1)),
        proteccion_calculada: parseFloat(proteccion.toFixed(1)),
        proteccion_comercial_sugerida: proteccion_comercial,
        material: material,
        fundamento: { 
          norma: "NOM-001-SEDE-2012", 
          articulo: "630",
          subarticulos: ["630-11", "630-12"]
        }
      };
      
    } else if (tipo === 'resistencia') {
      const factor_conductor = Math.sqrt(ciclo_trabajo) * 0.7;
      const corriente_conductor = corriente_primaria * factor_conductor;
      const proteccion = corriente_primaria * 3.0;
      const protecciones_comerciales = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400];
      const proteccion_comercial = protecciones_comerciales.find(p => p >= proteccion) || protecciones_comerciales[protecciones_comerciales.length - 1];
      
      resultado = {
        tipo: 'resistencia',
        corriente_primaria: corriente_primaria,
        ciclo_trabajo: ciclo_trabajo,
        conductor_factor: parseFloat(factor_conductor.toFixed(3)),
        proteccion_factor: 3.0,
        corriente_conductor: parseFloat(corriente_conductor.toFixed(1)),
        proteccion_calculada: parseFloat(proteccion.toFixed(1)),
        proteccion_comercial_sugerida: proteccion_comercial,
        material: material,
        nota: `Factor de conductor: √(${ciclo_trabajo}) × 0.7 = ${factor_conductor.toFixed(3)}`,
        fundamento: { 
          norma: "NOM-001-SEDE-2012", 
          articulo: "630",
          subarticulos: ["630-31", "630-32"]
        }
      };
    }
    
    resultado.nota_puesta_a_tierra = "El conductor de puesta a tierra se dimensiona por la capacidad del interruptor (Tabla 250-122).";
    
    return resultado;
  }

  /**
   * Helper: Encuentra el tamaño comercial de protección más cercano (Art. 240-6)
   */
  static _proteccionComercial(valor_calculado, permitir_siguiente = true) {
    const tamanos_estandar = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500];
    const encontrado = tamanos_estandar.find(t => t >= valor_calculado);
    if (encontrado) return encontrado;
    if (permitir_siguiente) return tamanos_estandar[tamanos_estandar.length - 1];
    return null;
  }
}