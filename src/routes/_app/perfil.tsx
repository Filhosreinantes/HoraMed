import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, LogOut } from "lucide-react";
import { toast } from "sonner";
import { NotificacoesCartao } from "@/components/notificacoes-cartao";
import { ConfiabilidadeCartao } from "@/components/confiabilidade";
import { ehAppAndroid } from "@/lib/alarmes";
import { useApp } from "@/lib/app-store";
import { supabase } from "@/lib/supabase";
import { formatData, nowLocalISO, uid, type Pessoa } from "@/lib/cuidados";
import { Botao, Campo, Divisor, SeletorTesouro } from "@/components/ui-kit";

export const Route = createFileRoute("/_app/perfil")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Perfil · Rotina Azul" },
      { name: "description", content: "Gerencie seus Tesouros e sua conta." },
      { property: "og:title", content: "Perfil · Rotina Azul" },
      { property: "og:description", content: "Gerencie seus Tesouros e sua conta." },
    ],
  }),
  component: Perfil,
});

const EMOJIS_PESSOAS = [
  "👩", "👨", "👧", "👦", "🧑", "👵", "👴",
  "👩‍🦱", "👨‍🦱", "👱‍♀️", "👱", "🧔",
  "👩🏾", "👨🏿", "👩🏼", "🧒",
];
const TEMAS = ["azul", "rosa", "verde", "amarelo", "lilás"];

function Perfil() {
  const { ativa, user, recarregar, setAtivaId } = useApp();
  const [form, setForm] = useState<Partial<Pessoa> | null>(null);
  const [sair, setSair] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form?.nome) { toast.error("Informe o nome."); return; }
    const agora = nowLocalISO();
    const campos = {
      nome: form.nome, emoji: form.emoji || "👧", tema: form.tema || "azul",
      nascimento: form.nascimento || null, nome_mae: form.nome_mae || null,
      nome_pai: form.nome_pai || null, responsavel: form.responsavel || null, atualizado_em: agora,
    };
    if (form.id) {
      const { error } = await supabase.from("pedacinho_pessoas").update(campos).eq("id", form.id).eq("user_id", user.id);
      if (error) { toast.error("Não foi possível salvar."); return; }
      toast.success("Tesouro atualizado!");
    } else {
      const id = uid();
      const { error } = await supabase.from("pedacinho_pessoas").insert({ ...campos, id, user_id: user.id, criado_em: agora });
      if (error) { toast.error("Não foi possível adicionar."); return; }
      setAtivaId(id);
      toast.success("Novo Tesouro adicionado!");
    }
    setForm(null);
    recarregar();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Perfil</h1>
      <SeletorTesouro prefixo="Tesouro Ativo" />

      {ativa && (
        <div className="notebook flex items-center gap-4 p-5">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-gold-soft text-4xl">{ativa.emoji || "👧"}</span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-semibold italic">{ativa.nome}</p>
            {ativa.nascimento && <p className="text-sm text-muted-foreground">Nasceu em {formatData(ativa.nascimento)}</p>}
          </div>
          <button aria-label="Editar Tesouro" onClick={() => setForm(ativa)} className="rounded-full bg-muted p-2.5 text-accent">
            <Pencil className="h-5 w-5" />
          </button>
        </div>
      )}

      <Botao variant="outline" className="flex w-full items-center justify-center gap-2" onClick={() => setForm({ emoji: "👧", tema: "azul" })}>
        <Plus className="h-5 w-5" /> Adicionar outro Tesouro
      </Botao>

      {/* Lembretes: ativar, reativar, desativar e testar neste aparelho */}
      {ehAppAndroid() ? <ConfiabilidadeCartao /> : <NotificacoesCartao />}

      <Divisor />

      <Botao variant="danger" className="flex w-full items-center justify-center gap-2" onClick={() => setSair(true)}>
        <LogOut className="h-5 w-5" /> Sair da conta
      </Botao>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-3 sm:items-center" onClick={() => setForm(null)}>
          <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} className="notebook max-h-[88vh] w-full max-w-md space-y-3 overflow-y-auto p-5">
            <h2 className="text-xl font-semibold">{form.id ? "Editar Tesouro" : "Novo Tesouro"}</h2>
            <Campo label="Nome"><input className="field" required value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Campo>
            <Campo label="Data de nascimento"><input className="field" type="date" value={form.nascimento ?? ""} onChange={(e) => setForm({ ...form, nascimento: e.target.value })} /></Campo>
            <Campo label="Nome da mãe"><input className="field" value={form.nome_mae ?? ""} onChange={(e) => setForm({ ...form, nome_mae: e.target.value })} /></Campo>
            <Campo label="Nome do pai"><input className="field" value={form.nome_pai ?? ""} onChange={(e) => setForm({ ...form, nome_pai: e.target.value })} /></Campo>
            <Campo label="Responsável"><input className="field" value={form.responsavel ?? ""} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} /></Campo>
            <div>
              <p className="mb-1.5 text-sm font-semibold">Emoji</p>
              <div className="flex flex-wrap gap-2">
                {EMOJIS_PESSOAS.map((em) => (
                  <button type="button" key={em} onClick={() => setForm({ ...form, emoji: em })}
                    className={`grid h-11 w-11 place-items-center rounded-full text-2xl ${form.emoji === em ? "bg-sky ring-2 ring-accent" : "bg-muted"}`}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <Campo label="Tema">
              <select className="field" value={form.tema ?? "azul"} onChange={(e) => setForm({ ...form, tema: e.target.value })}>
                {TEMAS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Campo>
            <div className="flex gap-2 pt-2">
              <Botao type="button" variant="outline" className="flex-1" onClick={() => setForm(null)}>Cancelar</Botao>
              <Botao type="submit" className="flex-1">Salvar</Botao>
            </div>
          </form>
        </div>
      )}

      {sair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setSair(false)}>
          <div onClick={(e) => e.stopPropagation()} className="notebook w-full max-w-sm p-6 text-center">
            <h2 className="text-xl font-semibold">Sair da conta?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Você precisará entrar novamente com seu e-mail e senha.</p>
            <div className="mt-5 flex gap-2">
              <Botao variant="outline" className="flex-1" onClick={() => setSair(false)}>Ficar</Botao>
              <Botao variant="danger" className="flex-1" onClick={async () => { await supabase.auth.signOut(); toast.success("Até logo!"); }}>Sair</Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}