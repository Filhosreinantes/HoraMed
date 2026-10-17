import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import { DIAS_SEMANA, EMOJI, gerarSessoes, nowLocalISO, uid, type Cuidado, type Dados, type Programacao } from "@/lib/cuidados";
import { Botao, Campo, Divisor, SeletorTesouro } from "@/components/ui-kit";

export const Route = createFileRoute("/_app/criar")({
  head: () => ({
    meta: [
      { title: "Novo compromisso · Rotina Azul" },
      { name: "description", content: "Agende consultas, terapias, exames e medicações." },
      { property: "og:title", content: "Novo compromisso · Rotina Azul" },
      { property: "og:description", content: "Agende consultas, terapias, exames e medicações." },
    ],
  }),
  component: Criar,
});

type K = "data"|"hora"|"local"|"profissional"|"especialidade"|"tipoTerapia"|"tipoExame"|"recomendacoes"|"medicamento"|"dosagem"|"frequencia"|"inicio"|"fim"|"programacao"|"meses"|"diaSemana";
type F = Partial<Record<K, string>>;

function Criar() {
  const { ativa, salvarRegistros } = useApp();
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<Cuidado | null>(null);
  const [f, setF] = useState<F>({ programacao: "unica", meses: "3", diaSemana: "1" });
  const [horarios, setHorarios] = useState<string[]>(["08:00"]);
  const [salvando, setSalvando] = useState(false);
  const set = (k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const inp = (k: K, type = "text", req = false) => (
    <input className="field" type={type} required={req} value={f[k] ?? ""} onChange={set(k)} />
  );

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ativa || !tipo) return;
    const base = { pessoaId: ativa.id, criadoEm: nowLocalISO(), cuidado: tipo, situacao: "proximo" as const };
    let lista: Dados[] = [];
    if (tipo === "Consulta") {
      lista = [{ ...base, id: uid(), titulo: `Consulta${f.especialidade ? ` · ${f.especialidade}` : ""}`, data: f.data, hora: f.hora, local: f.local, profissional: f.profissional, especialidade: f.especialidade }];
    } else if (tipo === "Exame") {
      lista = [{ ...base, id: uid(), titulo: `Exame · ${f.tipoExame}`, tipoExame: f.tipoExame, data: f.data, hora: f.hora, local: f.local, profissional: f.profissional, recomendacoes: f.recomendacoes }];
    } else if (tipo === "Medicação") {
      const limpos = horarios.filter(Boolean).sort();
      lista = [{ ...base, id: uid(), titulo: `Medicação · ${f.medicamento}`, medicamento: f.medicamento, dosagem: f.dosagem, horarios: limpos, frequencia: limpos.join(", "), profissional: f.profissional, especialidade: f.especialidade, inicio: f.inicio, fim: f.fim || undefined }];
    } else {
      const prog = f.programacao as Programacao;
      const meses = Number(f.meses);
      const dia = Number(f.diaSemana);
      const datas = gerarSessoes(f.data ?? "", prog, meses, prog === "semanal" ? dia : undefined);
      const programaId = prog === "unica" ? undefined : uid();
      lista = datas.map((data, idx) => ({
        ...base,
        id: uid(),
        titulo: `Terapia · ${f.tipoTerapia}${datas.length > 1 ? ` (${idx + 1}/${datas.length})` : ""}`,
        tipoTerapia: f.tipoTerapia, profissional: f.profissional, local: f.local, data, hora: f.hora,
        ...(programaId ? { programa: true, programaId, duracaoMeses: meses, frequencia: prog, diaSemana: prog === "semanal" ? DIAS_SEMANA[dia] : undefined } : {}),
      }));
    }
    setSalvando(true);
    const ok = await salvarRegistros(lista);
    setSalvando(false);
    if (ok) {
      toast.success(lista.length > 1 ? `${lista.length} sessões agendadas!` : "Agendamento guardado!");
      navigate({ to: "/acompanhamento" });
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Novo compromisso</h1>
      <SeletorTesouro prefixo="Para" />
      <div className="grid grid-cols-2 gap-3">
        {(["Consulta", "Terapia", "Exame", "Medicação"] as Cuidado[]).map((c) => (
          <button
            key={c}
            onClick={() => setTipo(c)}
            className={`flex flex-col items-center gap-1 rounded-3xl border p-5 shadow-soft transition ${tipo === c ? "border-primary bg-sky" : "border-gold/40 bg-card"}`}
          >
            <span className="text-4xl">{EMOJI[c]}</span>
            <span className="font-display text-lg font-semibold italic">{c}</span>
          </button>
        ))}
      </div>

      {tipo && (
        <form onSubmit={guardar} className="notebook space-y-4 p-5">
          <h2 className="text-xl font-semibold">{EMOJI[tipo]} {tipo}</h2>
          {tipo === "Consulta" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Data">{inp("data", "date", true)}</Campo>
                <Campo label="Hora">{inp("hora", "time")}</Campo>
              </div>
              <Campo label="Local">{inp("local")}</Campo>
              <Campo label="Profissional">{inp("profissional")}</Campo>
              <Campo label="Especialidade">{inp("especialidade")}</Campo>
            </>
          )}
          {tipo === "Terapia" && (
            <>
              <Campo label="Tipo">{inp("tipoTerapia", "text", true)}</Campo>
              <Campo label="Profissional">{inp("profissional")}</Campo>
              <Campo label="Local">{inp("local")}</Campo>
              <Campo label="Programação">
                <select className="field" value={f.programacao} onChange={set("programacao")}>
                  <option value="unica">Sessão única</option>
                  <option value="semanal">Toda semana</option>
                  <option value="quinzenal">A cada 15 dias</option>
                  <option value="mensal">Uma vez por mês</option>
                </select>
              </Campo>
              {f.programacao === "semanal" && (
                <Campo label="Dia da semana">
                  <select className="field" value={f.diaSemana} onChange={set("diaSemana")}>
                    {DIAS_SEMANA.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </Campo>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Primeira sessão">{inp("data", "date", true)}</Campo>
                <Campo label="Hora">{inp("hora", "time")}</Campo>
              </div>
              {f.programacao !== "unica" && (
                <Campo label="Por quanto tempo">
                  <select className="field" value={f.meses} onChange={set("meses")}>
                    <option value="3">3 meses</option>
                    <option value="6">6 meses</option>
                    <option value="12">12 meses</option>
                  </select>
                </Campo>
              )}
            </>
          )}
          {tipo === "Exame" && (
            <>
              <Campo label="Tipo de exame">{inp("tipoExame", "text", true)}</Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Data">{inp("data", "date", true)}</Campo>
                <Campo label="Hora">{inp("hora", "time")}</Campo>
              </div>
              <Campo label="Local">{inp("local")}</Campo>
              <Campo label="Profissional / solicitante">{inp("profissional")}</Campo>
              <Campo label="Recomendações">
                <textarea className="field min-h-24" value={f.recomendacoes ?? ""} onChange={set("recomendacoes")} />
              </Campo>
            </>
          )}
          {tipo === "Medicação" && (
            <>
              <Campo label="Nome">{inp("medicamento", "text", true)}</Campo>
              <Campo label="Dosagem">{inp("dosagem")}</Campo>
              <div className="space-y-1.5">
                <span className="text-sm font-semibold">Horários</span>
                <div className="space-y-2">
                  {horarios.map((h, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        className="field flex-1"
                        type="time"
                        required
                        value={h}
                        onChange={(e) => setHorarios((p) => p.map((v, i) => (i === idx ? e.target.value : v)))}
                      />
                      {horarios.length > 1 && (
                        <button
                          type="button"
                          aria-label="Remover horário"
                          onClick={() => setHorarios((p) => p.filter((_, i) => i !== idx))}
                          className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setHorarios((p) => [...p, ""])}
                    className="rounded-xl border border-gold/50 bg-card px-4 py-2 text-sm font-semibold"
                  >
                    + Adicionar horário
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Ex: 08:00, 14:00, 20:00 — usaremos para os lembretes.</p>
              </div>
              <Campo label="Profissional que prescreveu">{inp("profissional")}</Campo>
              <Campo label="Especialidade">{inp("especialidade")}</Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Início">{inp("inicio", "date")}</Campo>
                <Campo label="Fim">{inp("fim", "date")}</Campo>
              </div>
              <p className="text-xs text-muted-foreground">Deixe o fim em branco para uso contínuo.</p>
            </>
          )}
          <Divisor />
          <Botao type="submit" disabled={salvando} className="w-full">Guardar agendamento</Botao>
        </form>
      )}
    </div>
  );
}
