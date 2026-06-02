// data/normativas/tabla_310_16.js
// NOM-001-SEDE-2012 - Ampacidad de conductores aislados

export const tabla_310_16 = {
  meta: {
    norma: "NOM-001-SEDE-2012",
    articulo: "310-16",
    version: "2012",
    titulo: "Ampacidades permisibles en conductores aislados",
    nota: "Para tensiones hasta 2000 volts, no más de 3 conductores portadores de corriente en canalización, cable o directamente enterrados. Temperatura ambiente 30°C."
  },
  
  valores: {
    cobre: {
      // AWG / kcmil: { 60°C, 75°C, 90°C }
      '14': { 60: 20, 75: 20, 90: 25 },
      '12': { 60: 25, 75: 25, 90: 30 },
      '10': { 60: 30, 75: 35, 90: 40 },
      '8':  { 60: 40, 75: 50, 90: 55 },
      '6':  { 60: 55, 75: 65, 90: 75 },
      '4':  { 60: 70, 75: 85, 90: 95 },
      '3':  { 60: 85, 75: 100, 90: 110 },
      '2':  { 60: 95, 75: 115, 90: 130 },
      '1':  { 60: 110, 75: 130, 90: 150 },
      '1/0': { 60: 125, 75: 150, 90: 170 },
      '2/0': { 60: 145, 75: 175, 90: 195 },
      '3/0': { 60: 165, 75: 200, 90: 225 },
      '4/0': { 60: 195, 75: 230, 90: 260 },
      '250': { 60: 215, 75: 255, 90: 290 },
      '300': { 60: 240, 75: 285, 90: 320 },
      '350': { 60: 260, 75: 310, 90: 350 },
      '400': { 60: 280, 75: 335, 90: 380 },
      '500': { 60: 320, 75: 380, 90: 430 }
    },
    
    aluminio: {
      '12': { 60: 20, 75: 20, 90: 25 },
      '10': { 60: 25, 75: 30, 90: 35 },
      '8':  { 60: 30, 75: 40, 90: 45 },
      '6':  { 60: 40, 75: 50, 90: 60 },
      '4':  { 60: 55, 75: 65, 90: 75 },
      '3':  { 60: 65, 75: 75, 90: 85 },
      '2':  { 60: 75, 75: 90, 90: 100 },
      '1':  { 60: 85, 75: 100, 90: 115 },
      '1/0': { 60: 100, 75: 120, 90: 135 },
      '2/0': { 60: 115, 75: 135, 90: 150 },
      '3/0': { 60: 130, 75: 155, 90: 175 },
      '4/0': { 60: 150, 75: 180, 90: 205 },
      '250': { 60: 170, 75: 205, 90: 230 },
      '300': { 60: 190, 75: 230, 90: 255 },
      '350': { 60: 210, 75: 250, 90: 280 },
      '400': { 60: 225, 75: 270, 90: 305 },
      '500': { 60: 260, 75: 310, 90: 350 }
    }
  },
  
  // Función auxiliar para obtener ampacidad
  getAmpacidad: function(calibre, material = 'cobre', temp = 75) {
    const valoresMaterial = this.valores[material];
    if (!valoresMaterial || !valoresMaterial[calibre]) return null;
    return valoresMaterial[calibre][temp];
  },
  
  // Función para seleccionar calibre por corriente
  seleccionarCalibre: function(corriente, material = 'cobre', temp = 75) {
    const valoresMaterial = this.valores[material];
    if (!valoresMaterial) return null;
    
    const calibres = Object.keys(valoresMaterial).sort((a, b) => {
      const order = { '1/0': 10, '2/0': 11, '3/0': 12, '4/0': 13 };
      const va = order[a] || parseInt(a);
      const vb = order[b] || parseInt(b);
      return va - vb;
    });
    
    for (const calibre of calibres) {
      const amp = valoresMaterial[calibre][temp];
      if (amp && amp >= corriente) {
        return calibre;
      }
    }
    return '500'; // máximo
  }
};
