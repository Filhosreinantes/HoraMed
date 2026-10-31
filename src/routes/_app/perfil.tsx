import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, LogOut, Trash2, Phone, Check } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import { supabase } from "@/lib/supabase";
import { formatData, nowLocalISO, uid, type Pessoa } from "@/lib/cuidados";
import { Botao, Campo, Divisor } from "@/components/ui-kit";

export const Route = createFileRoute("/_app/perfil")({
  head: () => ({ meta: [{ title: "Perfil · HoraMed" }] }),
  component: Perfil,
});

const EMOJIS_PESSOAS = ["🧑", "👩", "👨", "👧", "👦", "👵", "👴", "🧒", "👶", "👩‍🦱", "👨‍🦱", "🧔"];
const CORES_TEMA = ["azul", "rosa", "verde", "amarelo", "lilás"];

function Perfil() {
  const { ativa, pessoas, user, recarregar, setAtivaId } = useApp();
  const [form, setForm] = useState<Partial<Pessoa> | null>(null);
  const [sair, setSair] = useState(false);
  const [excluir, setExcluir] = useState(false);

  const abrirEdicao = (pessoa: Partial<Pessoa>) => {
    setForm(pessoa);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form?.nome) { toast.error("Informe o nome."); return; }
    const agora = nowLocalISO();
    
    const campos = {
      nome: form.nome,
      nascimento: form.nascimento || null,
      responsavel: form.responsavel || null,
      emoji: form.emoji || "🧑",
      tema: form.tema || "azul",
      atualizado_em: agora,
    };

    if (form.id) {
      const { error } = await supabase.from("horamed_pessoas").update(campos).eq("id", form.id).eq("user_id", user.id);
      if (error) { toast.error("Não foi possível salvar."); return; }
      toast.success("Perfil atualizado!");
    } else {
      const id = uid();
      const { error } = await supabase.from("horamed_pessoas").insert({ ...campos, id, user_id: user.id, criado_em: agora });
      if (error) { toast.error("Não foi possível adicionar."); return; }
      setAtivaId(id);
      toast.success("Novo perfil adicionado!");
    }
    setForm(null);
    recarregar();
  };

  const excluirPerfil = async () => {
    if (!form?.id) return;
    const { error: e1 } = await supabase.from("horamed_registros").delete().eq("pessoa_id", form.id).eq("user_id", user.id);
    if (e1) { toast.error("Não foi possível excluir os registros deste perfil."); return; }
    const { error: e2 } = await supabase.from("horamed_pessoas").delete().eq("id", form.id).eq("user_id", user.id);
    if (e2) { toast.error("Não foi possível excluir o perfil."); return; }
    toast.success("Perfil excluído.");
    setExcluir(false);
    setForm(null);
    recarregar();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Perfil</h1>
      </div>

      {ativa && (
        <div className="notebook flex items-center gap-4 p-5">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-gold-soft text-4xl">{ativa.emoji || "🧑"}</span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-semibold italic">{ativa.nome}</p>
            {ativa.nascimento && <p className="text-sm text-muted-foreground">Nasceu em {formatData(ativa.nascimento)}</p>}
            {ativa.responsavel && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Phone className="h-3.5 w-3.5" /> Emergência: {ativa.responsavel}
              </p>
            )}
          </div>
          <button aria-label="Editar Perfil" onClick={() => abrirEdicao(ativa)} className="rounded-full bg-muted p-2.5 text-accent">
            <Pencil className="h-5 w-5" />
          </button>
        </div>
      )}

      <Botao variant="outline" className="flex w-full items-center justify-center gap-2" onClick={() => abrirEdicao({ emoji: "🧑", tema: "azul" })}>
        <Plus className="h-5 w-5" /> Adicionar outro Perfil
      </Botao>

      <Divisor />

      <Botao variant="laranja" className="flex w-full items-center justify-center gap-2" onClick={() => setSair(true)}>
        <LogOut className="h-5 w-5" /> Sair da conta
      </Botao>

      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-3 sm:items-center" onClick={() => setForm(null)}>
          <form onSubmit={salvar} onClick={(e) => e.stopPropagation()} className="notebook max-h-[88vh] w-full max-w-md space-y-3 overflow-y-auto p-5">
            <h2 className="text-xl font-semibold">{form.id ? "Editar Perfil" : "Novo Perfil"}</h2>
            
            <Campo label="Nome completo">
              <input className="field" required value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </Campo>
            
            <Campo label="Data de nascimento">
              <input className="field" type="date" value={form.nascimento ?? ""} onChange={(e) => setForm({ ...form, nascimento: e.target.value })} />
            </Campo>

            <Campo label="Contato de Emergência (Nome e Telefone)">
              <input className="field" placeholder="Ex: Maria (11) 99999-9999" value={form.responsavel ?? ""} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
            </Campo>

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
                {CORES_TEMA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Campo>

            <div className="flex gap-2 pt-2">
              <Botao type="button" variant="outline" className="flex-1" onClick={() => setForm(null)}>Cancelar</Botao>
              <Botao type="submit" className="flex-1">Salvar</Botao>
            </div>
            {form.id && (
              <button type="button" onClick={() => setExcluir(true)} className="flex w-full items-center justify-center gap-2 pt-1 text-sm font-semibold text-destructive">
                <Trash2 className="h-4 w-4" /> Excluir este Perfil
              </button>
            )}
          </form>
        </div>
      )}

      {/* Modais de exclusão e sair permanecem iguais */}
      {excluir && form?.id && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4" onClick={() => setExcluir(false)}>
          <div onClick={(e) => e.stopPropagation()} className="notebook w-full max-w-sm p-6 text-center">
            {pessoas.length <= 1 ? (
              <>
                <h2 className="text-xl font-semibold">Não dá para excluir</h2>
                <p className="mt-2 text-sm text-muted-foreground">Você precisa ter pelo menos um Perfil. Adicione outro antes de excluir este.</p>
                <Botao className="mt-5 w-full" onClick={() => setExcluir(false)}>Entendi</Botao>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold">Excluir {form.nome}?</h2>
                <p className="mt-2 text-sm text-muted-foreground">Todas as consultas, exames e medicações registradas para este perfil serão apagadas. Isso não pode ser desfeito.</p>
                <div className="mt-5 flex gap-2">
                  <Botao variant="outline" className="flex-1" onClick={() => setExcluir(false)}>Cancelar</Botao>
                  <Botao variant="danger" className="flex-1" onClick={excluirPerfil}>Excluir</Botao>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {sair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={() => setSair(false)}>
          <div onClick={(e) => e.stopPropagation()} className="notebook w-full max-w-sm p-6 text-center">
            <h2 className="text-xl font-semibold">Sair da conta?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Você precisará entrar novamente com seu e-mail e senha.</p>
            <div className="mt-5 flex gap-2">
              <Botao variant="outline" className="flex-1" onClick={() => setSair(false)}>Ficar</Botao>
              <Botao variant="laranja" className="flex-1" onClick={async () => { await supabase.auth.signOut(); toast.success("Até logo!"); }}>Sair</Botao>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}