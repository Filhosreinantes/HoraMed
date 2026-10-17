import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Botao, Campo, Divisor } from "@/components/ui-kit";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar · Rotina Azul" },
      { name: "description", content: "Entre para ver a agenda de cuidados dos seus Tesouros." },
      { property: "og:title", content: "Entrar · Rotina Azul" },
      { property: "og:description", content: "Sua agenda de cuidados num só lugar." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/acompanhamento", replace: true });
  },
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcupado(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setOcupado(false);
    if (error) { toast.error("E-mail ou senha incorretos."); return; }
    toast.success("Bem-vinda de volta!");
    navigate({ to: "/acompanhamento", replace: true });
  };

  const criar = async () => {
    if (!email || senha.length < 6) { toast.error("Informe e-mail e uma senha com pelo menos 6 caracteres."); return; }
    setOcupado(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: window.location.origin },
    });
    setOcupado(false);
    if (error) { toast.error("Não foi possível criar a conta: " + error.message); return; }
    if (data.session) navigate({ to: "/acompanhamento", replace: true });
    else toast.success("Conta criada! Confira seu e-mail para confirmar.");
  };

  const esqueci = async () => {
    if (!email) { toast.error("Digite seu e-mail primeiro."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) { toast.error("Não foi possível enviar o e-mail."); return; }
    toast.success("Enviamos um link para redefinir sua senha.");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="text-center">
        <img src="/filhos.png" alt="Mãe abraçando seus filhos" width={140} height={140} className="mx-auto h-36 w-36" />
        <h1 className="mt-2 text-3xl font-semibold">Rotina Azul</h1>
        <p className="mt-1 text-muted-foreground">Sua agenda de cuidados num só lugar.</p>
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
