/**
 * @file engine/index.js
 * @description Módulo exportable para Inspector Eléctrico Virtual (Híbrido)
 * @version 2.2 - sesionInicial definido inline
 */

import { LLMAgente } from './llm-orchestrator.js';
// ✅ CORREGIDO: Importar solo SesionManager, sesionInicial viene de llm-orchestrator
import { SesionManager as ContextManager } from './sesion-manager.js';
import { sesionInicial } from './llm-orchestrator.js';  // ← Desde llm-orchestrator

// Re-exportar para conveniencia
export { sesionInicial, ContextManager, LLMAgente };

export class InspectorVirtual {
  
  static async consultar(input, sesion = null) {
    if (!sesion) {
      sesion = JSON.parse(JSON.stringify(sesionInicial));
    }
    return await LLMAgente.procesar(input, sesion);
  }

  static async consultarMotor(input, sesion = null) {
    if (!sesion) {
      sesion = JSON.parse(JSON.stringify(sesionInicial));
    }
    return await LLMAgente._rutaMotor(input, sesion);
  }
}