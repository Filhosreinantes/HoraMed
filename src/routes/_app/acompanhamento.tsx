// @ts-nocheck
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { X, ChevronLeft, Clock, History, Stethoscope, Leaf, FileText, Pill as PillIcon, Plane, Trash2, RefreshCw } from "lucide-react";
import { useApp } from "@/lib/app-store";
import {
  doseRegistrada, hojeYMD, medicacaoEmUso, ordenarPorDataHora, compromissoPendente,
  nowLocalISO, uid, type Cuidado, type Situacao, type Dados, parseYMD, type Item
} from "@/lib/cuidados";
import { Botao, Divisor, Pill, SeletorTesouro } from "@/components/ui-kit";
import { CompromissoCard } from "@/components/compromisso-card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/acompanhamento")({
  head: () => ({ meta: [{ title: "Rotina Azul 💙" }] }),
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

function Acompanhamento() {
  const { itens, logs, carregando, salvarRegistros } = useApp();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("menu");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [drill, setDrill] = useState<Drill>(null);
  const [buscaProximos, setBuscaProximos] = useState("");
  const [filtroRemedios, setFiltroRemedios] = useState<"uso" | "encerrados">("uso");

  const [atrasoModal, setAtrasoModal] = useState<any>(null);
  const [filtroMed, setFiltroMed] = useState("");
  const [dataHistorico, setDataHistorico] = useState(hojeYMD());

  const [viagemInicio, setViagemInicio] = useState(hojeYMD());
  const [viagemFim, setViagemFim] = useState(hojeYMD());

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

  // ✅ Lista de contínuos simplificada
  const continuos = useMemo(() => {
    const mapa: Record<string, any> = {};
    emUso.filter(m => !m.fim).forEach(m => {
      const nome = m.medicamento || "";
      const existente = mapa[nome];
      if (!existente || (m.inicio || "") > (existente.inicio || "")) {
        mapa[nome] = m;
      }
    });
    return Object.values(mapa);
  }, [emUso]);

  const proximos = useMemo(() => {
    let lista = ordenarPorDataHora(itens.filter((i) => compromissoPendente(i) && i.cuidado !== "Medicação"));
    if (buscaProximos) lista = lista.filter((i) => i.cuidado === buscaProximos);
    return lista;
  }, [itens, buscaProximos]);

  const agendaHoje = useMemo(() => {
    const arr: any[] = [];
    emUso.forEach((m) => {
      const dataInicio = m.inicio;
      const dataFim = m.fim;
      if (dataInicio && hoje < dataInicio) return;
      if (dataFim && hoje > dataFim) return;

      const diasDaSemana = m.diasSemana || [0, 1, 2, 3, 4, 5, 6];
      const hojeIndex = new Date().getDay(); 
      if (!diasDaSemana.includes(hojeIndex)) return;

      const horarios = m.horarios || [];
      let horariosValidos = horarios;
      if (m.inicio === hoje && horarios.length > 0) {
        const horaInicio = horarios[0] ?? "";
        horariosValidos = horarios.filter((h: string) => h >= horaInicio);
      }

      const dosesPendentes = horariosValidos.filter((h: string) => {
        return !doseRegistrada(logs, m.id, hoje, h.trim());
      });

      dosesPendentes.forEach((hora: string) => {
        arr.push({ med: m, data: hoje, horario: hora, log: null });
      });
    });
    return arr.sort((a, b) => a.horario.localeCompare(b.horario));
  }, [emUso, logs, hoje]);

  const proximosAgendamentos = useMemo(() => {
    const arr: any[] = [];
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() + 15);
    const limiteYMD = `${dataLimite.getFullYear()}-${String(dataLimite.getMonth() + 1).padStart(2, "0")}-${String(dataLimite.getDate()).padStart(2, "0")}`;

    emUso.forEach((m) => {
      const dataInicio = m.inicio || hoje;
      const dataFim = m.fim || limiteYMD;
      if (dataFim < hoje) return;

      const diasDaSemana = m.diasSemana || [0, 1, 2, 3, 4, 5, 6];
      const horarios = m.horarios || [];
      if (horarios.length === 0) return;

      let dataIteracao = hoje > dataInicio ? hoje : dataInicio;
      
      while (dataIteracao <= dataFim) {
        const d = parseYMD(dataIteracao);
        const diaSemana = d.getDay();
        
        if (diasDaSemana.includes(diaSemana)) {
          let horariosValidos = horarios;
          if (dataIteracao === dataInicio) {
            const horaInicio = horarios[0] ?? "";
            horariosValidos = horarios.filter((h: string) => h >= horaInicio);
          }
          const dosesPendentes = horariosValidos.filter((h: string) => {
            return !doseRegistrada(logs, m.id, dataIteracao, h.trim());
          });
          dosesPendentes.forEach((hora: string) => {
            arr.push({ med: m, data: dataIteracao, horario: hora });
          });
        }
        d.setDate(d.getDate() + 1);
        dataIteracao = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
    });
    return arr.sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario));
  }, [emUso, logs, hoje]);

  const logsFiltrados = useMemo(() => {
    return logs
      .filter((i: any) => !filtroMed || i.titulo.toLowerCase().includes(filtroMed.toLowerCase()))
      .filter((i: any) => i.data === dataHistorico)
      .sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
  }, [logs, filtroMed, dataHistorico]);

  const registrarMedicacao = async (item: any, data: string, horario: string, novoHorario?: string) => {
    const titulo = novoHorario ? `Atrasou: ${item.medicamento} (${horario} -> ${novoHorario})` : `Tomou: ${item.medicamento} (${horario})`;
    const dados: Dados = { id: uid(), pessoaId: item.pessoaId, criadoEm: nowLocalISO(), titulo, cuidado: "Medicação_Log" as any, evento: true, parentId: item.id, data: data, horario };

    let ok = await salvarRegistros([dados], "medicacao_logs");

    if (ok && item.estoqueAtual !== undefined) {
      const qtdTomada = Number(item.dosagemValor || 1);
      const novoEstoque = Math.max(0, item.estoqueAtual - qtdTomada);
      ok = await salvarRegistros([{
        id: uid(),
        pessoaId: item.pessoaId,
        criadoEm: nowLocalISO(),
        titulo: "Atualização de estoque",
        cuidado: item.cuidado,
        evento: true,
        parentId: item.id,
        acao: "editar",
        alteracoes: { estoqueAtual: novoEstoque }
      }], "acontecimentos");
    }

    if (ok) {
      toast.success(novoHorario ? "Atraso registrado!" : "Medicação registrada!");
      setAtrasoModal(null);
    }
  };

  const excluirLog = async (log: any) => {
    if (!confirm("Excluir este registro de dose?")) return;
    const ok = await salvarRegistros([{ id: uid(), pessoaId: log.pessoaId, criadoEm: nowLocalISO(), titulo: "Excluído", cuidado: "Medicação_Log" as any, evento: true, parentId: log.id, acao: "excluir" }], "medicacao_logs");
    if (ok) toast.success("Registro excluído!");
  };

  const duracaoViagem = () => {
    if (!viagemInicio || !viagemFim) return 0;
    const d1 = parseYMD(viagemInicio); 
    const d2 = parseYMD(viagemFim);
    if (d2.getTime() < d1.getTime()) return 0;
    return Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const calcularViagem = () => {
    const dias = duracaoViagem();
    if (dias === 0) return [];
    return emUso.map(med => {
      const vezesAoDia = med.horarios?.length || 1;
      const dosagem = Number(med.dosagemValor || 1);
      return { med, total: dias * vezesAoDia * dosagem, unidade: med.dosagemUnidade || "un" };
    });
  };

  if (carregando) return <div className="space-y-3 p-4"><Skeleton className="h-40 rounded-3xl bg-muted" /><Skeleton className="h-40 rounded-3xl bg-muted" /></div>;

  if (view === "menu") {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-6 pb-24">
        <header className="text-center px-4 mb-2 flex flex-col items-center">
          <h1 className="font-display text-4xl font-bold italic text-[var(--tema-escuro)] flex items-center justify-center gap-2">
            Rotina Azul <span className="text-3xl not-italic">💙</span>
          </h1>
          <p className="text-sm font-semibold tracking-widest uppercase mt-1" style={{ color: "var(--tema)" }}>
            Acompanhamento
          </p>
        </header>

        <div className="px-4"><SeletorTesouro /></div>

        <div className="px-4 mt-6">
          <h2 className="font-display text-xl font-bold italic mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5" style={{ color: "var(--tema)" }} /> Para Hoje
          </h2>

          <div className="notebook p-4 space-y-3 mb-4" style={{ boxShadow: "0 0 20px 2px var(--tema-claro)", border: "1px solid var(--tema)" }}>
            <p className="font-display text-base font-bold text-muted-foreground border-b border-border/50 pb-2">Medicações</p>
            {agendaHoje.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma medicação pendente para hoje.</p>
            ) : (
              agendaHoje.map((a, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="font-bold text-sm flex items-center gap-1">
                      {a.med.medicamento}
                      {!a.med.fim && <span title="Uso contínuo" className="text-muted-foreground ml-1 text-xs">♾️</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.med.dosagem}
                      {a.med.estoqueAtual !== undefined && ` · Restam ${a.med.estoqueAtual} ${a.med.dosagemUnidade || "un"}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-lg" style={{ color: "var(--tema)" }}>{a.horario}</span>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => registrarMedicacao(a.med, hoje, a.horario)} className="text-[10px] font-bold text-white px-2 py-1 rounded-md" style={{ backgroundColor: "var(--tema)" }}>Tomei</button>
                      <button onClick={() => setAtrasoModal({ item: a.med, horario: a.horario })} className="text-[10px] font-bold rounded-md px-2 py-1 border" style={{ borderColor: "var(--tema)", color: "var(--tema-escuro)" }}>Atrasei</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="notebook p-4 space-y-3" style={{ boxShadow: "0 0 20px 2px var(--tema-claro)", border: "1px solid var(--tema)" }}>
            <p className="font-display text-base font-bold text-muted-foreground border-b border-border/50 pb-2">Compromissos</p>
            <div className="space-y-3">
              {proximos.filter(i => i.data === hoje).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum compromisso para hoje.</p>
              ) : (
                proximos.filter(i => i.data === hoje).map((i) => (
                  <CompromissoCard key={i.id} item={i} compacto />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 px-4 mt-6">
          <button onClick={() => setView("compromissos")} className="notebook flex flex-col items-center justify-center gap-2 border-[#B8933F]/60 p-4 transition hover:bg-muted/10">
            <div className="grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><Stethoscope className="h-5 w-5" /></div>
            <span className="font-display text-sm font-semibold italic text-center">Compromissos</span>
          </button>
          <button onClick={() => setView("medicacoes")} className="notebook flex flex-col items-center justify-center gap-2 border-[#B8933F]/60 p-4 transition hover:bg-muted/10">
            <div className="grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><PillIcon className="h-5 w-5" /></div>
            <span className="font-display text-sm font-semibold italic text-center">Medicação</span>
          </button>
        </div>
      </div>
    );
  }

  if (view === "compromissos") {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-20 pt-2">
        <Botao variant="ghost" onClick={() => setView("menu")} className="mb-1 flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Voltar</Botao>
        <header><h1 className="font-display text-3xl font-semibold italic text-foreground">Compromissos</h1></header>
        <SeletorTesouro />
        
        <div className="notebook p-5 mt-4" style={{ boxShadow: "0 0 20px 2px var(--tema-claro)", border: "1px solid var(--tema)" }}>
          <h2 className="font-display text-xl font-semibold italic text-foreground flex items-center gap-2 mb-1">
            <Stethoscope className="h-5 w-5" style={{ color: "var(--tema)" }} /> Panorama dos cuidados
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Toque em um dos blocos para ver os detalhes.</p>
          
          <div className="flex gap-2 mb-4">
            <Pill ativo={periodo === "mes"} onClick={() => setPeriodo("mes")}>Este mês</Pill>
            <Pill ativo={periodo === "ano"} onClick={() => setPeriodo("ano")}>Este ano</Pill>
            <Pill ativo={periodo === "tudo"} onClick={() => setPeriodo("tudo")}>Tudo</Pill>
          </div>

          <div className="grid gap-3">
            {(["Consulta", "Terapia", "Exame"] as Cuidado[]).map((c) => {
              const doTipo = filtrados.filter((i) => i.cuidado === c);
              return (
                <div key={c} className="bg-muted/30 rounded-xl p-4 border border-border/50">
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
                        <Botao variant="ghost" key={s} onClick={() => setDrill({ cuidado: c, situacao: s })} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${ativo ? "bg-primary text-primary-foreground" : "bg-white border border-border/50 shadow-sm"}`}>
                          <span>{label}</span><strong>{n}</strong>
                        </Botao>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {drill && (
          <section className="notebook space-y-3 p-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{drill.cuidado} · {LINHAS.find((l) => l.s === drill.situacao)?.label}</h3>
              <Botao variant="ghost" onClick={() => setDrill(null)} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-semibold"><X className="h-4 w-4" /> Fechar</Botao>
            </div>
            {filtrados.filter((i) => i.cuidado === drill.cuidado && (i.situacao ?? "proximo") === drill.situacao).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada por aqui.</p>
            ) : (
              ordenarPorDataHora(filtrados.filter((i) => i.cuidado === drill.cuidado && (i.situacao ?? "proximo") === drill.situacao)).map((i) => <CompromissoCard key={i.id} item={i} compacto />)
            )}
          </section>
        )}

        <Divisor />
        
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Todos os próximos</h2>
          <select className="field text-sm p-2 w-full border-gold/30 bg-card mb-2" value={buscaProximos} onChange={(e) => setBuscaProximos(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="Consulta">Consulta</option>
            <option value="Terapia">Terapia</option>
            <option value="Exame">Exame</option>
          </select>
          {proximos.length === 0 ? (
            <p className="notebook p-4 text-sm text-muted-foreground">Nenhum compromisso agendado.</p>
          ) : (
            <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
              {proximos.map((i) => <CompromissoCard key={i.id} item={i} compacto />)}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-20 py-4">
      <Botao variant="ghost" onClick={() => setView("menu")} className="mb-2 flex items-center gap-1 text-sm font-semibold"><ChevronLeft className="h-4 w-4" /> Voltar</Botao>
      <header><h1 className="text-2xl font-semibold">Medicações</h1></header>
      <SeletorTesouro />

      <section className="notebook p-5 space-y-4 relative" style={{ boxShadow: "0 0 40px 10px var(--tema-claro), 0 4px 12px -4px rgba(0,0,0,0.1)", border: "2px solid var(--tema)" }}>
        <div className="flex items-center gap-2 mb-2">
          <History className="h-4 w-4" style={{ color: "var(--tema)" }} />
          <h2 className="font-sans text-base font-semibold text-foreground">Histórico das doses tomadas</h2>
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
              <li key={l.id} className="flex items-center gap-2 rounded-lg bg-muted/20 p-2 font-sans text-sm">
                <span className="text-green-600">✓</span>
                <span className="flex-1 text-foreground">{l.titulo}</span>
                <span className="text-xs text-muted-foreground">{l.criadoEm?.slice(11, 16)}</span>
                <button onClick={() => excluirLog(l)} className="p-1 text-muted-foreground hover:text-red-500 transition" title="Excluir registro"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 mt-4">
        <h2 className="font-sans text-base font-semibold text-foreground">
          Todos os próximos agendamentos
        </h2>

        {continuos.length > 0 && (
          <div className="space-y-2 mb-4">
            {continuos.map(m => {
              const inicioDate = parseYMD(m.inicio || hoje);
              const limiteDate = new Date(inicioDate.getTime());
              limiteDate.setDate(limiteDate.getDate() + 15);
              const dataFormatada = `${String(limiteDate.getDate()).padStart(2, '0')}/${String(limiteDate.getMonth() + 1).padStart(2, '0')}/${limiteDate.getFullYear()}`;
              
              const hojeDate = parseYMD(hoje);
              const diasPassados = Math.floor((hojeDate.getTime() - inicioDate.getTime()) / (1000 * 3600 * 24));
              const aviso = diasPassados >= 10;

              return (
                <div key={m.id} className={`flex justify-between items-center p-3 rounded-xl border shadow-sm ${aviso ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex flex-col">
                    <span className={`font-semibold text-sm ${aviso ? 'text-red-900' : 'text-amber-900'}`}>
                      {m.medicamento} <span className="text-[10px] font-normal opacity-70 ml-1">(Uso contínuo)</span>
                    </span>
                    <span className={`text-[11px] ${aviso ? 'text-red-700 font-bold' : 'text-amber-700'}`}>
                      {aviso ? "⚠️ Renove agora! " : ""}Agendado até {dataFormatada}
                    </span>
                  </div>
                  <button
                    onClick={() => (navigate as any)({ to: "/criar", search: { duplicar: m.id } })}
                    className={`flex items-center gap-1 font-bold text-xs px-3 py-1.5 rounded-lg transition ${aviso ? 'text-red-700 bg-red-100 hover:bg-red-200' : 'text-amber-700 bg-amber-100 hover:bg-amber-200'}`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Renovar
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="max-h-[400px] overflow-y-auto pr-1 space-y-3">
          {proximosAgendamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhuma dose pendente.</p>
          ) : (
            proximosAgendamentos.map((a, idx) => {
              const itemFormatado = { ...a.med, data: a.data, hora: a.horario, situacao: "proximo", cuidado: "Medicação" as Cuidado } as unknown as Item;
              const isHoje = a.data === hoje;
              const [ano, mes, dia] = a.data.split("-");
              const dataFormatada = `${dia}/${mes}/${ano}`;
              
              return (
                <div key={`${a.med.id}-${a.data}-${a.horario}-${idx}`} className="space-y-1 pb-1">
                  <CompromissoCard item={itemFormatado} compacto />
                  <p className="text-[11px] font-semibold text-muted-foreground pl-2 uppercase tracking-wide flex items-center gap-1">
                    {isHoje ? "Hoje" : dataFormatada}, às {a.horario}
                    {!a.med.fim && <span title="Uso contínuo" className="text-muted-foreground/70 ml-1 text-xs">♾️</span>}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="notebook p-5 space-y-4 relative mt-4" style={{ boxShadow: "0 0 40px 10px var(--tema-claro), 0 4px 12px -4px rgba(0,0,0,0.1)", border: "2px solid var(--tema)" }}>
        <h2 className="font-sans text-base font-semibold text-foreground flex items-center gap-2">
          <PillIcon className="h-4 w-4" style={{ color: "var(--tema)" }} /> Meus Remédios
        </h2>
        <div className="flex gap-2">
          <Pill ativo={filtroRemedios === "uso"} onClick={() => setFiltroRemedios("uso")}>Em uso ({emUso.length})</Pill>
          <Pill ativo={filtroRemedios === "encerrados"} onClick={() => setFiltroRemedios("encerrados")}>Encerrados ({encerradas.length})</Pill>
        </div>
        <div className="space-y-2 mt-2">
          {filtroRemedios === "uso"
            ? emUso.map(m => <CompromissoCard key={m.id} item={m} compacto />)
            : encerradas.map(m => <CompromissoCard key={m.id} item={m} compacto />)
          }
        </div>
      </section>

      <section className="notebook p-5 space-y-4 relative mt-4" style={{ boxShadow: "0 0 40px 10px var(--tema-claro), 0 4px 12px -4px rgba(0,0,0,0.1)", border: "2px solid var(--tema)" }}>
        <div className="flex items-center gap-2 border-b border-border/50 pb-2 mb-2">
          <Plane className="h-5 w-5" style={{ color: "var(--tema)" }} />
          <h2 className="font-display text-lg font-bold italic" style={{ color: "var(--tema-escuro)" }}>Planejador de Viagens</h2>
        </div>
        <p className="text-xs text-muted-foreground">Insira os detalhes da viagem e calcularemos a quantidade exata de medicamentos.</p>
        
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Data de início</span>
            <input type="date" className="field text-sm" value={viagemInicio} onChange={e => setViagemInicio(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Data de término</span>
            <input type="date" className="field text-sm" value={viagemFim} onChange={e => setViagemFim(e.target.value)} />
          </label>
        </div>
        
        <div className="flex justify-between items-center text-sm font-semibold text-foreground py-2 border-y border-border/50 mt-2">
          <span>Duração da viagem</span>
          <span className="text-[var(--tema)]">{duracaoViagem()} dias</span>
        </div>

        <div className="mt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Suas necessidades de medicação</p>
          <div className="space-y-2">
            {calcularViagem().length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Defina as datas para calcular.</p>
            ) : (
              calcularViagem().map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-border/50 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground">
                      <PillIcon className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-sm">{item.med.medicamento}</span>
                  </div>
                  <span className="font-bold text-sm" style={{ color: "var(--tema)" }}>
                    {item.total} {item.unidade.toLowerCase()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {atrasoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-3xl bg-card p-5 shadow-xl">
            <h3 className="font-display text-lg font-bold text-foreground">Atrasou a medicação</h3>
            <p className="text-sm text-muted-foreground">Qual o novo horário que você deu a dose do {atrasoModal.item.medicamento}?</p>
            <input type="time" className="w-full rounded-xl border p-2" defaultValue={new Date().toTimeString().slice(0, 5)} onChange={(e) => setAtrasoModal((prev: any) => prev ? { ...prev, novoHorario: e.target.value } : null)} />
            <div className="flex gap-2">
              <button onClick={() => setAtrasoModal(null)} className="flex-1 rounded-full border py-2 text-sm font-bold text-muted-foreground">Cancelar</button>
              <button onClick={() => {
                const novoH = atrasoModal.novoHorario || new Date().toTimeString().slice(0, 5);
                registrarMedicacao(atrasoModal.item, hoje, atrasoModal.horario, novoH);
              }} className="flex-1 rounded-full bg-primary py-2 text-sm font-bold text-primary-foreground">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}