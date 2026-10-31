import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Stethoscope } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Botao, Campo } from "@/components/ui-kit";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Redefinir senha · horaMed" },
      { name: "description", content: "Crie uma nova senha para sua conta no horaMed." },
      { property: "og:title", content: "Redefinir senha · horaMed" },
      { property: "og:description", content: "Crie uma nova senha para sua conta no horaMed." },
    ],
  }),
  component: Redefinir,
});

function Redefinir() {
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const navigate = useNavigate();

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    
    const { error } = await supabase.auth.updateUser({ password: senha });
    
    setOcupado(false);
    
    if (error) { 
      toast.error("Não foi possível alterar a senha. Tente novamente."); 
      return; 
    }
    
    toast.success("Senha alterada com sucesso!");
    navigate({ to: "/hoje", replace: true });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="text-center mb-6">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-sky-100 text-sky-600">
          <Stethoscope className="h-10 w-10" />
        </div>
        <h1 className="text-3xl font-display font-bold italic text-[#2C4A6B]">horaMed</h1>
      </div>

      <form onSubmit={salvar} className="notebook space-y-4 p-6">
        <h2 className="text-xl font-semibold text-center mb-2">Criar nova senha</h2>
        
        <Campo label="Nova senha (mínimo 6 caracteres)">
          <input 
            className="field" 
            type="password" 
            minLength={6} 
            required 
            value={senha} 
            onChange={(e) => setSenha(e.target.value)} 
            placeholder="Digite sua nova senha"
          />
        </Campo>
        
        <Botao type="submit" disabled={ocupado} className="w-full">
          {ocupado ? "Salvando..." : "Salvar nova senha"}
        </Botao>
      </form>
    </main>
  );
}