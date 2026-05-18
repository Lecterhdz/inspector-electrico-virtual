// inspector/utils/conversion-calibres.js
export const CalibreConverter = {
  AWG_a_mm2: {
    '14': 2.08, '12': 3.31, '10': 5.26, '8': 8.37, '6': 13.3,
    '4': 21.1, '3': 26.7, '2': 33.6, '1': 42.4, 
    '1/0': 53.5, '2/0': 67.4, '3/0': 85.0, '4/0': 107.2,
    '250kcmil': 126.7, '300kcmil': 152.0, '350kcmil': 177.3,
    '400kcmil': 202.7, '500kcmil': 253.3, '600kcmil': 304.0
  },
  
  a_mm2: function(calibre) {
    if (!calibre) return null;
    const key = String(calibre).trim().toLowerCase();
    if (key in this.AWG_a_mm2) return this.AWG_a_mm2[key];
    const match = key.match(/^(\d+(?:\.\d+)?)\s*kcmil$/i);
    if (match) return parseFloat(match[1]) * 0.5067;
    return null;
  },
  
  mm2_a_calibre: function(mm2_requerido, material = 'cobre') {
    const candidatos = Object.entries(this.AWG_a_mm2)
      .filter(([calibre, mm2]) => mm2 >= mm2_requerido)
      .sort((a, b) => a[1] - b[1]);
    if (material === 'aluminio' && candidatos.length > 1) {
      return candidatos[1]?.[0] || candidatos[0]?.[0] || null;
    }
    return candidatos[0]?.[0] || null;
  },
  
  ajustarPorFactor: function(calibre_base, factor) {
    const mm2_base = this.a_mm2(calibre_base);
    if (!mm2_base) return calibre_base;
    const mm2_ajustado = mm2_base * factor;
    return this.mm2_a_calibre(mm2_ajustado);
  }
};