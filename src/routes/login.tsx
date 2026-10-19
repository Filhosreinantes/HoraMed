import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Botao, Campo, Divisor } from "@/components/ui-kit";
import { CheckoutPix } from "@/components/checkout-pix";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const [pixAberto, setPixAberto] = useState(false);

  // ✅ RASTREADOR DE AFILIADOS NA TELA DE LOGIN
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      localStorage.setItem("afiliado_ref", ref);
      import("@/lib/supabase").then(({ supabase }) => {
        supabase.from("affiliate_clicks").insert({
          codigo_ref: ref,
          app_origem: "Rotina Azul",
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
        <img src="/filhos.png" alt="Filhos Reinantes" className="mx-auto h-16 w-auto mb-4" />
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

      {/* ═══ LOJA FILHOS REINANTES ═══ */}
      <div className="mt-8 border-t border-gold/30 pt-6">
        <h2 className="mb-4 text-center font-display text-sm font-bold uppercase tracking-widest text-gold">
          Loja Filhos Reinantes
        </h2>

        <div className="space-y-3">
          {/* Card Rotina Azul (Clicável para comprar) */}
          <button
            onClick={() => setPixAberto(true)}
            className="notebook flex w-full items-center justify-between border-gold/40 p-4 text-left transition hover:bg-sky/20"
          >
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">Rotina Azul</h3>
              <p className="text-xs text-muted-foreground">Sua agenda de cuidados</p>
            </div>
            <div className="text-right">
              <span className="block rounded-full bg-gold/20 px-3 py-1 text-xs font-bold text-foreground">
                Assinar
              </span>
              <span className="mt-1 block text-sm font-bold text-gold">R$ 5,00/mês</span>
            </div>
          </button>
        </div>
      </div>

      {/* ═══ MODAL DE COMPRA PIX ═══ */}
      {pixAberto && <CheckoutPix emailInicial={email} onFechar={() => setPixAberto(false)} />}
    </main>
  );
}