import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Award, Check, History, Lock, RefreshCw, Users, X, FileText, Sparkles, BellRing, UserCircle, ShieldPlus, Activity } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { CheckoutPix } from "@/components/checkout-pix";
import { useApp } from "@/lib/app-store";
import { ORDEM_PLANOS, PLANOS, reais, type PlanoId } from "@/lib/planos";
import { ehAppAndroid } from "@/lib/plataforma";

export const Route = createFileRoute("/_app/planos")({
  head: () => ({ meta: [{ title: "Seja Premium · horaMed" }] }),
  component: Planos,
});

// Tabela de comparação específica para o horaMed
const LINHAS: { gratis?: string; premium: string; icone: ReactNode }[] = [
  { gratis: "1 Perfil", premium: "Perfis de pacientes ilimitados", icone: <Users className="h-4 w-4" /> },
  { gratis: "Até 3 alarmes", premium: "Alarmes ilimitados", icone: <BellRing className="h-4 w-4" /> },
  { gratis: "Histórico básico", premium: "Histórico completo de Pressão e Glicose", icone: <Activity className="h-4 w-4" /> },
  { gratis: "Com anúncios", premium: "Sem anúncios", icone: <Sparkles className="h-4 w-4" /> },
  { premium: "Relatórios médicos ilimitados", icone: <FileText className="h-4 w-4" /> },
];

function Planos() {
  const { user, checarAssinatura } = useApp();
  const navigate = useNavigate();
  const [comprando, setComprando] = useState(false);
  const [escolhido, setEscolhido] = useState<PlanoId>("anual");

  // Na Play Store, assinatura dentro do app só pode ser vendida pelo Google Play.
  if (ehAppAndroid()) {
    return (
      <div className="space-y-4">
        <Link
          to="/assinatura"
          aria-label="Fechar"
          className="inline-block rounded-full bg-muted p-2.5"
        >
          <X className="h-5 w-5" />
        </Link>
        <p className="notebook p-4 text-center text-sm text-muted-foreground">
          Para assinar ou renovar o Premium, acesse o site oficial do horaMed pelo navegador do seu celular.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link to="/assinatura" aria-label="Fechar" className="rounded-full p-2 text-foreground hover:bg-muted transition">
          <X className="h-6 w-6" />
        </Link>
        <button
          onClick={async () => {
            await checarAssinatura();
            toast.success("Compras restauradas.");
          }}
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition"
        >
          <RefreshCw className="h-4 w-4" /> Restaurar
        </button>
      </header>

      <h1 className="text-center font-display text-4xl font-bold">Seja Premium</h1>

      <div className="notebook space-y-2 p-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted p-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-muted-foreground">
              <Lock className="h-4 w-4" />
            </span>
            <span className="font-bold uppercase text-muted-foreground">Grátis</span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white">
              <Award className="h-4 w-4" />
            </span>
            <span className="font-bold uppercase text-emerald-600">Premium</span>
          </div>
        </div>
        {LINHAS.map((l) => (
          <div
            key={l.premium}
            className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-2.5 text-sm font-semibold"
          >
            <span
              className={`flex items-center gap-2 ${l.gratis ? "" : "text-muted-foreground/70"}`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                {l.gratis ? l.icone : <X className="h-4 w-4" />}
              </span>
              {l.gratis ?? l.premium}
            </span>
            <span className="flex items-center gap-2 border-l border-border/60 pl-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                {l.icone}
              </span>
              {l.premium}
            </span>
          </div>
        ))}
      </div>

      <p className="text-center text-muted-foreground">
        Desbloqueie todos os recursos do horaMed e cuide da sua saúde sem limites.
      </p>

      <div className="space-y-3">
        {ORDEM_PLANOS.map((id) => {
          const p = PLANOS[id];
          const ativo = escolhido === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setEscolhido(id)}
              aria-pressed={ativo}
              className={`relative flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${
                ativo ? "border-emerald-500 bg-emerald-50" : "border-border bg-white"
              }`}
            >
              {id === "anual" && (
                <span className="absolute -top-3 right-4 rounded-full bg-yellow-400 px-3 py-0.5 text-[11px] font-bold uppercase text-yellow-950 shadow-xs">
                  Melhor escolha
                </span>
              )}
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${
                  ativo ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"
                }`}
              >
                {ativo && <Check className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold">{p.nome}</p>
                <p className="text-sm text-muted-foreground">{p.descricao}</p>
              </div>
              <div className="text-right">
                <p className={`font-display text-2xl font-bold ${ativo ? "text-emerald-600" : ""}`}>
                  {reais(p.centavos)}
                </p>
                <p className="text-xs text-muted-foreground">{p.cobranca}</p>
              </div>
            </button>
          );
        })}
        <p className="text-center text-xs text-muted-foreground">Pagamento por PIX.</p>
      </div>

      <button
        onClick={() => setComprando(true)}
        className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-bold uppercase tracking-wide text-white shadow-soft"
      >
        Ativar agora
      </button>

      {comprando && (
        <CheckoutPix
          emailInicial={user.email ?? ""}
          plano={escolhido}
          onFechar={() => setComprando(false)}
          onPago={async () => {
            await checarAssinatura();
            navigate({ to: "/assinatura" });
          }}
        />
      )}
    </div>
  );
}