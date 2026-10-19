import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import {
  ativarNotificacoes,
  desativarNotificacoes,
  enviarNotificacaoTeste,
  estadoNotificacoes,
  MENSAGEM,
  type EstadoNotificacoes,
} from "@/lib/notificacoes";

const TITULO: Record<EstadoNotificacoes, string> = {
  ativas: "✅ Lembretes ativos neste aparelho",
  pendente: "🔕 Lembretes desligados neste aparelho",
  bloqueadas: "🚫 Notificações bloqueadas no navegador",
  "instalar-ios": "📲 Instale o app para receber lembretes",
  "nao-carregou": "🛡️ Um bloqueador impediu os lembretes",
  "sem-suporte": "⚠️ Este navegador não recebe notificações",
};

const COMO_LIBERAR =
  'Toque no cadeado (ou nos ⋮) ao lado do endereço do site → Configurações do site → Notificações → Permitir. Depois toque em "Verificar de novo".';

/** Estado e controles dos lembretes deste aparelho: ativar, reativar, desativar e testar. */
export function NotificacoesCartao() {
  const { user } = useApp();
  const [estado, setEstado] = useState<EstadoNotificacoes | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const verificar = useCallback(() => estadoNotificacoes().then(setEstado), []);
  useEffect(() => {
    verificar();
  }, [verificar]);

  const executar = async (acao: () => Promise<void>) => {
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      console.error("Erro nas notificações:", e);
      toast.error((e as Error).message || "Algo deu errado. Tente novamente.");
    } finally {
      setOcupado(false);
    }
  };

  const ativar = () =>
    executar(async () => {
      const final = await ativarNotificacoes(user.id);
      setEstado(final);
      if (final === "ativas") toast.success("Lembretes ativados neste aparelho! 💙");
      else if (final === "pendente")
        toast.error('Permissão não concedida. Toque em "Permitir" quando o navegador perguntar.');
    });

  const desativar = () =>
    executar(async () => {
      setEstado(await desativarNotificacoes());
      toast.success("Lembretes desligados neste aparelho.");
    });

  const testar = () =>
    executar(async () => {
      const enviado = await enviarNotificacaoTeste();
      if (enviado) toast.success("Teste enviado! Deve chegar em alguns segundos.");
      else toast.error("Nenhum aparelho inscrito. Desative e ative os lembretes de novo.");
    });

  if (!estado) return null;

  const botao = "w-full rounded-2xl py-3 text-sm font-bold transition disabled:opacity-60";

  return (
    <div className="notebook space-y-3 p-4">
      <p className="font-semibold text-foreground">{TITULO[estado]}</p>

      {estado === "ativas" && (
        <>
          <p className="text-xs text-muted-foreground">
            Você recebe um aviso no horário de cada remédio e outro 15 minutos depois, se a dose
            ainda não tiver sido registrada.
          </p>
          <button
            onClick={testar}
            disabled={ocupado}
            className={`${botao} bg-primary text-primary-foreground shadow-soft`}
          >
            🔔 Enviar notificação de teste
          </button>
          <button
            onClick={desativar}
            disabled={ocupado}
            className={`${botao} border border-gray-300 text-gray-500`}
          >
            Desativar lembretes neste aparelho
          </button>
        </>
      )}

      {estado === "pendente" && (
        <>
          <p className="text-xs text-muted-foreground">
            Ative para ser avisada na hora de cada remédio. Se você disse "Agora não" antes, pode
            ativar aqui a qualquer momento.
          </p>
          <button
            onClick={ativar}
            disabled={ocupado}
            className={`${botao} bg-primary text-primary-foreground shadow-soft`}
          >
            {ocupado ? "Ativando..." : "🔔 Ativar lembretes"}
          </button>
        </>
      )}

      {estado === "bloqueadas" && (
        <>
          <p className="text-xs text-muted-foreground">{COMO_LIBERAR}</p>
          <button
            onClick={verificar}
            disabled={ocupado}
            className={`${botao} border border-gold/50 text-foreground`}
          >
            Verificar de novo
          </button>
        </>
      )}

      {estado === "nao-carregou" && (
        <>
          <p className="text-xs text-muted-foreground">{MENSAGEM["nao-carregou"]}</p>
          <button
            onClick={() => window.location.reload()}
            className={`${botao} border border-gold/50 text-foreground`}
          >
            Recarregar página
          </button>
        </>
      )}

      {(estado === "instalar-ios" || estado === "sem-suporte") && (
        <p className="text-xs text-muted-foreground">{MENSAGEM[estado]}</p>
      )}
    </div>
  );
}
