import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, Plus, Activity, Settings, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AppProvider, useApp } from "@/lib/app-store";
import { ehAppAndroid, limparAlarmes } from "@/lib/alarmes";
import { CheckoutPix } from "@/components/checkout-pix";
import { PLANOS, reais } from "@/lib/planos";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { ConfiabilidadePrompt } from "@/components/confiabilidade";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", replace: true });
    return { user: data.session.user };
  },
  component: Layout,
});

type Cores = { cor: string; claro: string; escuro: string };
const AZUL: Cores = { cor: "#5B92C7", claro: "#E8F1F9", escuro: "#2C4A6B" };

function Layout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_OUT") {
        limparAlarmes();
        navigate({ to: "/login", replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  return (
    <AppProvider user={user}>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { user, assinaturaAtiva, checarAssinatura } = useApp();
  const [comprando, setComprando] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ehConfiguracoes = pathname.startsWith("/configuracoes");
  
  const tema = AZUL;
  const tab = "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-semibold";

  // 1. TELA DE CARREGAMENTO DA ASSINATURA
  if (assinaturaAtiva === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7]">
        <p className="text-sm font-semibold text-[#7A8A9A]">Verificando sua conta...</p>
      </div>
    );
  }

  // 2. ERRO NA VERIFICAÇÃO
  if (assinaturaAtiva === "erro") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FDFBF7] p-6 text-center">
        <p className="text-sm font-semibold text-[#7A8A9A]">Não foi possível verificar sua assinatura.</p>
        <button onClick={checarAssinatura} className="rounded-2xl bg-[#5B92C7] px-6 py-3 text-sm font-bold text-white shadow-md">
          Tentar de novo
        </button>
      </div>
    );
  }

  // 3. TELA DE VENDAS (PAYWALL)
  if (assinaturaAtiva === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FDFBF7] p-6 text-center">
        <div className="w-full max-w-sm rounded-3xl border border-[#B8933F]/40 bg-white p-8 shadow-xl">
          <span className="text-5xl">🩺</span>
          <h2 className="mt-4 font-display text-2xl font-bold italic text-[#2C4A6B]">
            Bem-vindo(a) ao horaMed
          </h2>
          
          {ehAppAndroid() ? (
            <p className="mt-2 text-sm text-[#7A8A9A]">
              Sua assinatura não está ativa nesta conta.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-[#7A8A9A]">
                Organize seus medicamentos, consultas e exames de forma simples e segura.
              </p>
              <button
                onClick={() => setComprando(true)}
                className="mt-6 block w-full rounded-2xl bg-[#5B92C7] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#4a7eb3]"
              >
                Liberar acesso por {reais(PLANOS.mensal.centavos)}/mês
              </button>
            </>
          )}
          
          <button onClick={checarAssinatura} className="mt-3 block w-full text-xs font-semibold text-[#5B92C7]">
            Já paguei · verificar de novo
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-4 text-xs font-semibold text-[#7A8A9A] underline-offset-4 hover:underline"
          >
            Sair da conta
          </button>
        </div>
        {comprando && (
          <CheckoutPix
            emailInicial={user.email ?? ""}
            onFechar={() => setComprando(false)}
            onPago={checarAssinatura}
          />
        )}
      </div>
    );
  }

  // 4. APP LIBERADO (ASSINATURA OK)
  return (
    <div
      style={{
        "--tema": tema.cor,
        "--tema-claro": tema.claro,
        "--tema-escuro": tema.escuro,
      } as React.CSSProperties}
    >
      <div className="relative mx-auto min-h-screen max-w-lg px-4 pb-28 pt-6">
        <div className="absolute right-4 top-5 z-30 flex items-center gap-2">
          {/* Badge indicando que a conta é paga */}
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs font-bold tracking-wider text-emerald-700 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>ATIVO</span>
          </div>

          {!ehConfiguracoes && (
            <Link
              to="/perfil"
              aria-label="Perfil"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[var(--tema-escuro)] shadow-sm border border-[var(--tema)]/30 backdrop-blur-sm transition hover:bg-white hover:shadow hover:scale-105 active:scale-95"
            >
              <Settings className="h-5 w-5" />
            </Link>
          )}
        </div>
        
        <Outlet />
      </div>

      {/* Manter os avisos de permissão para os alarmes de medicação funcionarem perfeitamente */}
      {ehAppAndroid() ? <ConfiabilidadePrompt /> : <NotificationPrompt />}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/40 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          <Link to="/hoje" className={tab} activeProps={{ className: "text-primary" }} inactiveProps={{ className: "text-muted-foreground" }}>
            <Home className="h-6 w-6" /> Hoje
          </Link>
          
          <Link to="/criar" className={tab} activeProps={{ className: "text-primary" }} inactiveProps={{ className: "text-muted-foreground" }}>
            <span className="-mt-6 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft">
              <Plus className="h-6 w-6" />
            </span>
            Criar
          </Link>
          
          <Link to="/acompanhamento" className={tab} activeProps={{ className: "text-primary" }} inactiveProps={{ className: "text-muted-foreground" }}>
            <Activity className="h-6 w-6" /> Acompanhar
          </Link>
        </div>
      </nav>
    </div>
  );
}