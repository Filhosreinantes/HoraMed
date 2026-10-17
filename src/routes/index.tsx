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
    const { data } = await supabase.auth.getSession();
    
    // Pega o ?ref= da URL, se existir
    const ref = new URLSearchParams(window.location.search).get("ref");
    
    // Vai para o acompanhamento se logado, senão vai para o login bonito.
    // O search: (prev) => prev garante que o ?ref= não se perca!
    throw redirect({ 
      to: data.session ? "/acompanhamento" : "/login", 
      search: (prev) => ({ ...prev, ...(ref ? { ref } : {}) }),
      replace: true 
    });
  },
});