import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import {
  ativarNotificacoes,
  desativarNotificacoes,
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

/** Estado e controles dos lembretes deste aparelho: ativar, reativar e desativar. */
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
      if (final === "ativas") toast.success("Lembretes ativados neste aparelho! 🩺");
      else if (final === "pendente")
        toast.error('Permissão não concedida. Toque em "Permitir" quando o navegador perguntar.');
    });

  const desativar = () =>
    executar(async () => {
      setEstado(await desativarNotificacoes());
      toast.success("Lembretes desligados neste aparelho.");
    });

  if (!estado) return null;

  const botao = "w-full rounded-2xl py-3 text-sm font-bold transition disabled:opacity-60";

  return (
    <div className="notebook space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-foreground">{TITULO[estado]}</p>
        <Link
          to="/configuracoes"
          aria-label="Configurações e permissões"
          className="shrink-0 rounded-full bg-muted p-2.5 text-accent"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>

      {estado === "ativas" && (
        <>
          <p className="text-xs text-muted-foreground">
            Você receberá um aviso no horário de cada medicação e outro 15 minutos depois, caso a dose ainda não tenha sido registrada.
          </p>
        </>
      )}

      {estado === "pendente" && (
        <>
          <p className="text-xs text-muted-foreground">
            Ative para receber avisos na hora de cada medicação. Se você disse "Agora não" antes, pode ativar aqui a qualquer momento.
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
          <p className="text-xs text-muted-foreground">{MENSAGEM.bloqueadas}</p>
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

/** Botão para desligar os lembretes neste aparelho (página de configurações, só no navegador). */
export function DesativarLembretes() {
  const [estado, setEstado] = useState<EstadoNotificacoes | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    estadoNotificacoes().then(setEstado);
  }, []);
  if (estado !== "ativas") return null;
  return (
    <button
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true);
        setEstado(await desativarNotificacoes());
        setOcupado(false);
        toast.success("Lembretes desligados neste aparelho.");
      }}
      className="w-full rounded-2xl border border-gray-300 py-3 text-sm font-bold text-gray-500 transition disabled:opacity-60"
    >
      Desativar lembretes neste aparelho
    </button>
  );
}