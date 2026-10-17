import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Rotina Azul" },
      { name: "description", content: "Sua agenda de cuidados num só lugar." },
      { property: "og:title", content: "Rotina Azul" },
      { property: "og:description", content: "Sua agenda de cuidados num só lugar." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/acompanhamento" : "/login", replace: true });
  },
});
