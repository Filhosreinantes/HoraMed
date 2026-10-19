import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import {
  ativarNotificacoes,
  estadoNotificacoes,
  MENSAGEM,
  type EstadoNotificacoes,
} from "@/lib/notificacoes";

const CHAVE = "rotina-azul:notificacao-perguntada";

/** Convite para ativar os lembretes, mostrado uma vez por aparelho depois do login. */
export function NotificationPrompt() {
  const { user } = useApp();
  const [estado, setEstado] = useState<EstadoNotificacoes | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let ativo = true;
    let perguntado = false;
    try {
      perguntado = !!localStorage.getItem(CHAVE);
    } catch {
      // sem localStorage: pergunta mesmo assim
    }
    if (perguntado) return;
    estadoNotificacoes().then((e) => {
      // Só incomoda quando dá para fazer algo: ativar agora ou instalar no iPhone.
      if (ativo && (e === "pendente" || e === "instalar-ios")) setEstado(e);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const lembrarResposta = () => {
    try {
      localStorage.setItem(CHAVE, "sim");
    } catch {
      // ignora
    }
    setEstado(null);
  };

  const ativar = async () => {
    setCarregando(true);
    try {
      const final = await ativarNotificacoes(user.id);
      if (final === "ativas") toast.success("Lembretes ativados! 💙");
      else if (final === "pendente")
        toast.error('Permissão não concedida. Toque em "Permitir" para receber os lembretes.');
      else toast.error(MENSAGEM[final], { duration: 8000 });
    } catch (error) {
      console.error("Erro ao pedir permissão", error);
      toast.error("Não foi possível ativar os lembretes.");
    } finally {
      setCarregando(false);
      lembrarResposta();
    }
  };

  if (!estado) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky text-3xl shadow-sm">
          🔔
        </div>

        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Ative os Lembretes</h2>
          {estado === "instalar-ios" ? (
            <p className="mt-2 text-sm text-muted-foreground">{MENSAGEM["instalar-ios"]}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Para te avisar na hora dos remédios, o navegador vai pedir sua permissão.
              <br />
              <br />
              <strong className="text-primary">Toque em "Permitir"</strong> para não perder nenhum
              horário. Prometemos não enviar spam! 💙
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {estado === "pendente" && (
            <button
              onClick={ativar}
              disabled={carregando}
              className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
            >
              {carregando ? "Ativando..." : "Quero receber lembretes"}
            </button>
          )}
          <button
            onClick={lembrarResposta}
            disabled={carregando}
            className="w-full rounded-2xl border border-gray-300 py-3 text-sm font-bold text-gray-500"
          >
            {estado === "pendente" ? "Agora não" : "Entendi"}
          </button>
        </div>
      </div>
    </div>
  );
}
