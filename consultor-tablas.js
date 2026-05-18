/**
 * @file engine/consultor-tablas.js
 * @description Motor determinístico de consultas a tablas normativas NOM-001-SEDE-2012
 * @version 3.0 - Integración completa: Tablas 250-122, 310-16, 430-250 + HVAC (440) + Soldadoras (630)
 */

import { CalibreConverter } from '../utils/conversion-calibres.js';
import { tabla_250_122 } from '../data/normativas/tabla_250_122.js';
import { tabla_310_16 } from '../data/normativas/tabla_310_16.js';
import { tabla_430_250 } from '../data/normativas/tabla_430_250.js';
import { getFactorAgrupamiento } from '../data/normativas/factores-agrupamiento.js';
import { ConductoresParalelo } from './logica-paralelo.js';
import { articulo_440 } from '../data/normativas/articulo_440.js';
import { articulo_630 } from '../data/normativas/articulo_630.js';

export class ConsultorTablas {
  
  // Exportar tablas para acceso externo
  static tablas = {
    '250-122': tabla_250_122,
    '310-16': tabla_310_16,
    '430-250': tabla_430_250,
    '440': articulo_440,
    '630': articulo_630
  };
  
  static utils = {
    conversion: CalibreConverter,
    agrupamiento: getFactorAgrupamiento,
    paralelo: ConductoresParalelo
  };
  
  /**
   * Regla 110-14(c): Temperatura de terminales
   * @param {number} corriente - Corriente del circuito en Amperes
   * @param {Object} opciones - { terminales_75C, terminales_90C }
   * @returns {number} Temperatura en °C (60, 75 o 90)
   */
  static aplicarRegla110_14c(corriente, { terminales_75C = false, terminales_90C = false } = {}) {
    if (corriente <= 100) {
      return terminales_75C ? 75 : 60;
    } else {
      return terminales_90C ? 90 : 75;
    }
  }
  
  // ============================================
  // TABLA 250-122: PUESTA A TIERRA
  // ============================================
  
  /**
   * Consulta Tabla 250-122 con ajuste por caída de tensión (Art. 250-122(B))
   * @param {Object} params
   * @param {number} params.interruptor_A - Capacidad del interruptor en Amperes
   * @param {string} [params.material='cobre'] - 'cobre' o 'aluminio'
   * @param {Object|null} [params.ajuste_caida=null] - { seccion_fase_base_mm2, seccion_fase_ajustada_mm2 }
   * @returns {Object} Resultado con calibre y fundamento
   */
  static consultarPuestaATierra({ 
    interruptor_A, 
    material = 'cobre',
    ajuste_caida = null 
  }) {
    const tabla = tabla_250_122;
    
    if (!tabla.valores[material]) {
      return {
        error: `Material "${material}" no soportado en Tabla 250-122`,
        materiales_soportados: Object.keys(tabla.valores)
      };
    }
    
    // Validar interruptor
    if (!interruptor_A || interruptor_A <= 0) {
      return {
        error: "El amperaje del interruptor debe ser un valor positivo"
      };
    }
    
    // Buscar capacidad aplicable (igual o superior)
    const capacidades = Object.keys(tabla.valores[material]).map(Number).sort((a,b) => a-b);
    const capacidad_aplicable = capacidades.find(c => c >= interruptor_A) || capacidades[capacidades.length-1];
    
    const calibre_base = tabla.valores[material][capacidad_aplicable];
    
    let resultado = {
      calibre: calibre_base,
      base: calibre_base,
      interruptor_aplicado: capacidad_aplicable,
      material,
      nota: `Calibre base según Tabla 250-122 para interruptor ${capacidad_aplicable}A`,
      fundamento: {
        norma: tabla.meta.norma,
        articulo: tabla.meta.articulo,
        version: tabla.meta.version
      }
    };
    
    // Aplicar ajuste por caída de tensión si corresponde
    if (ajuste_caida && tabla.configuracion?.ajuste_caida_tension?.habilitado) {
      const { seccion_fase_base_mm2, seccion_fase_ajustada_mm2 } = ajuste_caida;
      if (seccion_fase_base_mm2 && seccion_fase_ajustada_mm2) {
        const factor = seccion_fase_ajustada_mm2 / seccion_fase_base_mm2;
        const calibre_ajustado = CalibreConverter.ajustarPorFactor(calibre_base, factor);
        
        resultado = {
          ...resultado,
          calibre: calibre_ajustado,
          factor_ajuste: parseFloat(factor.toFixed(2)),
          seccion_base_mm2: CalibreConverter.a_mm2(calibre_base),
          seccion_ajustada_mm2: CalibreConverter.a_mm2(calibre_ajustado),
          nota: `Ajustado por caída de tensión (Art. 250-122(B)): factor ${factor.toFixed(2)}x`,
          advertencia: "El ajuste se aplica sobre la sección transversal (mm²), no sobre el número AWG"
        };
      }
    }
    
    return resultado;
  }
  
  // ============================================
  // TABLA 310-16: AMPACIDAD DE CONDUCTORES
  // ============================================
  
  /**
   * Consulta Tabla 310-16 con factores de corrección integrados
   * @param {Object} params
   * @param {number} params.corriente_requerida - Corriente en Amperes
   * @param {string} [params.material='cobre'] - 'cobre' o 'aluminio'
   * @param {string} [params.tipo_aislamiento='THW'] - Tipo de aislamiento
   * @param {number} [params.temperatura_ambiente=30] - Temperatura ambiente en °C
   * @param {number} [params.conductores_agrupados=3] - Número de conductores agrupados
   * @param {number|null} [params.temperatura_terminales=null] - Temperatura de terminales (60,75,90) o null para aplicar regla 110-14(c)
   * @returns {Object} Resultado con calibre y factores aplicados
   */
  static consultarAmpacidad({
    corriente_requerida,
    material = 'cobre',
    tipo_aislamiento = 'THW',
    temperatura_ambiente = 30,
    conductores_agrupados = 3,
    temperatura_terminales = null
  }) {
    const tabla = tabla_310_16;
    const valores_material = tabla.valores[material];
    
    if (!valores_material) {
      return { error: `Material "${material}" no disponible en Tabla 310-16` };
    }
    
    if (!corriente_requerida || corriente_requerida <= 0) {
      return { error: "La corriente requerida debe ser un valor positivo" };
    }
    
    // Determinar columna de temperatura
    const temp_columna = temperatura_terminales || this.aplicarRegla110_14c(corriente_requerida);
    
    // Verificar que la columna de temperatura existe
    if (![60, 75, 90].includes(temp_columna)) {
      return { error: `Temperatura ${temp_columna}°C no soportada. Use 60, 75 o 90` };
    }
    
    // Ordenar calibres de mayor a menor sección
    const calibres = Object.keys(valores_material).sort((a,b) => {
      const orden = {'1/0':10, '2/0':11, '3/0':12, '4/0':13};
      const va = orden[a] || (parseFloat(a) || 0);
      const vb = orden[b] || (parseFloat(b) || 0);
      return vb - va;
    });
    
    // Buscar calibre que cumpla
    let calibre_seleccionado = null;
    let ampacidad_base = null;
    
    for (const calibre of calibres) {
      const amp = valores_material[calibre]?.[temp_columna];
      if (amp && amp >= corriente_requerida) {
        calibre_seleccionado = calibre;
        ampacidad_base = amp;
        break;
      }
    }
    
    // Manejo de "no encontrado" - sin lanzar error
    if (!calibre_seleccionado) {
      const calibre_maximo = calibres[calibres.length - 1];
      const amp_maxima = valores_material[calibre_maximo]?.[temp_columna];
      
      return {
        calibre: calibre_maximo,
        ampacidad_base: amp_maxima,
        ampacidad_ajustada: null,
        cumple: false,
        advertencia: {
          codigo: 'CORRIENTE_EXCEDE_TABLA',
          mensaje: `⚠️ ${corriente_requerida}A excede capacidad máxima de un solo conductor (${amp_maxima}A para ${calibre_maximo})`,
          recomendaciones: [
            "Considere conductores en paralelo según Art. 310-10(h)",
            "Evaluar cambio a aluminio de mayor sección",
            "Verificar si la carga puede dividirse en circuitos múltiples"
          ]
        },
        paralelo_sugerido: ConductoresParalelo?.sugerirConfiguracion?.(
          corriente_requerida, material, temp_columna
        ) || null,
        fundamento: { norma: tabla.meta.norma, articulo: tabla.meta.articulo }
      };
    }
    
    // Aplicar factores de corrección
    const factor_temp = tabla.factores_temperatura?.[material]?.[temperatura_ambiente] || 1.0;
    const factor_agrup = getFactorAgrupamiento(conductores_agrupados);
    
    const ampacidad_ajustada = ampacidad_base * factor_temp * factor_agrup;
    const cumple = ampacidad_ajustada >= corriente_requerida;
    
    return {
      calibre: calibre_seleccionado,
      ampacidad_base,
      ampacidad_ajustada: parseFloat(ampacidad_ajustada.toFixed(1)),
      factores_aplicados: {
        temperatura: { valor: temperatura_ambiente, factor: factor_temp },
        agrupamiento: { cantidad: conductores_agrupados, factor: factor_agrup }
      },
      columna_temperatura_usada: temp_columna,
      cumple_despues_ajustes: cumple,
      nota: cumple ? 
        `✅ ${calibre_seleccionado} AWG cumple con ${corriente_requerida}A después de ajustes` :
        `⚠️ ${calibre_seleccionado} AWG no cumple después de ajustes. Considere siguiente calibre.`,
      paralelo_opcional: !cumple ? (ConductoresParalelo?.sugerirConfiguracion?.(
        corriente_requerida, material, temp_columna
      ) || null) : null,
      fundamento: {
        norma: tabla.meta.norma,
        articulo: tabla.meta.articulo,
        regla_temperatura: "Art. 110-14(c)"
      }
    };
  }
  
  // ============================================
  // TABLA 430-250: MOTORES
  // ============================================
  
  /**
   * Consulta Tabla 430-250: Corriente a plena carga de motores
   * @param {Object} params
   * @param {number} params.hp - Caballos de fuerza
   * @param {number} params.tension_v - Tensión en Voltios
   * @param {number} [params.fases=3] - 1 (monofásico) o 3 (trifásico)
   * @returns {Object} Resultado con corriente y protecciones
   */
  static consultarMotor({ hp, tension_v, fases = 3 }) {
    if (!hp || hp <= 0) {
      return { error: "Los HP deben ser un valor positivo" };
    }
    
    if (!tension_v || tension_v <= 0) {
      return { error: "La tensión debe ser un valor positivo" };
    }
    
    const corriente = tabla_430_250.getCorriente(hp, tension_v, fases);
    
    if (!corriente) {
      return {
        error: "Motor no encontrado en Tabla 430-250",
        hp, tension_v, fases,
        sugerencia: "Verifique HP, tensión y número de fases. Consulte tabla completa."
      };
    }
    
    // Cálculos de protección según Art. 430
    return {
      hp: hp,
      tension: tension_v,
      fases: fases,
      corriente_placa: corriente,
      conductor_minimo: parseFloat((corriente * 1.25).toFixed(1)),
      proteccion_termica: {
        minimo: parseFloat((corriente * 1.25).toFixed(1)),
        maximo: parseFloat((corriente * 2.5).toFixed(1)),
        nota: "Para arranque directo, puede usarse hasta 250% de Ipc si es necesario (Art. 430-52)"
      },
      proteccion_magnetica: parseFloat((corriente * 2.5).toFixed(1)),
      puesta_a_tierra_referencia: "Consultar Tabla 250-122 con capacidad del interruptor seleccionado",
      fundamento: {
        norma: tabla_430_250.meta.norma,
        articulos: ["430-22", "430-52", "250-122"],
        version: tabla_430_250.meta.version
      }
    };
  }
  
  // ============================================
  // ARTÍCULO 440: HVAC
  // ============================================
  
  /**
   * Calcula conductor y protección para equipos HVAC según Art. 440 NOM-001-SEDE-2012
   * @param {Object} params - Parámetros de entrada
   * @param {number} params.corriente_placa - Corriente nominal de placa del equipo (A)
   * @param {string} [params.material='cobre'] - Material del conductor
   * @param {number} [params.tension=440] - Tensión nominal (V)
   * @returns {Object} Resultado del cálculo
   */
  static consultarHVAC({ corriente_placa, material = 'cobre', tension = 440 }) {
    if (!corriente_placa || corriente_placa <= 0) {
      return { error: "La corriente de placa debe ser un valor positivo" };
    }
    
    // Art. 440-32: Conductor ≥ 125% de corriente de placa (MCA)
    const corriente_conductor = corriente_placa * 1.25;
    
    // Art. 440-22(a): Protección máx 175% (excepción 225% si no arranca)
    const proteccion_175 = corriente_placa * 1.75;
    const proteccion_225 = corriente_placa * 2.25;
    
    // Buscar tamaño comercial de protección más cercano (Art. 240-6)
    const protecciones_comerciales = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250];
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
      tension: tension,
      nota: "Art. 440 NOM-001-SEDE-2012: usar corriente de placa del equipo (MCA), NO tablas genéricas de motores. La protección de sobrecarga la proporciona internamente el equipo.",
      advertencia_caida_tension: "Si el conductor de fase se aumentó por caída de tensión, el conductor de puesta a tierra también debe aumentarse proporcionalmente (Art. 250-122(B))",
      fundamento: { 
        norma: "NOM-001-SEDE-2012", 
        articulo: "440",
        subarticulos: ["440-4", "440-22(a)", "440-32"]
      }
    };
  }
  
  // ============================================
  // ARTÍCULO 630: SOLDADORAS
  // ============================================
  
  /**
   * Calcula conductor y protección para soldadoras según Art. 630 NOM-001-SEDE-2012
   * @param {Object} params - Parámetros de entrada
   * @param {'arco'|'resistencia'} params.tipo - Tipo de soldadora
   * @param {number} params.corriente_primaria - Corriente primaria nominal (A)
   * @param {number} [params.ciclo_trabajo=null] - Ciclo de trabajo (0.1 a 1.0), requerido para tipo 'resistencia'
   * @param {string} [params.material='cobre'] - Material del conductor
   * @returns {Object} Resultado del cálculo
   */
  static consultarSoldadora({ tipo, corriente_primaria, ciclo_trabajo = null, material = 'cobre' }) {
    if (!corriente_primaria || corriente_primaria <= 0) {
      return { error: "La corriente primaria debe ser un valor positivo" };
    }
    
    if (!['arco', 'resistencia'].includes(tipo)) {
      return { error: "Tipo no reconocido: use 'arco' o 'resistencia'" };
    }
    
    // Validar ciclo de trabajo para soldadoras de resistencia
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
      // Art. 630-11/12: conductor 100%, protección 200%
      const corriente_conductor = corriente_primaria;
      const proteccion = corriente_primaria * 2.0;
      
      // Tamaño comercial de protección
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
      // Art. 630-31: factor = √(ciclo) × 0.7 para conductor
      const factor_conductor = Math.sqrt(ciclo_trabajo) * 0.7;
      const corriente_conductor = corriente_primaria * factor_conductor;
      const proteccion = corriente_primaria * 3.0;
      
      // Tamaño comercial de protección
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
    
    // Agregar nota común sobre puesta a tierra
    resultado.nota_puesta_a_tierra = "El conductor de puesta a tierra se dimensiona por la capacidad del interruptor (Tabla 250-122), no por la corriente de la soldadora. Si el conductor de fase se aumentó por caída de tensión, el de puesta a tierra también debe aumentarse proporcionalmente (Art. 250-122(B)).";
    
    return resultado;
  }
  
  // ============================================
  // DISEÑO COMPLETO DE CIRCUITO
  // ============================================
  
  /**
   * Método unificado para diseño completo de circuito
   * @param {Object} params
   * @param {string} params.tipo_carga - 'motor' | 'general' | 'hvac' | 'soldadora'
   * @param {number} [params.corriente_requerida] - Corriente en Amperes
   * @param {number} [params.hp] - HP para motores
   * @param {number} [params.corriente_placa] - Corriente de placa para HVAC
   * @param {string} [params.tipo_soldadora] - 'arco' o 'resistencia' para soldadoras
   * @param {number} [params.ciclo_trabajo] - Ciclo de trabajo para soldadoras resistencia
   * @param {number} params.tension_v - Tensión nominal
   * @param {string} [params.material='cobre'] - Material del conductor
   * @param {string} [params.tipo_aislamiento='THW'] - Tipo de aislamiento
   * @param {number} [params.temperatura_ambiente=30] - Temperatura ambiente en °C
   * @param {number} [params.conductores_agrupados=3] - Número de conductores agrupados
   * @param {number} [params.longitud_m] - Longitud en metros (para caída de tensión)
   * @param {number} [params.interruptor_A] - Capacidad del interruptor
   * @param {boolean} [params.aumento_por_caida=false] - Si hubo aumento por caída de tensión
   * @returns {Object} Resultados completos del diseño
   */
  static disenarCircuitoCompleto({
    tipo_carga,
    corriente_requerida,
    hp,
    corriente_placa,
    tipo_soldadora,
    ciclo_trabajo,
    tension_v,
    material = 'cobre',
    tipo_aislamiento = 'THW',
    temperatura_ambiente = 30,
    conductores_agrupados = 3,
    longitud_m,
    interruptor_A,
    aumento_por_caida = false
  }) {
    const resultados = {};
    
    // 1. Determinar corriente de diseño según tipo de carga
    let corriente_diseno = corriente_requerida;
    
    if (tipo_carga === 'motor' && hp) {
      const motor = this.consultarMotor({ hp, tension_v });
      if (motor.error) return { error: motor.error };
      resultados.motor = motor;
      corriente_diseno = motor.corriente_placa * 1.25; // Art. 430-22
    } else if (tipo_carga === 'hvac' && corriente_placa) {
      const hvac = this.consultarHVAC({ corriente_placa, material, tension: tension_v });
      if (hvac.error) return { error: hvac.error };
      resultados.hvac = hvac;
      corriente_diseno = hvac.corriente_conductor_minima;
      interruptor_A = interruptor_A || hvac.proteccion_comercial_sugerida_175;
    } else if (tipo_carga === 'soldadora' && tipo_soldadora && corriente_requerida) {
      const soldadora = this.consultarSoldadora({ 
        tipo: tipo_soldadora, 
        corriente_primaria: corriente_requerida,
        ciclo_trabajo,
        material 
      });
      if (soldadora.error) return { error: soldadora.error };
      resultados.soldadora = soldadora;
      corriente_diseno = soldadora.corriente_conductor;
      interruptor_A = interruptor_A || soldadora.proteccion_comercial_sugerida;
    }
    
    if (!corriente_diseno) {
      return { error: "No se pudo determinar la corriente de diseño" };
    }
    
    // 2. Calcular calibre de fase
    resultados.conductor_fase = this.consultarAmpacidad({
      corriente_requerida: corriente_diseno,
      material,
      tipo_aislamiento,
      temperatura_ambiente,
      conductores_agrupados
    });
    
    if (resultados.conductor_fase.error) {
      return { error: resultados.conductor_fase.error };
    }
    
    // 3. Calcular puesta a tierra (por interruptor)
    if (interruptor_A) {
      resultados.puesta_a_tierra = this.consultarPuestaATierra({
        interruptor_A,
        material,
        ajuste_caida: aumento_por_caida && resultados.conductor_fase.calibre ? {
          seccion_fase_base_mm2: CalibreConverter.a_mm2(resultados.conductor_fase.calibre),
          seccion_fase_ajustada_mm2: CalibreConverter.a_mm2(resultados.conductor_fase.calibre)
        } : null
      });
    }
    
    // 4. Verificación de caída de tensión
    if (longitud_m && resultados.conductor_fase.calibre && tension_v) {
      const seccion_mm2 = CalibreConverter.a_mm2(resultados.conductor_fase.calibre);
      if (seccion_mm2) {
        const rho = material === 'cobre' ? 0.01724 : 0.0282;
        const delta_v = (2 * longitud_m * corriente_diseno * rho) / seccion_mm2;
        const porcentaje = (delta_v / tension_v) * 100;
        
        resultados.caida_tension = {
          calculada_v: parseFloat(delta_v.toFixed(2)),
          calculada_percent: parseFloat(porcentaje.toFixed(2)),
          limite_recomendado: 3,
          cumple: porcentaje <= 3,
          nota: porcentaje > 3 ? "⚠️ Excede 3%. Considere aumentar calibre o reducir distancia." : "✅ Cumple límite recomendado de 3%"
        };
      }
    }
    
    // 5. Resumen de conformidad
    resultados.conformidad = {
      conductor_fase: resultados.conductor_fase.cumple_despues_ajustes,
      puesta_a_tierra: !!resultados.puesta_a_tierra?.calibre,
      caida_tension: resultados.caida_tension?.cumple ?? null,
      general: resultados.conductor_fase.cumple_despues_ajustes && 
               (!resultados.caida_tension || resultados.caida_tension.cumple)
    };
    
    return resultados;
  }
  
  // ============================================
  // HELPER: PROTECCIÓN COMERCIAL
  // ============================================
  
  /**
   * Helper: Encuentra el tamaño comercial de protección más cercano (Art. 240-6)
   * @param {number} valor_calculado - Valor calculado de protección
   * @param {boolean} permitir_siguiente - Permitir siguiente tamaño comercial si el calculado no es estándar
   * @returns {number|null} Tamaño comercial de protección
   */
  static _proteccionComercial(valor_calculado, permitir_siguiente = true) {
    if (!valor_calculado || valor_calculado <= 0) return null;
    
    const tamanos_estandar = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500];
    
    // Buscar tamaño exacto o inmediatamente superior
    const encontrado = tamanos_estandar.find(t => t >= valor_calculado);
    if (encontrado) return encontrado;
    
    // Si no encuentra y se permite siguiente, retornar el mayor disponible
    if (permitir_siguiente) {
      return tamanos_estandar[tamanos_estandar.length - 1];
    }
    
    return null;
  }
}