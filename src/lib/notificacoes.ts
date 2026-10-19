import OneSignal from "react-onesignal";

let pronto: Promise<boolean> | null = null;

/** Inicializa o OneSignal uma única vez. Resolve false se não carregar (bloqueador, sem suporte). */
export function iniciarNotificacoes() {
  if (typeof window === "undefined") return Promise.resolve(false);
  pronto ??= OneSignal.init({
    appId: "c1ce9bf7-7bd7-4d39-9b90-294a304b4500",
    serviceWorkerPath: "/oneSignal/OneSignalSDKWorker.js",
    serviceWorkerParam: { scope: "/oneSignal/" },
  })
    .then(() => true)
    .catch((err) => {
      console.error("Erro ao iniciar OneSignal:", err);
      return false;
    });
  return pronto;
}

/** Liga este aparelho à conta, para os lembretes chegarem à usuária certa. */
export async function conectarUsuaria(userId: string) {
  if (await iniciarNotificacoes()) await OneSignal.login(userId).catch(() => undefined);
}

export async function desconectarUsuaria() {
  if (await iniciarNotificacoes()) await OneSignal.logout().catch(() => undefined);
}

function ehIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function instaladoNaTela() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

export type EstadoNotificacoes =
  "ativas" | "pendente" | "bloqueadas" | "instalar-ios" | "sem-suporte";

export async function estadoNotificacoes(): Promise<EstadoNotificacoes> {
  // No iPhone, notificação web só funciona com o app instalado na tela inicial.
  if (ehIOS() && !instaladoNaTela()) return "instalar-ios";
  if (!("Notification" in window) || !(await iniciarNotificacoes())) return "sem-suporte";
  if (!OneSignal.Notifications.isPushSupported()) return "sem-suporte";
  if (Notification.permission === "denied") return "bloqueadas";
  return OneSignal.Notifications.permission && OneSignal.User.PushSubscription.optedIn
    ? "ativas"
    : "pendente";
}

export const MENSAGEM: Record<Exclude<EstadoNotificacoes, "ativas" | "pendente">, string> = {
  "instalar-ios":
    'No iPhone, primeiro instale o app: toque em Compartilhar e depois em "Adicionar à Tela de Início". Abra o Rotina Azul pelo ícone e ative os lembretes.',
  bloqueadas:
    "As notificações estão bloqueadas para este site. Libere nas configurações do navegador e tente de novo.",
  "sem-suporte": "Este navegador não recebe notificações. Tente pelo Chrome no celular.",
};

/** Pede a permissão e inscreve o aparelho. Retorna o estado final. */
export async function ativarNotificacoes(userId: string): Promise<EstadoNotificacoes> {
  const antes = await estadoNotificacoes();
  if (antes !== "pendente") return antes;
  await OneSignal.Notifications.requestPermission();
  if (OneSignal.Notifications.permission) {
    await OneSignal.User.PushSubscription.optIn();
    await conectarUsuaria(userId);
  }
  return estadoNotificacoes();
}
