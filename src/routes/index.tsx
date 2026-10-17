import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rotina Azul" },
      { name: "description", content: "Sua agenda de cuidados num só lugar." },
    ],
  }),
  beforeLoad: async () => {
    // 1. Verifica se o usuário já está logado
    const { data } = await supabase.auth.getSession();
    
    // 2. Se estiver logado, vai para o painel. Se não, vai para a tela de login bonita.
    throw redirect({ to: data.session ? "/acompanhamento" : "/login", replace: true });
  },
});