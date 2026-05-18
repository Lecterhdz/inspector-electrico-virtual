/**
 * @file utils/payment-manager.js
 * @description Gestión de pagos por transferencia bancaria
 * @costo $0: Referencia única por usuario, verificación manual, sin pasarela
 */

import { PLANS } from './feature-flags.js';

// Configuración bancaria (cámbiala por tu cuenta real)
export const CUENTA_BANCARIA = {
  banco: 'BBVA México',
  titular: 'Inspector Eléctrico Virtual S.A. de C.V.',
  clabe: '012345678901234567',
  referencia_prefijo: 'INSPE-' // Se concatena con ID de usuario
};

/**
 * Genera referencia única para pago
 */
export const generarReferenciaPago = (userId) => {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${CUENTA_BANCARIA.referencia_prefijo}${userId.slice(0, 6)}-${timestamp}`;
};

/**
 * Construye instrucciones de pago
 */
export const construirInstruccionesPago = (planId, userId) => {
  const plan = PLANS[planId.toUpperCase()];
  const referencia = generarReferenciaPago(userId);
  
  return {
    plan: plan.name,
    monto: plan.price,
    referencia,
    clabe: CUENTA_BANCARIA.clabe,
    banco: CUENTA_BANCARIA.banco,
    titular: CUENTA_BANCARIA.titular,
    pasos: [
      '1. Realice transferencia por el monto exacto desde su banca electrónica o ventanilla',
      '2. Use la referencia como concepto de pago',
      '3. Capture el comprobante (PDF o imagen) en la plataforma',
      '4. Su acceso se activará en 24-48 horas hábiles tras verificación'
    ]
  };
};

/**
 * Simula estado de pago (reemplazar con Supabase/DB real)
 */
const paymentStatusStore = new Map();

export const PaymentManager = {
  /** Registra solicitud de pago */
  registrarSolicitud: (userId, plan, comprobanteUrl) => {
    paymentStatusStore.set(userId, {
      plan,
      comprobanteUrl,
      status: 'pendiente',
      solicitado_en: new Date().toISOString()
    });
    return { success: true, status: 'pendiente' };
  },

  /** Verifica estado actual */
  verificarEstado: (userId) => {
    return paymentStatusStore.get(userId) || { status: 'sin_solicitud' };
  },

  /** Activa plan (usar solo desde panel admin o webhook) */
  activarPlan: (userId, plan) => {
    paymentStatusStore.set(userId, {
      ...paymentStatusStore.get(userId),
      status: 'verificado',
      plan_activo: plan,
      activado_en: new Date().toISOString()
    });
    return { success: true };
  }
};