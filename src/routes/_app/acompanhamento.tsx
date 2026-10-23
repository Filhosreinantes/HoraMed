/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { X, ChevronLeft, History, Stethoscope, Leaf, FileText, Pill as PillIcon, Plane, Trash2, RefreshCw, Thermometer, Heart, Lock, Activity, Smile, Printer, Trophy, CalendarCheck, PillBottle } from "lucide-react";
import { useApp } from "@/lib/app-store";
import {
  doseRegistrada, hojeYMD, medicacaoEmUso, ordenarPorDataHora, compromissoPendente,
  nowLocalISO, uid, type Cuidado, type Situacao, type Dados, parseYMD, type Item
} from "@/lib/cuidados";
import { Botao, Divisor, Pill, SeletorTesouro } from "@/components/ui-kit";
import { CompromissoCard } from "@/components/compromisso-card";
import { Skeleton } from "@/components/ui/skeleton";
import { VozInput } from "@/components/voz-input";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/acompanhamento")({
  head: () => ({ meta: [{ title: "Acompanhamento · Rotina Azul" }] }),
  component: Acompanhamento,
});

type View = "menu" | "compromissos" | "medicacoes_menu" | "medicacoes_historico" | "medicacoes_proximos" | "medicacoes_estoque" | "medicacoes_viagem" | "tratamento" | "bemestar";
type Periodo = "mes" | "ano" | "tudo";
type Drill = { cuidado: Cuidado; situacao: Situacao } | null;

const LINHAS: { s: Situacao; label: string }[] = [
  { s: "feito", label: "Compareceu" },
  { s: "faltou", label: "Faltou" },
  { s: "cancelado", label: "Cancelou" },
  { s: "proximo", label: "Próximos" },
];

function Acompanhamento() {
  const { itens, logs, carregando, salvarRegistros, ativa, assinaturaAtiva } = useApp();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("menu");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [drill, setDrill] = useState<Drill>(null);
  const [buscaProximos, setBuscaProximos] = useState("");
  const [filtroRemedios, setFiltroRemedios] = useState<"uso" | "encerrados">("uso");

  const [filtroMed, setFiltroMed] = useState("");
  const [dataHistorico, setDataHistorico] = useState(hojeYMD());
  const [viagemInicio, setViagemInicio] = useState(hojeYMD());
  const [viagemFim, setViagemFim] = useState(hojeYMD());

  const [tratamentoSelecionado, setTratamentoSelecionado] = useState<string | null>(null);
  const [sintomasTexto, setSintomasTexto] = useState("");
  const [pressao, setPressao] = useState("");
  const [glicose, setGlicose] = useState("");
  
  const [bemEstarAba, setBemEstarAba] = useState<"tesouro" | "atividades">("tesouro");
  const [tesouroForm, setTesouroForm] = useState({ atividade: "", duracao: "", sentimento: "" });
  const [atividadeForm, setAtividadeForm] = useState({ atividade: "", duracao: "", sentimento: "", gratidao: "" });

  const hoje = hojeYMD();

  const filtrados = useMemo(() => itens.filter((i) => {
    if (periodo === "tudo") return true;
    const d = i.data || i.inicio || "";
    return periodo === "mes" ? d.slice(0, 7) === hoje.slice(0, 7) : d.slice(0, 4) === hoje.slice(0, 4);
  }), [itens, periodo, hoje]);

  const meds = itens.filter((i) => i.cuidado === "Medicação");
  const emUso = ordenarPorDataHora(meds.filter((m) => medicacaoEmUso(m)));
  const encerradas = ordenarPorDataHora(meds.filter((m) => !medicacaoEmUso(m)));
  
  const continuos = useMemo(() => {
    const mapa: Record<string, any> = {};
    emUso.filter(m => !m.fim).forEach(m => {
      const nome = m.medicamento || "";
      const existente = mapa[nome];
      if (!existente || (m.inicio || "") > (existente.inicio || "")) mapa[nome] = m;
    });
    return Object.values(mapa);
  }, [emUso]);

  const remediosAgrupados = useMemo(() => {
    const mapa: Record<string, { med: any, dosesTomadas: number, caixasTomadas: number }> = {};
    meds.forEach(m => {
      const nome = m.medicamento || "Desconhecido";
      if (!mapa[nome]) mapa[nome] = { med: m, dosesTomadas: logs.filter(l => l.parentId === m.id).length, caixasTomadas: 0 };
      else {
        if (m.inicio && (m.inicio > (mapa[nome].med.inicio || ""))) mapa[nome].med = m;
        mapa[nome].dosesTomadas += logs.filter(l => l.parentId === m.id).length;
        mapa[nome].caixasTomadas += 1;
      }
    });
    return Object.values(mapa);
  }, [meds, logs]);

  const tratamentosUnicos = useMemo(() => Array.from(new Set(meds.map(m => m.tratamento).filter(Boolean))) as string[], [meds]);
  const historicoTratamento = useMemo(() => !tratamentoSelecionado ? [] : itens.filter(i => (i.cuidado as string) === "Sintoma" && (i as any).tratamento === tratamentoSelecionado).sort((a, b) => (a.data || "").localeCompare(b.data || "")), [itens, tratamentoSelecionado]);
  const remedioDoTratamento = useMemo(() => !tratamentoSelecionado ? null : meds.find(m => m.tratamento === tratamentoSelecionado), [meds, tratamentoSelecionado]);
  const isHipertensao = tratamentoSelecionado?.toLowerCase().includes("hipertensão");
  const isDiabetes = tratamentoSelecionado?.toLowerCase().includes("diabetes");

  const proximos = useMemo(() => {
    let lista = ordenarPorDataHora(itens.filter((i) => compromissoPendente(i) && i.cuidado !== "Medicação" && (i.cuidado as string) !== "Sintoma" && (i.cuidado as string) !== "BemEstar" && (i.cuidado as string) !== "Tesouro"));
    if (buscaProximos) lista = lista.filter((i) => i.cuidado === buscaProximos);
    return lista;
  }, [itens, buscaProximos]);

  const proximosAgendamentos = useMemo(() => {
    const arr: any[] = [];
    const dataLimite = new Date(); dataLimite.setDate(dataLimite.getDate() + 15);
    const limiteYMD = `${dataLimite.getFullYear()}-${String(dataLimite.getMonth() + 1).padStart(2, "0")}-${String(dataLimite.getDate()).padStart(2, "0")}`;
    emUso.forEach((m) => {
      const dataInicio = m.inicio || hoje; const dataFim = m.fim || limiteYMD;
      if (dataFim < hoje) return;
      const diasDaSemana = m.diasSemana || [0, 1, 2, 3, 4, 5, 6]; const horarios = m.horarios || [];
      if (horarios.length === 0) return;
      let dataIteracao = hoje > dataInicio ? hoje : dataInicio;
      while (dataIteracao <= dataFim) {
        const d = parseYMD(dataIteracao); const diaSemana = d.getDay();
        if (diasDaSemana.includes(diaSemana)) {
          let horariosValidos = horarios;
          if (dataIteracao === dataInicio) horariosValidos = horarios.filter((h: string) => h >= (horarios[0] ?? ""));
          horariosValidos.filter((h: string) => !doseRegistrada(logs, m.id, dataIteracao, h.trim())).forEach((hora: string) => arr.push({ med: m, data: dataIteracao, horario: hora }));
        }
        d.setDate(d.getDate() + 1); dataIteracao = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
    });
    return arr.sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario));
  }, [emUso, logs, hoje]);

  const logsTesouro = useMemo(() => itens.filter(i => (i.cuidado as string) === "Tesouro").sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || "")), [itens]);
  const logsAtividade = useMemo(() => itens.filter(i => (i.cuidado as string) === "BemEstar").sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || "")), [itens]);
  const logsFiltrados = useMemo(() => logs.filter((i: any) => !filtroMed || i.titulo.toLowerCase().includes(filtroMed.toLowerCase())).filter((i: any) => i.data === dataHistorico).sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || "")), [logs, filtroMed, dataHistorico]);

  const salvarSintomaTratamento = async () => {
    if (!ativa || !tratamentoSelecionado || !sintomasTexto.trim()) return;
    const dados: Dados = { id: uid(), pessoaId: ativa.id, criadoEm: nowLocalISO(), titulo: `Sintoma: ${tratamentoSelecionado}`, cuidado: "Sintoma" as any, data: hoje, situacao: "feito", tratamento: tratamentoSelecionado, sintomas: sintomasTexto, pressao: isHipertensao ? pressao : undefined, glicose: isDiabetes ? glicose : undefined } as any;
    if (await salvarRegistros([dados])) { toast.success("Sintomas registrados!"); setSintomasTexto(""); setPressao(""); setGlicose(""); }
  };
  const encerrarTratamento = async () => {
    if (!remedioDoTratamento || !confirm("Tem certeza que deseja encerrar este tratamento?")) return;
    if (await salvarRegistros([{ id: uid(), pessoaId: ativa!.id, criadoEm: nowLocalISO(), titulo: "Tratamento encerrado", cuidado: remedioDoTratamento.cuidado, evento: true, parentId: remedioDoTratamento.id, acao: "editar", alteracoes: { fim: hoje } }], "acontecimentos")) { toast.success("Encerrado!"); setTratamentoSelecionado(null); }
  };
  const imprimirRelatorio = () => {
    if (!ativa || !remedioDoTratamento) return;
    const janela = window.open('', '', 'height=800,width=600');
    if (!janela) return toast.error("Bloqueador de pop-ups ativo.");

    const inicioFmt = remedioDoTratamento.inicio
      ? remedioDoTratamento.inicio.split('-').reverse().join('/')
      : '-';

    const sintomasHtml = historicoTratamento.map((h: any) => {
      const pressaoHtml = h.pressao
        ? '<p style="margin:0;color:#1a5276;font-weight:bold">Pressão: ' + h.pressao + '</p>'
        : '';
      const glicoseHtml = h.glicose
        ? '<p style="margin:0;color:#1a5276;font-weight:bold">Glicose: ' + h.glicose + '</p>'
        : '';
      return (
        '<div style="margin-bottom:12px;border-bottom:1px solid #eee">' +
          '<p style="font-weight:bold;margin:0 0 4px 0">Dia ' + h.data.split('-').reverse().join('/') + '</p>' +
          pressaoHtml +
          glicoseHtml +
          '<p style="margin:0;font-style:italic;color:#555">"' + h.sintomas + '"</p>' +
        '</div>'
      );
    }).join('');

    const html =
      '<html><head><title>Relatório</title>' +
      '<style>' +
        'body{font-family:sans-serif;padding:20px;color:#333}' +
        'h1{color:#1a5276;font-size:22px}' +
        'h2{color:#1a5276;font-size:16px;border-bottom:2px solid #1a5276;padding-bottom:4px}' +
        '.dado{margin-bottom:6px;font-size:14px}' +
        '.label{font-weight:bold}' +
      '</style></head><body>' +
      '<h1>Relatório de Acompanhamento</h1>' +
      '<div class="dado"><span class="label">Tesouro:</span> ' + ativa.nome + '</div>' +
      '<h2>Dados do Tratamento</h2>' +
      '<div class="dado"><span class="label">Tratamento:</span> ' + tratamentoSelecionado + '</div>' +
      '<div class="dado"><span class="label">Remédio:</span> ' + remedioDoTratamento.medicamento + '</div>' +
      '<div class="dado"><span class="label">Dosagem:</span> ' + remedioDoTratamento.dosagem + '</div>' +
      '<div class="dado"><span class="label">Início:</span> ' + inicioFmt + '</div>' +
      '<h2>Sintomas Registrados</h2>' +
      sintomasHtml +
      '<div style="margin-top:30px;font-size:11px;color:#999;text-align:center">Gerado pelo Rotina Azul em ' + new Date().toLocaleDateString('pt-BR') + '</div>' +
      '</body></html>';

    janela.document.write(html);
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 500);
  };
  const salvarTesouro = async () => {
    if (!ativa) return;
    if (await salvarRegistros([{ id: uid(), pessoaId: ativa.id, criadoEm: nowLocalISO(), titulo: "Atividade do Tesouro", cuidado: "Tesouro" as any, data: hoje, situacao: "feito", ...tesouroForm } as any)) { toast.success("Registrado!"); setTesouroForm({ atividade: "", duracao: "", sentimento: "" }); }
  };
  const salvarAtividade = async () => {
    if (!ativa) return;
    if (await salvarRegistros([{ id: uid(), pessoaId: ativa.id, criadoEm: nowLocalISO(), titulo: "Atividade", cuidado: "BemEstar" as any, data: hoje, situacao: "feito", ...atividadeForm } as any)) { toast.success("Registrado!"); setAtividadeForm({ atividade: "", duracao: "", sentimento: "", gratidao: "" }); }
  };
  const excluirLog = async (log: any) => {
    if (!confirm("Excluir este registro?")) return;
    if (await salvarRegistros([{ id: uid(), pessoaId: log.pessoaId, criadoEm: nowLocalISO(), titulo: "Excluído", cuidado: log.cuidado, evento: true, parentId: log.id, acao: "excluir" }], "medicacao_logs")) toast.success("Excluído!");
  };
  const duracaoViagem = () => { if (!viagemInicio || !viagemFim) return 0; const d1 = parseYMD(viagemInicio); const d2 = parseYMD(viagemFim); return d2.getTime() < d1.getTime() ? 0 : Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1; };
  const calcularViagem = () => duracaoViagem() === 0 ? [] : emUso.map(med => ({ med, total: duracaoViagem() * (med.horarios?.length || 1) * Number(med.dosagemValor || 1), unidade: med.dosagemUnidade || "un" }));

  if (carregando) return <div className="space-y-3 p-4"><Skeleton className="h-40 rounded-3xl bg-muted" /><Skeleton className="h-40 rounded-3xl bg-muted" /></div>;

  const RenderPremiumLock = ({ titulo }: { titulo: string }) => (
    <div className="mx-auto max-w-lg space-y-4 pb-20 pt-2"><Botao variant="ghost" onClick={() => setView("menu")} className="mb-1 flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Voltar</Botao><header><h1 className="font-display text-3xl font-semibold italic text-foreground">{titulo}</h1></header><div className="notebook p-8 mt-10 flex flex-col items-center gap-4 text-center" style={{ boxShadow: "0 0 40px 10px var(--tema-claro), 0 4px 12px -4px rgba(0,0,0,0.1)", border: "2px solid var(--tema)" }}><Lock className="h-12 w-12 text-amber-500" /><h2 className="font-display text-2xl font-bold italic text-foreground">Recurso Premium</h2><p className="text-sm text-muted-foreground">O diário de {titulo} está disponível apenas para assinantes do Rotina Azul Premium.</p><Botao className="mt-4 w-full" style={{ backgroundColor: "var(--tema)", color: "white" }}>Conhecer o Premium</Botao></div></div>
  );

  if (view === "menu") {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-6 pb-24">
        <header className="text-center px-4 mb-2 flex flex-col items-center">
          <h1 className="font-display text-4xl font-bold italic text-[var(--tema-escuro)] flex items-center justify-center gap-2">
            Rotina Azul <span className="text-3xl not-italic">💙</span>
          </h1>
          <p className="text-sm font-semibold tracking-widest uppercase mt-1" style={{ color: "var(--tema)" }}>Acompanhamento</p>
          <p className="text-xs font-sans italic text-muted-foreground mt-2">Cuidando do corpo e da mente.</p>
        </header>

        <div className="px-4"><SeletorTesouro /></div>

        <div className="grid grid-cols-2 gap-4 px-4 mt-6">
          <button onClick={() => setView("compromissos")} className="notebook flex flex-col items-center justify-center gap-2 border-[#B8933F]/60 p-4 transition hover:bg-muted/10">
            <div className="grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><Stethoscope className="h-5 w-5" /></div>
            <span className="font-display text-sm font-semibold italic text-center">Compromissos</span>
          </button>
          <button onClick={() => setView("medicacoes_menu")} className="notebook flex flex-col items-center justify-center gap-2 border-[#B8933F]/60 p-4 transition hover:bg-muted/10">
            <div className="grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><PillIcon className="h-5 w-5" /></div>
            <span className="font-display text-sm font-semibold italic text-center">Medicação</span>
          </button>
          <button onClick={() => setView("tratamento")} className="notebook flex flex-col items-center justify-center gap-2 border-[#B8933F]/60 p-4 transition hover:bg-muted/10">
            <div className="grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><Thermometer className="h-5 w-5" /></div>
            <span className="font-display text-sm font-semibold italic text-center">Tratamento</span>
          </button>
          <button onClick={() => setView("bemestar")} className="notebook flex flex-col items-center justify-center gap-2 border-[#B8933F]/60 p-4 transition hover:bg-muted/10">
            <div className="grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><Heart className="h-5 w-5" /></div>
            <span className="font-display text-sm font-semibold italic text-center">Bem-estar</span>
          </button>
        </div>
      </div>
    );
  }

  if (view === "medicacoes_menu") {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-20 pt-2">
        <Botao variant="ghost" onClick={() => setView("menu")} className="mb-1 flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Voltar</Botao>
        <header><h1 className="font-display text-3xl font-semibold italic text-foreground">Medicações</h1></header>
        <SeletorTesouro />
        <div className="grid gap-3 mt-4">
          <button onClick={() => setView("medicacoes_proximos")} className="notebook flex items-center gap-4 p-5 border-[#B8933F]/60 hover:bg-muted/10 transition">
            <div className="grid h-12 w-12 place-items-center rounded-full shrink-0" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><CalendarCheck className="h-6 w-6" /></div>
            <div className="text-left"><h3 className="font-display text-lg font-bold italic">Próximos Agendamentos</h3><p className="text-xs text-muted-foreground">Veja as doses pendentes de hoje e renove tratamentos.</p></div>
          </button>
          <button onClick={() => setView("medicacoes_historico")} className="notebook flex items-center gap-4 p-5 border-[#B8933F]/60 hover:bg-muted/10 transition">
            <div className="grid h-12 w-12 place-items-center rounded-full shrink-0" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><History className="h-6 w-6" /></div>
            <div className="text-left"><h3 className="font-display text-lg font-bold italic">Histórico de Doses</h3><p className="text-xs text-muted-foreground">Acompanhe o que já foi tomado em cada dia.</p></div>
          </button>
          <button onClick={() => setView("medicacoes_estoque")} className="notebook flex items-center gap-4 p-5 border-[#B8933F]/60 hover:bg-muted/10 transition">
            <div className="grid h-12 w-12 place-items-center rounded-full shrink-0" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><PillBottle className="h-6 w-6" /></div>
            <div className="text-left"><h3 className="font-display text-lg font-bold italic">Meus Remédios</h3><p className="text-xs text-muted-foreground">Veja o estoque atual e quantas doses já tomou.</p></div>
          </button>
          <button onClick={() => setView("medicacoes_viagem")} className="notebook flex items-center gap-4 p-5 border-[#B8933F]/60 hover:bg-muted/10 transition">
            <div className="grid h-12 w-12 place-items-center rounded-full shrink-0" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><Plane className="h-6 w-6" /></div>
            <div className="text-left"><h3 className="font-display text-lg font-bold italic">Planejador de Viagens</h3><p className="text-xs text-muted-foreground">Calcule a quantidade exata para a sua viagem.</p></div>
          </button>
        </div>
      </div>
    );
  }

  if (view === "medicacoes_proximos") {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-20 pt-2">
        <Botao variant="ghost" onClick={() => setView("medicacoes_menu")} className="mb-1 flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Voltar</Botao>
        <header><h1 className="font-display text-3xl font-semibold italic text-foreground">Próximos</h1></header>
        <SeletorTesouro />
        {continuos.length > 0 && (
          <div className="space-y-2 mb-4">
            {continuos.map(m => {
              const inicioDate = parseYMD(m.inicio || hoje); const limiteDate = new Date(inicioDate.getTime()); limiteDate.setDate(limiteDate.getDate() + 15);
              const dataFormatada = `${String(limiteDate.getDate()).padStart(2, '0')}/${String(limiteDate.getMonth() + 1).padStart(2, '0')}/${limiteDate.getFullYear()}`;
              const hojeDate = parseYMD(hoje); const diasPassados = Math.floor((hojeDate.getTime() - inicioDate.getTime()) / (1000 * 3600 * 24)); const aviso = diasPassados >= 10;
              return (
                <div key={m.id} className={`flex justify-between items-center p-3 rounded-xl border shadow-sm ${aviso ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex flex-col"><span className={`font-semibold text-sm ${aviso ? 'text-red-900' : 'text-amber-900'}`}>{m.medicamento} <span className="text-[10px] font-normal opacity-70 ml-1">(Uso contínuo)</span></span><span className={`text-[11px] ${aviso ? 'text-red-700 font-bold' : 'text-amber-700'}`}>{aviso ? "⚠️ Renove agora! " : ""}Agendado até {dataFormatada}</span></div>
                  <button onClick={() => (navigate as any)({ to: "/criar", search: { duplicar: m.id } })} className={`flex items-center gap-1 font-bold text-xs px-3 py-1.5 rounded-lg transition ${aviso ? 'text-red-700 bg-red-100 hover:bg-red-200' : 'text-amber-700 bg-amber-100 hover:bg-amber-200'}`}><RefreshCw className="h-3.5 w-3.5" /> Renovar</button>
                </div>
              );
            })}
          </div>
        )}
        <div className="max-h-[600px] overflow-y-auto pr-1 space-y-3">
          {proximosAgendamentos.length === 0 ? <p className="text-sm text-muted-foreground italic text-center p-4">Nenhuma dose pendente.</p> : proximosAgendamentos.map((a, idx) => {
            const itemFormatado = { ...a.med, data: a.data, hora: a.horario, situacao: "proximo", cuidado: "Medicação" as Cuidado } as unknown as Item;
            const isHoje = a.data === hoje; const [ano, mes, dia] = a.data.split("-"); const dataFormatada = `${dia}/${mes}/${ano}`;
            return (
              <div key={`${a.med.id}-${a.data}-${a.horario}-${idx}`} className="space-y-1 pb-1">
                <CompromissoCard item={itemFormatado} compacto />
                <p className="text-[11px] font-semibold text-muted-foreground pl-2 uppercase tracking-wide flex items-center gap-1">{isHoje ? "Hoje" : dataFormatada}, às {a.horario}{!a.med.fim && <span title="Uso contínuo" className="text-muted-foreground/70 ml-1 text-xs">♾️</span>}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "medicacoes_historico") {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-20 pt-2">
        <Botao variant="ghost" onClick={() => setView("medicacoes_menu")} className="mb-1 flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Voltar</Botao>
        <header><h1 className="font-display text-3xl font-semibold italic text-foreground">Histórico</h1></header>
        <SeletorTesouro />
        <div className="notebook p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <input type="date" className="field text-sm p-2" value={dataHistorico} onChange={(e) => setDataHistorico(e.target.value)} />
            <select className="field text-sm p-2" value={filtroMed} onChange={(e) => setFiltroMed(e.target.value)}><option value="">Todos os remédios</option>{emUso.map(m => <option key={m.id} value={m.medicamento}>{m.medicamento}</option>)}</select>
          </div>
          {logsFiltrados.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p> : (
            <ul className="space-y-2">{logsFiltrados.map((l: any) => (<li key={l.id} className="flex items-center gap-2 rounded-lg bg-muted/20 p-2 font-sans text-sm"><span className="text-green-600">✓</span><span className="flex-1 text-foreground">{l.titulo}</span><span className="text-xs text-muted-foreground">{l.criadoEm?.slice(11, 16)}</span><button onClick={() => excluirLog(l)} className="p-1 text-muted-foreground hover:text-red-500 transition" title="Excluir registro"><Trash2 className="h-4 w-4" /></button></li>))}</ul>
          )}
        </div>
      </div>
    );
  }

  if (view === "medicacoes_estoque") {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-20 pt-2">
        <Botao variant="ghost" onClick={() => setView("medicacoes_menu")} className="mb-1 flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Voltar</Botao>
        <header><h1 className="font-display text-3xl font-semibold italic text-foreground">Meus Remédios</h1></header>
        <SeletorTesouro />
        <div className="notebook p-5 space-y-4">
          <div className="flex gap-2">
            <Pill ativo={filtroRemedios === "uso"} onClick={() => setFiltroRemedios("uso")}>Em uso ({emUso.length})</Pill>
            <Pill ativo={filtroRemedios === "encerrados"} onClick={() => setFiltroRemedios("encerrados")}>Encerrados ({encerradas.length})</Pill>
          </div>
          <div className="space-y-2 mt-2">
            {remediosAgrupados.filter(r => filtroRemedios === "uso" ? medicacaoEmUso(r.med) : !medicacaoEmUso(r.med)).map(r => (
              <div key={r.med.id} className="notebook p-4 space-y-1 bg-white text-sm">
                <div className="flex justify-between font-bold text-foreground"><span>{r.med.medicamento}</span><span className="text-xs text-muted-foreground">{r.med.dosagem}</span></div>
                <p className="text-muted-foreground text-xs"><span className="font-semibold text-foreground">Estoque atual:</span> {r.med.estoqueAtual || 0} {r.med.dosagemUnidade || "un"}</p>
                <div className="flex gap-4 mt-2 pt-2 border-t border-border/50"><p className="text-xs text-[var(--tema-escuro)] font-semibold">{r.dosesTomadas} doses tomadas</p><p className="text-xs text-[var(--tema-escuro)] font-semibold">{r.caixasTomadas} {r.caixasTomadas === 1 ? 'ciclo' : 'ciclos'} registrados</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === "medicacoes_viagem") {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-20 pt-2">
        <Botao variant="ghost" onClick={() => setView("medicacoes_menu")} className="mb-1 flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Voltar</Botao>
        <header><h1 className="font-display text-3xl font-semibold italic text-foreground">Planejador</h1></header>
        <SeletorTesouro />
        <div className="notebook p-5 space-y-4">
          <p className="text-xs text-muted-foreground">Insira os detalhes da viagem e calcularemos a quantidade exata de medicamentos.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">Data de início</span><input type="date" className="field text-sm" value={viagemInicio} onChange={e => setViagemInicio(e.target.value)} /></label>
            <label className="block space-y-1"><span className="text-xs font-semibold text-muted-foreground">Data de término</span><input type="date" className="field text-sm" value={viagemFim} onChange={e => setViagemFim(e.target.value)} /></label>
          </div>
          <div className="flex justify-between items-center text-sm font-semibold text-foreground py-2 border-y border-border/50 mt-2"><span>Duração da viagem</span><span className="text-[var(--tema)]">{duracaoViagem()} dias</span></div>
          <div className="mt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Suas necessidades de medicação</p>
            <div className="space-y-2">
              {calcularViagem().length === 0 ? <p className="text-sm text-muted-foreground italic">Defina as datas para calcular.</p> : calcularViagem().map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-border/50 shadow-sm">
                  <div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground"><PillIcon className="h-4 w-4" /></div><span className="font-semibold text-sm">{item.med.medicamento}</span></div>
                  <span className="font-bold text-sm" style={{ color: "var(--tema)" }}>{item.total} {item.unidade.toLowerCase()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "tratamento" && !tratamentoSelecionado) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-20 pt-2">
        <Botao variant="ghost" onClick={() => setView("menu")} className="mb-1 flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Voltar</Botao>
        <header><h1 className="font-display text-3xl font-semibold italic text-foreground">Tratamentos</h1></header>
        <SeletorTesouro />
        <div className="notebook p-5 mt-4 space-y-3">
          <h2 className="font-display text-xl font-semibold italic text-foreground mb-4">Selecione o tratamento</h2>
          {tratamentosUnicos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum tratamento cadastrado nos remédios ainda.</p>
          ) : (
            tratamentosUnicos.map(t => (
              <button key={t} onClick={() => setTratamentoSelecionado(t)} className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition">
                <span className="font-bold text-sm text-foreground">{t}</span>
                <ChevronLeft className="h-4 w-4 text-muted-foreground rotate-180" />
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === "tratamento" && tratamentoSelecionado) {
    return (
      <div className="mx-auto max-w-lg space-y-5 pb-20 py-4">
        <Botao variant="ghost" onClick={() => setTratamentoSelecionado(null)} className="mb-2 flex items-center gap-1 text-sm font-semibold"><ChevronLeft className="h-4 w-4" /> Voltar aos Tratamentos</Botao>
        <header><h1 className="font-display text-3xl font-semibold italic text-foreground">{tratamentoSelecionado}</h1></header>
        <SeletorTesouro />

        {remedioDoTratamento && (
          <div className="notebook p-5 space-y-2 bg-slate-50 border-slate-200">
            <div className="flex items-center gap-2 border-b border-border/50 pb-2 mb-2">
              <PillIcon className="h-5 w-5" style={{ color: "var(--tema)" }} />
              <h2 className="font-display text-lg font-bold italic" style={{ color: "var(--tema-escuro)" }}>Remédio: {remedioDoTratamento.medicamento}</h2>
            </div>
            <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Dosagem:</span> {remedioDoTratamento.dosagem}</p>
            <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Início:</span> {remedioDoTratamento.inicio ? remedioDoTratamento.inicio.split('-').reverse().join('/') : '-'}</p>
          </div>
        )}

        <section className="notebook p-5 space-y-4 relative" style={{ boxShadow: "0 0 40px 10px var(--tema-claro), 0 4px 12px -4px rgba(0,0,0,0.1)", border: "2px solid var(--tema)" }}>
          <div className="flex justify-between items-center">
            <h2 className="font-sans text-base font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: "var(--tema)" }} /> Sintomas Diários
            </h2>
            <button onClick={imprimirRelatorio} className="text-xs font-bold text-[var(--tema)] flex items-center gap-1 bg-[var(--tema-claro)] px-2 py-1 rounded-md">
              <Printer className="h-3 w-3" /> Imprimir
            </button>
          </div>

          {(isHipertensao || isDiabetes) && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              {isHipertensao && (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Pressão Arterial</span>
                  <input type="text" className="field text-sm" placeholder="Ex: 120/80" value={pressao} onChange={(e) => setPressao(e.target.value)} />
                </label>
              )}
              {isDiabetes && (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Glicose (mg/dL)</span>
                  <input type="text" className="field text-sm" placeholder="Ex: 90" value={glicose} onChange={(e) => setGlicose(e.target.value)} />
                </label>
              )}
            </div>
          )}

          <VozInput className="field text-sm min-h-24" placeholder="Escreva aqui o que sente e acompanhe os efeitos do remédio." value={sintomasTexto} onChange={setSintomasTexto} />
          <div className="flex flex-col sm:flex-row gap-2">
            <Botao onClick={salvarSintomaTratamento} className="flex-1" style={{ backgroundColor: "var(--tema)", color: "white" }}>Salvar Sintoma</Botao>
            <Botao onClick={encerrarTratamento} variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50">Tratamento encerrado</Botao>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-sans text-base font-semibold text-foreground">Histórico de Sintomas</h2>
          {historicoTratamento.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum sintoma registrado ainda.</p> : historicoTratamento.map(l => (
            <div key={l.id} className="notebook p-4 space-y-1 bg-white text-sm">
              <div className="flex justify-between font-bold text-foreground">
                <span>{l.data.split('-').reverse().join('/')}</span>
                <span className="text-xs text-muted-foreground">{l.criadoEm?.slice(11, 16)}</span>
              </div>
              {(l as any).pressao && <p className="text-[var(--tema-escuro)] font-semibold text-xs">Pressão: {(l as any).pressao}</p>}
              {(l as any).glicose && <p className="text-[var(--tema-escuro)] font-semibold text-xs">Glicose: {(l as any).glicose}</p>}
              <p className="text-muted-foreground italic mt-1">"{(l as any).sintomas}"</p>
            </div>
          ))}
        </section>
      </div>
    );
  }

  if (view === "bemestar") {
    if (assinaturaAtiva === false) return <RenderPremiumLock titulo="Bem-estar" />;
    
    return (
      <div className="mx-auto max-w-lg space-y-5 pb-20 py-4">
        <Botao variant="ghost" onClick={() => setView("menu")} className="mb-2 flex items-center gap-1 text-sm font-semibold"><ChevronLeft className="h-4 w-4" /> Voltar</Botao>
        <header>
          <h1 className="font-display text-3xl font-semibold italic text-foreground">Bem-estar</h1>
          <p className="text-xs font-sans italic text-muted-foreground mt-1">Cuidando do corpo e da mente.</p>
        </header>
        <SeletorTesouro />

        <div className="flex gap-2 justify-center mb-4">
          <Pill ativo={bemEstarAba === "tesouro"} onClick={() => setBemEstarAba("tesouro")}>Atividades do Tesouro</Pill>
          <Pill ativo={bemEstarAba === "atividades"} onClick={() => setBemEstarAba("atividades")}>Minhas atividades</Pill>
        </div>

        {bemEstarAba === "tesouro" && (
          <>
            <section className="notebook p-5 space-y-4" style={{ boxShadow: "0 0 40px 10px var(--tema-claro), 0 4px 12px -4px rgba(0,0,0,0.1)", border: "2px solid var(--tema)" }}>
              <h2 className="font-sans text-base font-semibold text-foreground flex items-center gap-2">
                <Smile className="h-4 w-4" style={{ color: "var(--tema)" }} /> Atividades do Tesouro
              </h2>
              <div className="grid grid-cols-[2fr_1fr] gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Atividade</span>
                  <input type="text" className="field text-sm" placeholder="Ex: Brincadeira, Leitura..." value={tesouroForm.atividade} onChange={(e) => setTesouroForm(p => ({...p, atividade: e.target.value}))} />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Duração (min)</span>
                  <input type="number" className="field text-sm" placeholder="Ex: 30" value={tesouroForm.duracao} onChange={(e) => setTesouroForm(p => ({...p, duracao: e.target.value}))} />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Como está se sentindo?</span>
                <VozInput className="field text-sm min-h-20" placeholder="Ex: Mais animado..." value={tesouroForm.sentimento} onChange={(v) => setTesouroForm(p => ({...p, sentimento: v}))} />
              </label>
              <Botao onClick={salvarTesouro} className="w-full" style={{ backgroundColor: "var(--tema)", color: "white" }}>Salvar Registro</Botao>
            </section>

            <section className="space-y-3">
              <h2 className="font-sans text-base font-semibold text-foreground">Histórico do Tesouro</h2>
              {logsTesouro.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p> : logsTesouro.map(l => (
                <div key={l.id} className="notebook p-4 space-y-1 bg-white text-sm">
                  <div className="flex justify-between font-bold text-foreground">
                    <span>{(l as any).atividade || "Atividade"}</span>
                    <span className="text-xs text-muted-foreground">{l.criadoEm?.slice(0, 10).split('-').reverse().join('/')} {l.criadoEm?.slice(11, 16)}</span>
                  </div>
                  {(l as any).duracao && <p className="text-muted-foreground"><span className="font-semibold text-foreground">Duração:</span> {(l as any).duracao} min</p>}
                  {(l as any).sentimento && <p className="text-muted-foreground mt-2 italic">"{(l as any).sentimento}"</p>}
                </div>
              ))}
            </section>
          </>
        )}

        {bemEstarAba === "atividades" && (
          <>
            <section className="notebook p-5 space-y-4" style={{ boxShadow: "0 0 40px 10px var(--tema-claro), 0 4px 12px -4px rgba(0,0,0,0.1)", border: "2px solid var(--tema)" }}>
              <h2 className="font-sans text-base font-semibold text-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4" style={{ color: "var(--tema)" }} /> Minhas atividades
              </h2>
              <div className="grid grid-cols-[2fr_1fr] gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Atividade</span>
                  <input type="text" className="field text-sm" placeholder="Ex: Caminhada, Yoga..." value={atividadeForm.atividade} onChange={(e) => setAtividadeForm(p => ({...p, atividade: e.target.value}))} />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Duração (min)</span>
                  <input type="number" className="field text-sm" placeholder="Ex: 30" value={atividadeForm.duracao} onChange={(e) => setAtividadeForm(p => ({...p, duracao: e.target.value}))} />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Como está se sentindo?</span>
                <VozInput className="field text-sm min-h-20" placeholder="Ex: Mais disposto..." value={atividadeForm.sentimento} onChange={(v) => setAtividadeForm(p => ({...p, sentimento: v}))} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Gratidão / Coisas boas</span>
                <VozInput className="field text-sm min-h-20" placeholder="Escreva algo pelo que você é grata hoje." value={atividadeForm.gratidao} onChange={(v) => setAtividadeForm(p => ({...p, gratidao: v}))} />
              </label>
              <Botao onClick={salvarAtividade} className="w-full" style={{ backgroundColor: "var(--tema)", color: "white" }}>Salvar Registro</Botao>
            </section>

            <section className="space-y-3">
              <h2 className="font-sans text-base font-semibold text-foreground">Histórico de Atividades</h2>
              {logsAtividade.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p> : logsAtividade.map(l => (
                <div key={l.id} className="notebook p-4 space-y-1 bg-white text-sm">
                  <div className="flex justify-between font-bold text-foreground">
                    <span>{(l as any).atividade || "Atividade"}</span>
                    <span className="text-xs text-muted-foreground">{l.criadoEm?.slice(0, 10).split('-').reverse().join('/')} {l.criadoEm?.slice(11, 16)}</span>
                  </div>
                  {(l as any).duracao && <p className="text-muted-foreground"><span className="font-semibold text-foreground">Duração:</span> {(l as any).duracao} min</p>}
                  {(l as any).sentimento && <p className="text-muted-foreground mt-2 italic">"{(l as any).sentimento}"</p>}
                  {(l as any).gratidao && <p className="text-muted-foreground mt-1 italic">Gratidão: "{(l as any).gratidao}"</p>}
                </div>
              ))}
            </section>
          </>
        )}
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

  return null;
}