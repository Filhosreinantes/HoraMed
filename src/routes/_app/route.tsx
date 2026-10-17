import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Calendar, Plus, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AppProvider, useApp } from "@/lib/app-store";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", replace: true });
    return { user: data.session.user };
  },
  component: Layout,
});

const CORES: Record<string, { cor: string; claro: string; escuro: string }> = {
  azul: { cor: "#5B92C7", claro: "#E8F1F9", escuro: "#2C4A6B" },
  rosa: { cor: "#D18CA0", claro: "#FBE5EC", escuro: "#8B3E58" },
  verde: { cor: "#6FB89A", claro: "#DCF0E7", escuro: "#3D8064" },
  "lilás": { cor: "#9B8FC7", claro: "#EDE7F5", escuro: "#524880" },
  lilas: { cor: "#9B8FC7", claro: "#EDE7F5", escuro: "#524880" },
};

function Layout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_OUT") navigate({ to: "/login", replace: true });
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
  // ✅ Agora dentro do AppProvider → useApp() funciona
  const { ativa } = useApp();
  const tema = CORES[ativa?.tema || "azul"] ?? CORES.azul;

  const tab = "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-semibold";

  return (
    <div
      style={
        {
          "--tema": tema.cor,
          "--tema-claro": tema.claro,
          "--tema-escuro": tema.escuro,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto min-h-screen max-w-lg px-4 pb-28 pt-6">
        <Outlet />
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/40 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          <Link to="/acompanhamento" className={tab} activeProps={{ className: "text-primary" }} inactiveProps={{ className: "text-muted-foreground" }}>
            <Calendar className="h-6 w-6" /> Acompanhamento
          </Link>
          <Link to="/criar" className={tab} activeProps={{ className: "text-primary" }} inactiveProps={{ className: "text-muted-foreground" }}>
            <span className="-mt-6 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft">
              <Plus className="h-6 w-6" />
            </span>
            Criar
          </Link>
          <Link to="/perfil" className={tab} activeProps={{ className: "text-primary" }} inactiveProps={{ className: "text-muted-foreground" }}>
            <User className="h-6 w-6" /> Perfil
          </Link>
        </div>
      </nav>
    </div>
  );
}