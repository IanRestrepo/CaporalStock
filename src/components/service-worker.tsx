"use client";

import { useEffect } from "react";

/**
 * Registra el service worker sólo en producción: en desarrollo, un SW cacheando
 * chunks de Next es una fuente inagotable de bugs fantasma.
 *
 * Pide una comprobación de actualización en cada carga. Sin esto, un service
 * worker defectuoso puede quedarse atrincherado en el teléfono de un empleado
 * durante horas, y desde el servidor no hay forma de sacarlo.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });
        await registration.update();
      } catch {
        // Sin SW la app funciona igual; sólo deja de ser instalable.
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", () => void register(), { once: true });
  }, []);

  return null;
}
