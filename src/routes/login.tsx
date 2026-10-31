import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Stethoscope } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Botao, Campo, Divisor } from "@/components/ui-kit";
import { urlDoSite } from "@/lib/plataforma";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Entrar · horaMed" },
      { name: "description", content: "Entre para organizar seus medicamentos e consultas." },
      { property: "og:title", content: "Entrar · horaMed" },
      { property: "og:description", content: "Sua saúde organizada de forma simples." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/hoje", replace: true });
  },
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);

  // ✅ RASTREADOR DE AFILIADOS
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      localStorage.setItem("afiliado_ref", ref);
      import("@/lib/supabase").then(({ supabase }) => {
        supabase.from("affiliate_clicks").insert({
          codigo_ref: ref,
          app_origem: "horaMed", // Mudamos para o novo app
        }).then(({ error }) => {
          if (error) console.error("Erro no rastreio:", error);
        });
      });
    }
  }, []);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setOcupado(false);
    if (error) { toast.error("E-mail ou senha incorretos."); return; }
    toast.success("Bem-vindo(a) de volta!");
    navigate({ to: "/hoje", replace: true });
  };

  const criar = async () => {
    if (!email || senha.length < 6) { toast.error("Informe e-mail e uma senha com pelo menos 6 caracteres."); return; }
    setOcupado(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: urlDoSite() },
    });
    setOcupado(false);
    if (error) { toast.error("Não foi possível criar a conta: " + error.message); return; }
    if (data.session) navigate({ to: "/hoje", replace: true });
    else toast.success("Conta criada! Confira seu e-mail para confirmar.");
  };

  const esqueci = async () => {
    if (!email) { toast.error("Digite seu e-mail primeiro."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${urlDoSite()}/redefinir-senha`,
    });
    if (error) { toast.error("Não foi possível enviar o e-mail."); return; }
    toast.success("Enviamos um link para redefinir sua senha.");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="text-center">
        {/* Substituímos a imagem por um ícone médico */}
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-sky-100 text-sky-600">
          <Stethoscope className="h-10 w-10" />
        </div>
        <h1 className="mt-2 text-3xl font-display font-bold italic text-[#2C4A6B]">horaMed</h1>
        <p className="mt-1 text-muted-foreground">Sua saúde organizada de forma simples.</p>
      </div>
      
      <Divisor />
      
      <form onSubmit={entrar} className="notebook space-y-4 p-6">
        <Campo label="E-mail">
          <input className="field" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo label="Senha">
          <input className="field" type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Campo>
        <Botao type="submit" disabled={ocupado} className="w-full">Entrar</Botao>
        <Botao type="button" variant="outline" disabled={ocupado} onClick={criar} className="w-full">Criar minha conta</Botao>
        <Botao type="button" variant="ghost" onClick={esqueci} className="w-full py-1 text-sm">Esqueci minha senha</Botao>
      </form>
    </main>
  );
}