import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, LogOut, Trash2, HeartPulse, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import { supabase } from "@/lib/supabase";
import { formatData, nowLocalISO, uid, type Pessoa } from "@/lib/cuidados";
import { Botao, Campo, Divisor } from "@/components/ui-kit";

export const Route = createFileRoute("/_app/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil · horaMed" },
      { name: "description", content: "Gerencie os dados do paciente." },
    ],
  }),
  component: Perfil,
});

function Perfil() {
  const { ativa, pessoas, user, recarregar, setAtivaId } = useApp();
  const [form, setForm] = useState<Partial<Pessoa> | null>(null);
  const [sair, setSair] = useState(false);
  const [excluir, setExcluir] = useState(false);

  // Campos que não estão no tipo Pessoa padrão, mas podemos adicionar no objeto
  const [tipoSanguineo, setTipoSanguineo] = useState("");
  const [alergias, setAlergias] = useState("");
  const [contatoEmergencia, setContatoEmergencia] = useState("");

  const abrirEdicao = (pessoa: Partial<Pessoa>) => {
    setForm(pessoa);
    setTipoSanguineo((pessoa as any).tipo_sanguineo || "");
    setAlergias((pessoa as any).alergias || "");
    setContatoEmergencia((pessoa as any).contato_emergencia || "");
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form?.nome) { toast.error("Informe o nome."); return; }
    const agora = nowLocalISO();
    const campos = {
      nome: form.nome,
      nascimento: form.nascimento || null,
      tipo_sanguineo: tipoSanguineo || null,
      alergias: alergias || null,
      contato_emergencia: contatoEmergencia || null,
      atualizado_em: agora,
      // Mantemos o emoji e tema padrão para o banco não reclamar
      emoji: "🧑",
      tema: "azul",
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
          <span className="grid h-16 w-16 place-items-center rounded-full bg-gold-soft text-4xl">🧑</span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-semibold italic">{ativa.nome}</p>
            {ativa.nascimento && <p className="text-sm text-muted-foreground">Nasceu em {formatData(ativa.nascimento)}</p>}
            {(ativa as any).tipo_sanguineo && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <HeartPulse className="h-3.5 w-3.5" /> Tipo Sanguíneo: {(ativa as any).tipo_sanguineo}
              </p>
            )}
            {(ativa as any).alergias && (
              <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                <AlertCircle className="h-3.5 w-3.5" /> Alergias: {(ativa as any).alergias}
              </p>
            )}
            {(ativa as any).contato_emergencia && (
              <p className="text-sm text-muted-foreground mt-1">
                <strong>Emergência:</strong> {(ativa as any).contato_emergencia}
              </p>
            )}
          </div>
          <button aria-label="Editar Perfil" onClick={() => abrirEdicao(ativa)} className="rounded-full bg-muted p-2.5 text-accent">
            <Pencil className="h-5 w-5" />
          </button>
        </div>
      )}

      <Botao variant="outline" className="flex w-full items-center justify-center gap-2" onClick={() => abrirEdicao({})}>
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

            <Campo label="Tipo Sanguíneo">
              <select className="field" value={tipoSanguineo} onChange={(e) => setTipoSanguineo(e.target.value)}>
                <option value="">Não informado</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </Campo>

            <Campo label="Alergias (medicamentos, alimentos, etc)">
              <input className="field" placeholder="Ex: Dipirona, Amendoim" value={alergias} onChange={(e) => setAlergias(e.target.value)} />
            </Campo>

            <Campo label="Contato de Emergência">
              <input className="field" placeholder="Nome e telefone" value={contatoEmergencia} onChange={(e) => setContatoEmergencia(e.target.value)} />
            </Campo>

            <div className="flex gap-2 pt-2">
              <Botao type="button" variant="outline" className="flex-1" onClick={() => setForm(null)}>Cancelar</Botao>
              <Botao type="submit" className="flex-1">Salvar</Botao>
            </div>
            {form.id && (
              <button
                type="button"
                onClick={() => setExcluir(true)}
                className="flex w-full items-center justify-center gap-2 pt-1 text-sm font-semibold text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Excluir este Perfil
              </button>
            )}
          </form>
        </div>
      )}

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
                <p className="mt-2 text-sm text-muted-foreground">
                  Todas as consultas, exames e medicações registradas para este perfil serão apagadas. Isso não pode ser desfeito.
                </p>
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