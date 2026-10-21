import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { X, ChevronLeft, Check, Clock, History, Stethoscope, Pill as PillIcon } from "lucide-react";
import { useApp } from "@/lib/app-store";
import {
  EMOJI, doseRegistrada, hojeYMD, medicacaoEmUso, ordenarPorDataHora, compromissoPendente,
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

        <div className="flex gap-2">
          <Pill ativo={periodo === "mes"} onClick={() => setPeriodo("mes")}>Este mês</Pill>
          <Pill ativo={periodo === "ano"} onClick={() => setPeriodo("ano")}>Este ano</Pill>
          <Pill ativo={periodo === "tudo"} onClick={() => setPeriodo("tudo")}>Tudo</Pill>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">🩺 Cuidados médicos</h2>
          <div className="grid gap-3">
            {(["Consulta", "Terapia", "Exame"] as Cuidado[]).map((c) => {
              const doTipo = filtrados.filter((i) => i.cuidado === c);
              return (
                <div key={c} className="notebook p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-display text-lg font-semibold italic">{EMOJI[c]} {c}</p>
                    <span className="font-display text-2xl font-bold text-gold">{doTipo.length}</span>
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
              <h3 className="text-lg font-semibold">{EMOJI[drill.cuidado]} {drill.cuidado} · {LINHAS.find((l) => l.s === drill.situacao)?.label}</h3>
              <Botao variant="ghost" onClick={() => setDrill(null)} className="flex items-center gap-1 rounded-full bg-muted px