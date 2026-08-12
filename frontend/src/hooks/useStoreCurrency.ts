// src/hooks/useStoreCurrency.ts
//
// Moneda/locale de la tienda del vendedor autenticado, para páginas del
// dashboard que no cargan el objeto `store` completo. Cae a PEN/es-PE
// mientras carga o si falla — mismo fallback de siempre, no rompe nada.

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { getStoreCurrency, type StoreCurrency } from "@/lib/utils";

export function useStoreCurrency(): StoreCurrency {
  const [currency, setCurrency] = useState<StoreCurrency>(() => getStoreCurrency(null));

  useEffect(() => {
    apiClient
      .get("/stores/me")
      .then(({ data }) => setCurrency(getStoreCurrency(data)))
      .catch(() => {});
  }, []);

  return currency;
}
