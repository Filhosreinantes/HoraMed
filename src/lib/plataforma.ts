import { Capacitor } from "@capacitor/core";

/** Rodando dentro do app Android (Capacitor), não no navegador. */
export function ehAppAndroid() {
  return Capacitor.getPlatform() === "android";
}

/**
 * Endereço do site para links enviados por e-mail (confirmar conta, redefinir senha).
 * No app a origem é https://localhost, que não abre fora dele.
 */
export function urlDoSite() {
  // ⚠️ TROQUE PARA A URL DO SEU PROJETO HORAMED NO VERCEL
  return ehAppAndroid() ? "https://horamed.vercel.app" : window.location.origin;
}