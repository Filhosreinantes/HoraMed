import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Botao, Campo } from "@/components/ui-kit";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Redefinir senha · Rotina Azul" },
      { name: "description", content: "Crie uma nova senha para sua conta." },
      { property: "og:title", content: "Redefinir senha · Rotina Azul" },
      { property: "og:description", content: "Crie uma nova senha para sua conta." },
    ],
  }),
  component: Redefinir,
});

function Redefinir() {
  const [senha, setSenha] = useState("");
  const navigate = useNavigate();
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) { toast.error("Não foi possível alterar a senha."); return; }
    toast.success("Senha alterada!");
    navigate({ to: "/acompanhamento", replace: true });
  }; // TESTE 
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <form onSubmit={salvar} className="notebook space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Nova senha</h1>
        <Campo label="Nova senha">
          <input className="field" type="password" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <Botao type="submit" className="w-full">Salvar senha</Botao>
      </form>
    </main>
  );
}
