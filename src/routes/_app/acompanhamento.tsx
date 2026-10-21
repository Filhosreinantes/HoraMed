import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { X, ChevronLeft, Check, Clock, History, Stethoscope, Leaf, FileText, Pill as PillIcon } from "lucide-react";
import { useApp } from "@/lib/app-store";
import {
  doseRegistrada, hojeYMD, medicacaoEmUso, ordenarPorDataHora, compromissoPendente,
  nowLocalISO, uid, type Cuidado, type Situacao, type Dados
} from "@/lib/cuidados";
import { Botao, Divisor, Pill, SeletorTesouro } from "@/components/ui-kit";
import { CompromissoCard } from "@/components/compromisso-card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/acompanhamento")({
  head: () => ({
    meta: [
      { title: "Acompanhamento · Rotina Azul" },
      { name: "description", content: "Panorama de consultas, terapias, exames e medicações." },
    ],
  }),
  component: Acompanhamento,
});

type View = "menu" | "compromissos" | "medicacoes";
type Periodo = "mes" | "ano" | "tudo";
type Drill = { cuidado: Cuidado; situacao: Situacao } | null;

const LINHAS: { s: Situacao; label: string }[] = [
  { s: "feito", label: "Compareceu" },
  { s: "faltou", label: "Faltou" },
  { s: "cancelado", label: "Cancelou" },
  { s: "proximo", label: "Próximos" },
];

function ProximoRemedioCard() {
  const { itens } = useApp();
  const [proximo, setProximo] = useState<{ item: any; horario: string } | null>(null);

  useEffect(() => {
    const agora = new Date();
    const horaAtual = agora.getHours() * 60 + agora.getMinutes();
    let menorDiferenca = Infinity;
    let achou: { item: any; horario: string } | null = null;

    itens
      .filter((i) => i.cuidado === "Medicação")
      .forEach((med) => {
        const diaSemana = agora.getDay();
        if (med.diasSemana && med.diasSemana.length > 0 && !med.diasSemana.includes(diaSemana)) return;

        const horarios = med.horarios || [];
        horarios.forEach((h: string) => {
          const [hh, mm] = h.split(":").map(Number);
          const minutosHorario = hh * 60 + mm;
          const diferenca = minutosHorario - horaAtual;

          if (diferenca >= 0 && diferenca < menorDiferenca) {
            menorDiferenca = diferenca;
            achou = { item: med, horario: h };
          }
        });
      });

    setProximo(achou);
  }, [itens]);

  if (!proximo) return null;

  return (
    <div
      className="mx-4 mt-4 overflow-hidden rounded-3xl p-5 shadow-lg"
      style={{
        background: "linear-gradient(135deg, var(--tema), var(--tema-escuro))",
        color: "white",
      }}
    >
      <p className="text-xs font-bold uppercase tracking-wider opacity-80">Próximo Remédio</p>
      <div className="mt-1 flex items-center justify-between">
        <div>
          <h3 className="font-display text-2xl font-bold italic">{proximo.item.medicamento}</h3>
          <p className="text-sm opacity-90">{proximo.item.dosagem || "Dose padrão"}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-bold">{proximo.horario}</p>
          <p className="text-xs opacity-80">Hoje</p>
        </div>
      </div>
    </div>
  );
}

function Acompanhamento() {
  const { itens, logs, ativa, carregando, salvarRegistros } = useApp();
  const [view, setView] = useState<View>("menu");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [drill, setDrill] = useState<Drill>(null);
  const [buscaProximos, setBuscaProximos] = useState("");

  const [atrasoModal, setAtrasoModal] = useState<{ item: any; horario: string } | null>(null);
  const [filtroMed, setFiltroMed] = useState("");
  const [dataHistorico, setDataHistorico] = useState(hojeYMD());

  const hoje = hojeYMD();

  const filtrados = useMemo(() => {
    return itens.filter((i) => {
      if (periodo === "tudo") return true;
      const d = i.data || i.inicio || "";
      return periodo === "mes" ? d.slice(0, 7) === hoje.slice(0, 7) : d.slice(0, 4) === hoje.slice(0, 4);
    });
  }, [itens, periodo, hoje]);

  const meds = itens.filter((i) => i.cuidado === "Medicação");
  const emUso = ordenarPorDataHora(meds.filter((m) => medicacaoEmUso(m)));
  const encerradas = ordenarPorDataHora(meds.filter((m) => !medicacaoEmUso(m)));

  const proximos = useMemo(() => {
    let lista = ordenarPorDataHora(itens.filter((i) => compromissoPendente(i) && i.cuidado !== "Medicação"));
    if (buscaProximos) {
      lista = lista.filter((i) => i.cuidado === buscaProximos);
    }
    return lista;
  }, [itens, buscaProximos]);

  const agendaHoje = useMemo(() => {
    const arr: any[] = [];
    emUso.forEach((m) => {
      const horarios = m.horarios && m.horarios.length > 0 ? m.horarios : (m.frequencia ? m.frequencia.split(",") : ["08:00"]);
      horarios.forEach((h: string) => {
        const hClean = h.trim();
        const log = doseRegistrada(logs, m.id, hoje, hClean);
        arr.push({ med: m, horario: hClean, log });
      });
    });
    return arr.sort((a, b) => a.horario.localeCompare(b.horario));
  }, [emUso, logs, hoje]);

  const logsFiltrados = useMemo(() => {
    return logs
      .filter((i: any) => !filtroMed || i.titulo.toLowerCase().includes(filtroMed.toLowerCase()))
      .filter((i: any) => i.data === dataHistorico)
      .sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
  }, [logs, filtroMed, dataHistorico]);

  const registrarMedicacao = async (item: any, horario: string, novoHorario?: string) => {
    const titulo = novoHorario
      ? `Atrasou: ${item.medicamento} (${horario} -> ${novoHorario})`
      : `Tomou: ${item.medicamento} (${horario})`;

    const dados: Dados = {
      id: uid(), pessoaId: item.pessoaId, criadoEm: nowLocalISO(), titulo,
      cuidado: "Medicação_Log" as any, evento: true, parentId: item.id, data: hoje, horario,
    };

    const ok = await salvarRegistros([dados], "medicacao_logs");
    if (ok) {
      toast.success(novoHorario ? "Atraso registrado!" : "Medicação registrada!");
      setAtrasoModal(null);
    }
  };

  if (carregando) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-40 rounded-3xl bg-muted" />
        <Skeleton className="h-40 rounded-3xl bg-muted" />
      </div>
    );
  }

  // --- MENU INICIAL ---
  if (view === "menu") {
    return (
      <div className="mx-auto max-w-lg space-y-5 py-6">
        <header className="text-center">
          <h1 className="font-display text-3xl font-semibold italic">Acompanhamento</h1>
          <p className="text-sm text-muted-foreground">O que você quer ver hoje?</p>
        </header>

        <div className="px-4">
          <SeletorTesouro />
        </div>

        <ProximoRemedioCard />

        <div className="grid grid-cols-2 gap-3 px-4 mt-6">
          <button
            onClick={() => setView("compromissos")}
            className="notebook flex flex-col items-center justify-center gap-2 border-[#B8933F]/60 p-4 transition hover:bg-muted/10"
          >
            <div
              className="grid h-12 w-12 place-items-center rounded-full"
              style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}
            >
              <Stethoscope className="h-6 w-6" />
            </div>
            <span className="font-display text-base font-semibold italic text-foreground text-center">
              Compromissos
            </span>
          </button>

          <button
            onClick={() => setView("medicacoes")}
            className="notebook flex flex-col items-center justify-center gap-2 border-[#B8933F]/60 p-4 transition hover:bg-muted/10"
          >
            <div
              className="grid h-12 w-12 place-items-center rounded-full"
              style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}
            >
              <PillIcon className="h-6 w-6" />
            </div>
            <span className="font-display text-base font-semibold italic text-foreground text-center">
              Medicações
            </span>
          </button>
        </div>
      </div>
    );
  }

  // --- TELA DE COMPROMISSOS ---
  if (view === "compromissos") {
    return (
      <div className="mx-auto max-w-lg space-y-5 pb-20 py-4">
        <Botao variant="ghost" onClick={() => setView("menu")} className="mb-2 flex items-center gap-1 text-sm font-semibold">
          <ChevronLeft className="h-4 w-4" /> Voltar ao menu
        </Botao>

        <header>
          <h1 className="text-2xl font-semibold">Compromissos</h1>
        </header>
        <SeletorTesouro />

        {/* ✅ TEXTO INTRODUTÓRIO */}
        <p className="text-sm text-muted-foreground mb-4">
          Panorama dos cuidados médicos. Toque em um dos blocos (Compareceu, Faltou, etc.) para ver os detalhes abaixo.
        </p>

        <div className="flex gap-2">
          <Pill ativo={periodo === "mes"} onClick={() => setPeriodo("mes")}>Este mês</Pill>
          <Pill ativo={periodo === "ano"} onClick={() => setPeriodo("ano")}>Este ano</Pill>
          <Pill ativo={periodo === "tudo"} onClick={() => setPeriodo("tudo")}>Tudo</Pill>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Cuidados médicos</h2>
          <div className="grid gap-3">
            {(["Consulta", "Terapia", "Exame"] as Cuidado[]).map((c) => {
              const doTipo = filtrados.filter((i) => i.cuidado === c);
              return (
                <div key={c} className="notebook p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-display text-lg font-semibold italic" style={{ color: "var(--tema-escuro)" }}>
                      {c === "Consulta" && <Stethoscope className="h-5 w-5" style={{ color: "var(--tema)" }} />}
                      {c === "Terapia" && <Leaf className="h-5 w-5" style={{ color: "var(--tema)" }} />}
                      {c === "Exame" && <FileText className="h-5 w-5" style={{ color: "var(--tema)" }} />}
                      <span>{c}</span>
                    </div>
                    <span className="font-display text-2xl font-bold" style={{ color: "var(--tema)" }}>{doTipo.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {LINHAS.map(({ s, label }) => {
                      const n = doTipo.filter((i) => (i.situacao ?? "proximo") === s).length;
                      const ativo = drill && drill.cuidado === c && drill.situacao === s;
                      return (
                        <Botao variant="ghost" key={s} onClick={() => setDrill({ cuidado: c, situacao: s })} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${ativo ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <span>{label}</span><strong>{n}</strong>
                        </Botao>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {drill && (
          <section className="notebook space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{drill.cuidado} · {LINHAS.find((l) => l.s === drill.situacao)?.label}</h3>
              <Botao variant="ghost" onClick={() => setDrill(null)} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-semibold">
                <X className="h-4 w-4" /> Fechar
              </Botao>
            </div>
            {filtrados.filter((i) => i.cuidado === drill.cuidado && (i.situacao ?? "proximo") === drill.situacao).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada por aqui.</p>
            ) : (
              ordenarPorDataHora(filtrados.filter((i) => i.cuidado === drill.cuidado && (i.situacao ?? "proximo") === drill.situacao)).map((i) => (
                <CompromissoCard key={i.id} item={i} />
              ))
            )}
          </section>
        )}

        <Divisor />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Todos os próximos compromissos</h2>
          </div>

          {/* ✅ TEXTO EXPLICATIVO */}
          <p className="text-xs text-muted-foreground mb-2">
            Toque no card para abrir e dar baixa (Compareceu/Faltou).
          </p>

          <div className="flex items-center gap-2 mb-2">
            <select
              className="field text-sm p-2 w-full border-gold/30 bg-card"
              value={buscaProximos}
              onChange={(e) => setBuscaProximos(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              <option value="Consulta">Consulta</option>
              <option value="Terapia">Terapia</option>
              <option value="Exame">Exame</option>
            </select>
          </div>

          {proximos.length === 0 ? (
            <p className="notebook p-4 text-sm text-muted-foreground">Nenhum compromisso agendado.</p>
          ) : (
            <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
              {proximos.map((i) => <CompromissoCard key={i.id} item={i} />)}
            </div>
          )}
        </section>
      </div>
    );
  }

  // --- TELA DE MEDICAÇÕES ---
  return (
    <div className="mx-auto max-w-lg space-y-5 pb-20 py-4">
      <Botao variant="ghost" onClick={() => setView("menu")} className="mb-2 flex items-center gap-1 text-sm font-semibold">
        <ChevronLeft className="h-4 w-4" /> Voltar ao menu
      </Botao>

      <header>
        <h1 className="text-2xl font-semibold">Medicações</h1>
      </header>
      <SeletorTesouro />

      {/* ✅ LEMBRETES DE HOJE */}
      <section
        className="notebook p-5 space-y-4"
        style={{ boxShadow: "0 8px 25px -5px var(--tema-claro)", border: "1px solid var(--tema-claro)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-5 w-5" style={{ color: "var(--tema)" }} />
          <h2 className="font-display text-xl font-bold italic text-foreground">Lembretes de Hoje</h2>
        </div>

        {agendaHoje.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma medicação agendada para hoje.</p>
        ) : (
          <ul className="space-y-2">
            {agendaHoje.map((a, idx) => (
              <li key={`${a.med.id}-${a.horario}-${idx}`} className="flex flex-col gap-2 rounded-xl border border-gold/20 bg-background/50 p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-sm">{a.med.medicamento}{a.med.dosagem && <span className="text-xs text-muted-foreground font-normal"> ({a.med.dosagem})</span>}</p>
                    <p className="text-xs text-muted-foreground">Horário: {a.horario}</p>
                  </div>
                  {a.log ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">
                      <Check className="h-3 w-3" /> {a.log.titulo.includes("Atrasou") ? "Atrasou" : "Tomou"}
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => registrarMedicacao(a.med, a.horario)}
                        className="rounded-full bg-[var(--tema)] px-4 py-2 text-xs font-bold text-white shadow-sm"
                      >
                        Tomou
                      </button>
                      <button
                        onClick={() => setAtrasoModal({ item: a.med, horario: a.horario })}
                        className="rounded-full border border-[var(--tema)] bg-transparent px-4 py-2 text-xs font-bold text-[var(--tema-escuro)]"
                      >
                        Atrasei
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ✅ HISTÓRICO */}
      <section
        className="notebook p-5 space-y-4"
        style={{ boxShadow: "0 8px 25px -5px var(--tema-claro)", border: "1px solid var(--tema-claro)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <History className="h-5 w-5" style={{ color: "var(--tema)" }} />
          <h2 className="font-display text-xl font-bold italic text-foreground">Histórico</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <input type="date" className="field text-sm p-2" value={dataHistorico} onChange={(e) => setDataHistorico(e.target.value)} />
          <select className="field text-sm p-2" value={filtroMed} onChange={(e) => setFiltroMed(e.target.value)}>
            <option value="">Todos os remédios</option>
            {emUso.map(m => <option key={m.id} value={m.medicamento}>{m.medicamento}</option>)}
          </select>
        </div>

        {logsFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
        ) : (
          <ul className="space-y-2">
            {logsFiltrados.map((l: any) => (
              <li key={l.id} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm">
                <span className="text-green-600">✓</span>
                <span className="flex-1">{l.titulo}</span>
                <span className="text-xs text-muted-foreground">{l.criadoEm?.slice(11, 16)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ✅ MEUS REMÉDIOS (enxuto) */}
      <section
        className="notebook p-5 space-y-4"
        style={{ boxShadow: "0 8px 25px -5px var(--tema-claro)", border: "1px solid var(--tema-claro)" }}
      >
        <h2 className="font-display text-xl font-bold italic text-foreground flex items-center gap-2">
          <PillIcon className="h-5 w-5" style={{ color: "var(--tema)" }} /> Meus Remédios
        </h2>

        <div className="flex gap-3 mb-4 text-sm flex-wrap">
          <div className="bg-muted/30 px-3 py-2 rounded-xl border border-border">
            <span className="text-muted-foreground">Em uso: </span>
            <strong className="text-[var(--tema)] text-lg">{emUso.length}</strong>
          </div>
          <div className="bg-muted/30 px-3 py-2 rounded-xl border border-border">
            <span className="text-muted-foreground">Encerrados: </span>
            <strong className="text-[var(--tema-escuro)] text-lg">{encerradas.length}</strong>
          </div>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {emUso.map((m) => <CompromissoCard key={m.id} item={m} />)}
        </div>
      </section>

      {/* MODAL ATRASO */}
      {atrasoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-3xl bg-card p-5 shadow-xl">
            <h3 className="font-display text-lg font-bold text-foreground">Atrasou a medicação</h3>
            <p className="text-sm text-muted-foreground">Qual o novo horário que você deu a dose do {atrasoModal.item.medicamento}?</p>
            <input
              type="time"
              className="w-full rounded-xl border p-2"
              defaultValue={new Date().toTimeString().slice(0, 5)}
              onChange={(e) => setAtrasoModal({ ...atrasoModal, novoHorario: e.target.value } as any)}
            />
            <div className="flex gap-2">
              <button onClick={() => setAtrasoModal(null)} className="flex-1 rounded-full border py-2 text-sm font-bold text-muted-foreground">Cancelar</button>
              <button onClick={() => {
                const novoH = (document.querySelector('input[type="time"]') as HTMLInputElement).value;
                registrarMedicacao(atrasoModal.item, atrasoModal.horario, novoH);
              }} className="flex-1 rounded-full bg-primary py-2 text-sm font-bold text-primary-foreground">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}