import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/lo")({
  beforeLoad: ({ location }) => {
    // Pega o ?ref= que estava na URL (se houver)
    const ref = new URLSearchParams(location.search).get("ref");
    
    // Redireciona imediatamente para a tela de login bonita,
    // mantendo o ?ref= para o rastreador funcionar!
    throw redirect({ 
      to: "/login", 
      search: ref ? { ref } : undefined,
      replace: true 
    });
  },
});