"use client";

import { useEffect } from "react";

/**
 * Registra el service worker sólo en producción: en desarrollo un SW cacheando
 * chunks de Next es una fuente inagotable de bugs fantasma.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* sin SW la app sigue funcionando, sólo pierde el modo avión */
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
