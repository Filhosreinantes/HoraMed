import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Identificador na Play Store: não pode mudar depois da primeira publicação.
  appId: "br.com.rotinaazul",
  appName: "Rotina Azul",
  // Gerado por `bun run build:android` (site estático, sem servidor).
  webDir: "dist/client",
};

export default config;
