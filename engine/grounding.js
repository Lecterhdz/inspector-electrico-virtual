// engine/grounding.js
import indice from '../data/chunks/indice-general.json';

export async function buscarArticulo(query) {
  const queryLower = query.toLowerCase();
  
  // 1. Búsqueda por número exacto (ej: "445", "110-26")
  for (const [numero, info] of Object.entries(indice.indice.por_numero)) {
    if (queryLower.includes(numero) || numero.includes(queryLower)) {
      const articuloPath = `./data/chunks/${info.archivo}`;
      const articulo = await import(articuloPath);
      return articulo;
    }
  }
  
  // 2. Búsqueda por tag
  for (const [tag, numeros] of Object.entries(indice.indice.por_tag)) {
    if (queryLower.includes(tag)) {
      const articuloPath = `./data/chunks/${indice.indice.por_numero[numeros[0]].archivo}`;
      const articulo = await import(articuloPath);
      return articulo;
    }
  }
  
  return null;
}
