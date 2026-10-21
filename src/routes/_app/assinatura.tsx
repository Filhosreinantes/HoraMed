import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlarmClock,
  ArrowLeft,
  Ban,
  Award,
  Check,
  ChevronRight,
  Gem,
  Gift,
  History,
  RefreshCw,
  Settings,
  Star,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import { ehVitalicio } from "@/lib/planos";
import { ehAppAndroid } from "@/lib/plataforma";

export const Route = createFileRoute("/_app/assinatura")({
  head: () => ({ meta: [{ title: "Minha assinatura · Rotina Azul" }] }),
  component: Assinatura,
});

const GRATIS: { icone: ReactNode; texto: string; cor: string }[] = [
  { icone: <AlarmClock className="h-4 w-4" />, texto: "2 alarmes", cor: "bg-muted text-muted-foreground" },
  { icone: <Ban className="h-4 w-4" />, texto: "Alarme simples", cor: "bg-red-100 text-red-500" },
  { icone: <History className="h-4 w-4" />, texto: "Histórico limitado", cor: "bg-muted text-muted-foreground" },
];

const PREMIUM: { icone: ReactNode; texto: string }[] = [
  { icone: <AlarmClock className="h-4 w-4" />, texto: "Alarmes ilimitados" },
  { icone: <Ban className="h-4 w-4" />, texto: "Alarme com tela cheia" },
  { icone: <Users className="h-4 w-4" />, texto: "Vários Tesouros" },
  { icone: <History className="h-4 w-4" />, texto: "Histórico completo" },
];

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function Assinatura() {
  const { assinaturaAtiva, assinaturaAte, checarAssinatura } = useApp();
  const premium = assinaturaAtiva === true;
  const android = ehAppAndroid();

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link to="/perfil" aria-label="Voltar" className="rounded-full bg-muted p-2.5 text-accent">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-2xl font-semibold italic">Minha assinatura</h1>
      </header>

      {/* Plano atual */}
      <div className="notebook flex items-center gap-4 p-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sky text-accent">
          <Star className="h-7 w-7 fill-current" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent">Plano atual</p>
          <p className="font-display text-2xl font-bold">{premium ? "Premium" : "Grátis"}</p>
        </div>
        {premium && assinaturaAte && (
          <span className="shrink-0 rounded-full border border-accent/30 bg-sky px-3 py-1.5 text-xs font-bold text-accent">
            {ehVitalicio(assinaturaAte) ? "Vitalício" : `Até ${formatarData(assinaturaAte)}`}
          </span>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Comparativo de benefícios</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="notebook space-y-3 p-4">
            <div className="flex flex-col items-center gap-2">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <Gift className="h-6 w-6" />
              </span>
              <p className="font-display font-bold uppercase text-muted-foreground">Grátis</p>
            </div>
            <ul className="space-y-2">
              {GRATIS.map((b) => (
                <li key={b.texto} className="flex items-center gap-2 border-t border-border/50 pt-2 text-sm font-medium">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${b.cor}`}>{b.icone}</span>
                  {b.texto}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-4">
            <div className="flex flex-col items-center gap-2">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white shadow-md">
                <Award className="h-6 w-6" />
              </span>
              <p className="font-display font-bold uppercase text-emerald-600">Premium</p>
            </div>
            <ul className="space-y-2">
              {PREMIUM.map((b) => (
                <li key={b.texto} className="flex items-center gap-2 border-t border-emerald-200 pt-2 text-sm font-medium">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
                    {b.icone}
                  </span>
                  <span className="min-w-0 flex-1">{b.texto}</span>
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Compra só no site: a Play Store exige o Google Play para vender dentro do app. */}
      {android ? (
        <p className="rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground">
          Para assinar ou renovar, acesse o site do Rotina Azul.
        </p>
      ) : (
        <Link
          to="/planos"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-base font-bold text-white shadow-soft"
        >
          <Gem className="h-5 w-5" /> {premium && assinaturaAte && ehVitalicio(assinaturaAte) ? "Ver planos" : premium ? "Renovar assinatura" : "Ver planos disponíveis"}
        </Link>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold uppercase">Ajuda e configurações</h2>
        <div className="notebook divide-y divide-border/60">
          <button
            onClick={async () => {
              await checarAssinatura();
              toast.success("Assinatura atualizada.");
            }}
            className="flex w-full items-center gap-3 p-4 text-left"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky text-accent">
              <RefreshCw className="h-5 w-5" />
            </span>
            <span className="flex-1 font-semibold">Atualizar compras</span>
            <ChevronRight className="h-5 w-5 text-accent" />
          </button>
          <Link to="/configuracoes" className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky text-accent">
              <Settings className="h-5 w-5" />
            </span>
            <span className="flex-1 font-semibold">Configurações e permissões</span>
            <ChevronRight className="h-5 w-5 text-accent" />
          </Link>
        </div>
      </section>

    </div>
  );
}
