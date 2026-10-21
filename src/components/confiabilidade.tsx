import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { App as AppNativo } from "@capacitor/app";
import { toast } from "sonner";
import {
  corrigirBateria,
  corrigirNotificacoes,
  corrigirTelaCheia,
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
    chave: "telaCheia",
    titulo: "📺 Aparecer sobre a tela bloqueada",
    texto: "Mostra a tela do alarme, com os botões, mesmo com o celular bloqueado.",
    corrigir: corrigirTelaCheia,
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
export function useConfiabilidade() {
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

export function Lista({ estado, verificar }: { estado: Confiabilidade; verificar: () => void }) {
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

export const tudoCerto = (e: Confiabilidade) => e.notificacoes && e.telaCheia && e.bateria;

/** Cartão do perfil no app Android: resumo e atalho para as configurações. */
export function ConfiabilidadeCartao() {
  const { estado } = useConfiabilidade();
  if (!estado) return null;

  return (
    <div className="notebook space-y-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-foreground">
          {tudoCerto(estado)
            ? "✅ Lembretes prontos neste celular"
            : "⚠️ Ajuste os lembretes deste celular"}
        </p>
        <Link
          to="/configuracoes"
          aria-label="Configurações e permissões"
          className="shrink-0 rounded-full bg-muted p-2.5 text-accent"
        >
          <Settings className="h-5 w-5" />
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        O alarme toca no horário de cada remédio, mesmo sem internet, e continua tocando até você
        tocar em "Já tomei" ou "Adiar".
      </p>
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
