import { useCallback, useEffect, useState } from "react";
import { App as AppNativo } from "@capacitor/app";
import { toast } from "sonner";
import {
  corrigirAlarmeExato,
  corrigirBateria,
  corrigirNotificacoes,
  testarAlarme,
  verificarConfiabilidade,
  type Confiabilidade,
} from "@/lib/alarmes";

const ITENS: {
  chave: keyof Confiabilidade;
  titulo: string;
  texto: string;
  corrigir: () => Promise<unknown>;
}[] = [
  {
    chave: "notificacoes",
    titulo: "🔔 Notificações",
    texto: "Necessário para mostrar os lembretes.",
    corrigir: corrigirNotificacoes,
  },
  {
    chave: "alarmeExato",
    titulo: "⏰ Alarme exato",
    texto: "Faz o lembrete tocar exatamente no horário do remédio.",
    corrigir: corrigirAlarmeExato,
  },
  {
    chave: "bateria",
    titulo: "🔋 Sem economia de bateria",
    texto:
      'Evita que o celular atrase os alarmes. Na lista, escolha "Todos os apps", toque em Rotina Azul e marque "Não otimizar".',
    corrigir: corrigirBateria,
  },
];

/** Estado das permissões, atualizado ao voltar das configurações do Android. */
function useConfiabilidade() {
  const [estado, setEstado] = useState<Confiabilidade | null>(null);
  const verificar = useCallback(
    () =>
      verificarConfiabilidade()
        .then(setEstado)
        .catch((e) => console.error("Erro ao verificar permissões:", e)),
    [],
  );
  useEffect(() => {
    verificar();
    const ouvinte = AppNativo.addListener("resume", verificar);
    return () => {
      ouvinte.then((o) => o.remove());
    };
  }, [verificar]);
  return { estado, verificar };
}

function Lista({ estado, verificar }: { estado: Confiabilidade; verificar: () => void }) {
  const corrigir = async (acao: () => Promise<unknown>) => {
    try {
      await acao();
    } catch (e) {
      console.error("Erro ao abrir configuração:", e);
      toast.error(
        "Não foi possível abrir a configuração. Procure o Rotina Azul nas configurações do celular.",
      );
    }
    verificar();
  };

  return (
    <div className="space-y-2">
      {ITENS.map((item) => {
        const ok = estado[item.chave];
        return (
          <div
            key={item.chave}
            className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-card p-3"
          >
            <span className="text-xl" aria-label={ok ? "ok" : "pendente"}>
              {ok ? "✅" : "❗"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{item.titulo}</p>
              <p className="text-xs text-muted-foreground">{item.texto}</p>
            </div>
            {!ok && (
              <button
                onClick={() => corrigir(item.corrigir)}
                className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
              >
                Corrigir
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const tudoCerto = (e: Confiabilidade) => e.notificacoes && e.alarmeExato && e.bateria;

/** Cartão do perfil no app Android: permissões dos alarmes e teste. */
export function ConfiabilidadeCartao() {
  const { estado, verificar } = useConfiabilidade();
  if (!estado) return null;

  const testar = async () => {
    try {
      await testarAlarme();
      toast.success("O alarme de teste toca em 5 segundos.");
    } catch (e) {
      console.error("Erro no teste:", e);
      toast.error("Não foi possível agendar o teste.");
    }
  };

  return (
    <div className="notebook space-y-3 p-4">
      <p className="font-semibold text-foreground">
        {tudoCerto(estado)
          ? "✅ Lembretes prontos neste celular"
          : "⚠️ Ajuste os lembretes deste celular"}
      </p>
      <p className="text-xs text-muted-foreground">
        Os lembretes tocam como alarme no horário de cada remédio, mesmo sem internet, e de novo 15
        minutos depois se a dose não for registrada.
      </p>
      <Lista estado={estado} verificar={verificar} />
      <button
        onClick={testar}
        disabled={!estado.notificacoes}
        className="w-full rounded-2xl border border-gold/50 py-3 text-sm font-bold text-foreground transition disabled:opacity-60"
      >
        🔔 Testar alarme
      </button>
    </div>
  );
}

const CHAVE = "rotina-azul:confiabilidade-perguntada";

/** Na primeira vez no app, mostra o que falta liberar para os alarmes tocarem. */
export function ConfiabilidadePrompt() {
  const { estado, verificar } = useConfiabilidade();
  const [aberto, setAberto] = useState(() => {
    try {
      return !localStorage.getItem(CHAVE);
    } catch {
      return true;
    }
  });

  const fechar = () => {
    try {
      localStorage.setItem(CHAVE, "sim");
    } catch {
      // ignora
    }
    setAberto(false);
  };

  if (!aberto || !estado || tudoCerto(estado)) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-xl">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-foreground">Ative os Lembretes</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Para o alarme tocar na hora dos remédios, libere os itens abaixo. Você pode mudar isso
            depois no Perfil.
          </p>
        </div>
        <Lista estado={estado} verificar={verificar} />
        <button
          onClick={fechar}
          className="w-full rounded-2xl border border-gray-300 py-3 text-sm font-bold text-gray-500"
        >
          {estado.notificacoes ? "Pronto" : "Agora não"}
        </button>
      </div>
    </div>
  );
}
