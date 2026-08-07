"use client";

import { useEffect } from "react";

/**
 * Meldt de service worker aan en vraagt om blijvende opslag.
 *
 * Dat tweede is hier belangrijker dan gebruikelijk: zonder server staat je reis
 * alleen in deze browser. Browsers mogen opslag van websites opruimen; met
 * toestemming voor blijvende opslag gebeurt dat niet zomaar.
 */
export function OfflineSupport() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Tijdens ontwikkelen niet: de schil wordt cache-first geserveerd, dus na
    // een codewijziging krijg je een nieuwe pagina met oude bundels terug. Een
    // eerder aangemelde worker moet dan ook weg, anders blijft hij dat doen.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registraties) => registraties.forEach((r) => void r.unregister()));
      void caches.keys().then((namen) => namen.forEach((naam) => void caches.delete(naam)));
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch((cause) => {
      console.error("Service worker aanmelden mislukt", cause);
    });

    void navigator.storage?.persist?.();
  }, []);

  return null;
}
