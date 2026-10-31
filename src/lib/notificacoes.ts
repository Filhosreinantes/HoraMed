// Notificações no horaMed.
// No Android, os lembretes são alarmes locais (arquivo alarmes.ts).
// Não usamos OneSignal nem push web.

export type EstadoNotificacoes = "ativas" | "pendente" | "bloqueadas" | "instalar-ios" | "nao-carregou" | "sem-suporte";

/**
 * Verifica o estado das notificações do navegador.
 * Como não usamos push, sempre retornamos "sem-suporte" para evitar erros.
 */
export async function estadoNotificacoes(): Promise<EstadoNotificacoes> {
  return "sem-suporte";
}

export const MENSAGEM: Record<Exclude<EstadoNotificacoes, "ativas" | "pendente">, string> = {
  "instalar-ios": "No iPhone, instale o app na tela de início para receber lembretes.",
  bloqueadas: "As notificações estão bloqueadas para este site. Libere nas configurações do navegador.",
  "nao-carregou": "Um bloqueador do navegador impediu os lembretes. Libere este site no bloqueador.",
  "sem-suporte": "Este navegador não recebe notificações. No Android, use o app instalado para ter alarmes nativos.",
};

/** Ativar notificações (não usado mais, mas mantido para compatibilidade). */
export async function ativarNotificacoes(_userId: string): Promise<EstadoNotificacoes> {
  return "sem-suporte";
}

/** Desativar notificações (não usado mais). */
export async function desativarNotificacoes(): Promise<EstadoNotificacoes> {
  return "sem-suporte";
}

/** Enviar notificação de teste (não usado mais). */
export async function enviarNotificacaoTeste(): Promise<{ enviado: boolean }> {
  return { enviado: false };
}

/** Conectar usuário (não usado mais). */
export async function conectarUsuaria(_userId: string) {
  // sem OneSignal
}

/** Desconectar usuário (não usado mais). */
export async function desconectarUsuaria() {
  // sem OneSignal
}

/** Inicializar notificações (não usado mais). */
export function iniciarNotificacoes() {
  return Promise.resolve(false);
}