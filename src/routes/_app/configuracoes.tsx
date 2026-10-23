import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlarmClock,
  ArrowLeft,
  Bell,
  BellOff,
  Battery,
  ChevronRight,
  Lock,
  Smartphone,
} from "lucide-react";
import type { ReactNode } from "react";
import { DesativarLembretes } from "@/components/notificacoes-cartao";
import { ehAppAndroid } from "@/lib/alarmes";

export const Route = createFileRoute("/_app/configuracoes")({
  head: () => ({ meta: [{ title: "Ajuda e configurações · Rotina Azul" }] }),
  component: Configuracoes,
});

const REGRAS: { icone: ReactNode; cor: string; titulo: string; texto: string }[] = [
  {
    icone: <Bell className="h-5 w-5" />,
    cor: "bg-sky text-accent",
    titulo: "🔔 Notificações",
    texto:
      "Necessário para exibir o alarme e o botão PARAR. Sem isso, você não será lembrado de tomar seus remédios.",
  },
  {
    icone: <AlarmClock className="h-5 w-5" />,
    cor: "bg-purple-100 text-purple-600",
    titulo: "⏰ Alarme exato",
    texto:
      "O alarme toca exatamente no horário definido. O Rotina Azul usa alarme de relógio do Android, então não precisa de nenhuma permissão extra para isso.",
  },
  {
    icone: <Smartphone className="h-5 w-5" />,
    cor: "bg-teal-100 text-teal-600",
    titulo: "📺 Aparecer no topo",
    texto:
      "Mostra a tela do alarme sobre a tela bloqueada. Essencial para você ver e parar o alarme quando ele tocar.",
  },
  {
    icone: <Battery className="h-5 w-5" />,
    cor: "bg-green-100 text-green-600",
    titulo: "🔋 Ignorar otimização de bateria",
    texto:
      "Evita que o sistema mate o alarme em segundo plano. Crucial para o app funcionar mesmo com o celular economizando bateria.",
  },
  {
    icone: <BellOff className="h-5 w-5" />,
    cor: "bg-red-100 text-red-500",
    titulo: "🔕 Modo Não Perturbe",
    texto:
      "Garante que o som do alarme toque mesmo com o celular no silencioso. Opcional, mas recomendado.",
  },
];

function Configuracoes() {
  const android = ehAppAndroid();
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign("/hoje")}
          aria-label="Voltar"
          className="rounded-full bg-muted p-2.5 text-accent hover:opacity-80 active:scale-95 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-2xl font-semibold italic">Ajuda e configurações</h1>
      </header>

      {android ? (
        <Link
          to="/confiabilidade"
          className="notebook flex items-center gap-3 p-4 transition active:scale-[0.99]"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-orange-100 text-orange-500">
            <AlarmClock className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <Lock className="h-4 w-4" /> Confiabilidade do alarme
            </p>
            <p className="text-sm text-muted-foreground">Verificar e corrigir permissões de alarme</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      ) : (
        <DesativarLembretes />
      )}

      {REGRAS.map((r) => (
        <div key={r.titulo} className="notebook flex gap-3 p-4">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${r.cor}`}>
            {r.icone}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{r.titulo}</p>
            <p className="text-sm text-muted-foreground">{r.texto}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
