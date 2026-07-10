"use client";

// src/hooks/useCulqi.ts — qtienda v2
//
// Hook reutilizable para cualquier pago con Culqi.
// Usado en:
//   - dashboard/planes/page.tsx  → suscripciones del vendedor
//   - CartDrawer.tsx             → pagos con tarjeta del comprador
//
// SETUP:
//   En .env.local agrega:
//   NEXT_PUBLIC_CULQI_PUBLIC_KEY=pk_test_TU_CLAVE_AQUI
//
// USO:
//   const { openCulqi, loading } = useCulqi({
//     amount: 2900,           // en centavos (S/ 29.00)
//     currency: "PEN",
//     description: "Plan Pro mensual",
//     email: user.email,      // opcional, pre-rellena el formulario
//     onSuccess: async (token) => { await apiClient.post(...) },
//     onError: (msg) => toast.error(msg),
//   });

import { useEffect, useRef, useCallback, useState } from "react";

const CULQI_PUBLIC_KEY = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY ?? "";
const CULQI_SCRIPT_ID  = "culqi-js-v4";
const CULQI_SCRIPT_SRC = "https://checkout.culqi.com/js/v4";

interface UseCulqiOptions {
  amount:      number;          // centavos
  currency?:   string;          // "PEN" por defecto
  title?:      string;          // título en el modal de Culqi
  description: string;
  email?:      string;          // pre-rellena el campo email
  onSuccess:   (token: string) => Promise<void>;
  onError?:    (message: string) => void;
}

export function useCulqi(options: UseCulqiOptions) {
  const [loading, setLoading] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options; // siempre usa los options actuales sin re-registrar handlers

  // Carga el script de Culqi una sola vez
  useEffect(() => {
    if (document.getElementById(CULQI_SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id    = CULQI_SCRIPT_ID;
    script.src   = CULQI_SCRIPT_SRC;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const openCulqi = useCallback(() => {
    if (!CULQI_PUBLIC_KEY) {
      console.error("[useCulqi] NEXT_PUBLIC_CULQI_PUBLIC_KEY no está configurada");
      optionsRef.current.onError?.("Pagos con tarjeta no disponibles ahora");
      return;
    }
    if (!window.Culqi) {
      optionsRef.current.onError?.("Cargando sistema de pagos, intenta en unos segundos");
      return;
    }

    const { amount, currency = "PEN", title = "qtienda", description, email } = optionsRef.current;

    window.Culqi.publicKey = CULQI_PUBLIC_KEY;
    window.Culqi.settings({
      title,
      currency,
      description,
      amount,
      ...(email && { email }),
    });

    // paymentMethods/style van en Culqi.options(), NO dentro de settings():
    // anidados en settings el checkout los ignora y solo muestra tarjeta.
    window.Culqi.options({
      lang:         "es",
      installments: false,  // sin cuotas por defecto
      modal:        true,
      paymentMethods: {
        tarjeta:     true,
        yape:        true,   // Yape vía Culqi
        billetera:   false,
        bancaMovil:  false,
        agente:      false,
        cuotealo:    false,
      },
      style: {
        logo:            "https://qtienda.shop/icon/icon-72.png",
        maincolor:       "#C5613B",   // --accent de qtienda
        buttontext:      "Pagar ahora",
        maintext:        "Pago seguro",
        desctext:        description,
        errortext:       "Verifica los datos de tu pago",
      },
    });

    // Handler de éxito — Culqi llama culqiAction() cuando el usuario completa el pago
    window.culqiAction = async () => {
      const token = (window.Culqi as any).token?.id;
      window.Culqi.close();
      if (!token) {
        optionsRef.current.onError?.("No se recibió token de pago");
        return;
      }
      setLoading(true);
      try {
        await optionsRef.current.onSuccess(token);
      } catch (err: any) {
        optionsRef.current.onError?.(
          err?.response?.data?.detail || "Error al procesar el pago"
        );
      } finally {
        setLoading(false);
      }
    };

    // Handler de error — Culqi llama culqiError() en caso de fallo
    window.culqiError = () => {
      const err = (window.Culqi as any).error;
      const msg = err?.user_message || err?.merchant_message || "Error en el pago";
      optionsRef.current.onError?.(msg);
      setLoading(false);
    };

    window.Culqi.open();
  }, []); // sin dependencias — siempre lee de optionsRef

  return { openCulqi, loading };
}

// ── Tipos globales para TypeScript ──────────────────────────
declare global {
  interface Window {
    Culqi: {
      publicKey: string;
      settings: (config: Record<string, unknown>) => void;
      options: (config: Record<string, unknown>) => void;
      open:  () => void;
      close: () => void;
    };
    culqiAction: () => void;
    culqiError:  () => void;
  }
}
