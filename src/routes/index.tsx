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
    
    // ✅ Redireciona para /hoje se logado, senão para /login
    throw redirect({ 
      to: data.session ? "/hoje" : "/login", 
      search: (prev) => ({ ...prev, ...(ref ? { ref } : {}) }),
      replace: true 
    });
  },
});