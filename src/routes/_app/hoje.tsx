/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, Stethoscope, Pill as PillIcon, ChevronRight, X, Leaf, FileText } from "lucide-react";
import { useState, useMemo } from "react";
import { useApp } from "@/lib/app-store";
import { hojeYMD, medicacaoEmUso, doseRegistrada, nowLocalISO, uid, type Dados } from "@/lib/cuidados";
import { SeletorTesouro } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

import { Criar } from "./criar"; 

export const Route = createFileRoute("/_app/hoje")({
  head: () => ({ meta: [{ title: "Hoje · Rotina Azul" }] }),
  component: Hoje,
});

function Hoje() {
  const { itens, logs, carregando, salvarRegistros } = useApp();
  const navigate = useNavigate();
  const hoje = hojeYMD();

  const [modalDosesAberto, setModalDosesAberto] = useState(false);
  const [modalCompromissosAberto, setModalCompromissosAberto] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState<any>(null);

  const [modalCriarAberto, setModalCriarAberto] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState<any>(null);

  // --- Lógica de Medicações ---
  const emUso = itens.filter((i) => i.cuidado === "Medicação" && medicacaoEmUso(i));
  
  const agendaHoje = useMemo(() => {
    const arr: any[] = [];
    emUso.forEach((m) => {
      if (m.inicio && hoje < m.inicio) return;
      if (m.fim && hoje > m.fim) return;
      
      const diasSemana = m.diasSemana || [0, 1, 2, 3, 4, 5, 6];
      if (!diasSemana.includes(new Date().getDay())) return;
      
      const horarios = m.horarios || [];
      let horariosValidos = horarios;
      if (m.inicio === hoje && horarios.length > 0) {
        horariosValidos = horarios.filter((h: string) => h >= (horarios[0] ?? ""));
      }
      
      horariosValidos.filter((h: string) => !doseRegistrada(logs, m.id, hoje, h.trim())).forEach((hora: string) => {
        arr.push({ med: m, horario: hora });
      });
    });
    return arr.sort((a, b) => a.horario.localeCompare(b.horario));
  }, [emUso, logs, hoje]);

  // --- Lógica de Compromissos ---
  const compromissosHoje = useMemo(() => {
    return itens
      .filter(i => i.data === hoje && i.cuidado !== "Medicação" && (i.cuidado as any) !== "Sintoma" && (i.cuidado as any) !== "BemEstar" && (i.cuidado as any) !== "Tesouro")
      .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
  }, [itens, hoje]);

  const registrarMedicacao = async (item: any, data: string, horario: string) => {
    const dados: Dados = { id: uid(), pessoaId: item.pessoaId, criadoEm: nowLocalISO(), titulo: `Tomou: ${item.medicamento} (${horario})`, cuidado: "Medicação_Log" as any, evento: true, parentId: item.id, data, horario };
    let ok = await salvarRegistros([dados], "medicacao_logs");
    if (ok && item.estoqueAtual !== undefined) {
      const novoEstoque = Math.max(0, item.estoqueAtual - Number(item.dosagemValor || 1));
      await salvarRegistros([{ id: uid(), pessoaId: item.pessoaId, criadoEm: nowLocalISO(), titulo: "Estoque", cuidado: item.cuidado, evento: true, parentId: item.id, acao: "editar", alteracoes: { estoqueAtual: novoEstoque } }], "acontecimentos");
    }
    if (ok) {
      toast.success("Medicação registrada!");
      if (agendaHoje.length <= 1) setModalDosesAberto(false);
    }
  };

  const atualizarSituacao = async (id: string, pessoaId: string, cuidado: string, situacao: string) => {
    const ok = await salvarRegistros([{ 
      id: uid(), pessoaId, criadoEm: nowLocalISO(), titulo: `Status: ${situacao}`, cuidado, evento: true, parentId: id, acao: "editar", alteracoes: { situacao } 
    }], "acontecimentos");
    if (ok) toast.success("Status atualizado!");
  };

  const abrirCriar = (tipo: string) => {
    setTipoSelecionado(tipo);
    setModalCriarAberto(true);
  };

  if (carregando) return <div className="p-4 space-y-3"><Skeleton className="h-60 rounded-3xl bg-muted" /></div>;

  return (
    <div className="mx-auto max-w-lg space-y-4 py-6 pb-24">
      
      {/* MODAL NOVO REGISTRO */}
      {modalCriarAberto && (
        <div className="fixed inset-0 z-50 bg-[#F8F9FA] overflow-y-auto">
          <div className="sticky top-0 z-50 flex justify-between items-center p-4 bg-white/90 backdrop-blur-md border-b border-gray-200 max-w-lg mx-auto">
             <h2 className="font-display text-xl font-bold italic text-gray-800">Novo Registro</h2>
             <button onClick={() => setModalCriarAberto(false)} className="flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 shadow-sm">
               <X className="h-4 w-4" /> Fechar
             </button>
          </div>
          <div className="p-4 pb-24 max-w-lg mx-auto">
             <Criar tipoInicial={tipoSelecionado} onFechar={() => setModalCriarAberto(false)} />
          </div>
        </div>
      )}

      {/* MODAL: TODAS AS DOSES */}
      {modalDosesAberto && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: `linear-gradient(135deg, var(--tema-claro) 0%, #F8F9FA 100%)` }}>
          <div className="sticky top-0 z-50 flex justify-between items-center p-4 bg-white/80 backdrop-blur-md border-b border-[var(--tema)]/20 max-w-lg mx-auto">
             <h2 className="font-display text-xl font-bold italic" style={{ color: "var(--tema-escuro)" }}>Todas as doses de hoje</h2>
             <button onClick={() => setModalDosesAberto(false)} className="flex items-center gap-1 rounded-full bg-white/60 px-4 py-2 text-sm font-bold text-[var(--tema-escuro)] hover:bg-white shadow-sm border border-[var(--tema)]/30">
               <X className="h-4 w-4" /> Fechar
             </button>
          </div>
          <div className="p-4 space-y-2 max-w-lg mx-auto pb-24">
            {agendaHoje.map((a, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-white/50">
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-foreground">
                    {a.med.medicamento} {a.med.dosagem && <span className="font-normal text-xs text-muted-foreground ml-1">{a.med.dosagem}</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-display font-bold text-sm" style={{ color: "var(--tema-escuro)" }}>{a.horario}</span>
                  <button onClick={() => registrarMedicacao(a.med, hoje, a.horario)} className="text-[10px] font-bold text-white px-2 py-1 rounded-md" style={{ backgroundColor: "var(--tema)" }}>Tomei</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: TODOS OS COMPROMISSOS */}
      {modalCompromissosAberto && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: `linear-gradient(135deg, var(--tema-claro) 0%, #F8F9FA 100%)` }}>
          <div className="sticky top-0 z-50 flex justify-between items-center p-4 bg-white/80 backdrop-blur-md border-b border-[var(--tema)]/20 max-w-lg mx-auto">
             <h2 className="font-display text-xl font-bold italic" style={{ color: "var(--tema-escuro)" }}>Compromissos de hoje</h2>
             <button onClick={() => setModalCompromissosAberto(false)} className="flex items-center gap-1 rounded-full bg-white/60 px-4 py-2 text-sm font-bold text-[var(--tema-escuro)] hover:bg-white shadow-sm border border-[var(--tema)]/30">
               <X className="h-4 w-4" /> Fechar
             </button>
          </div>
          
          <div className="p-4 space-y-3 max-w-lg mx-auto pb-24">
            {compromissosHoje.map((i) => (
              <div key={i.id} className="bg-white rounded-2xl shadow-sm border border-white p-3 flex flex-col gap-3">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setDetalheAberto(i)}>
                  <div className="grid h-10 w-10 place-items-center rounded-full shrink-0" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}>
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm text-foreground">{i.titulo}</h3>
                    <p className="text-xs text-muted-foreground">{i.hora || "Horário a definir"} · {i.data.split('-').reverse().join('/')}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => atualizarSituacao(i.id, i.pessoaId, i.cuidado as string, "feito")} className="flex-1 bg-[var(--tema)] text-white font-bold text-[10px] py-1.5 rounded-md opacity-90 hover:opacity-100">Compareceu</button>
                  <button onClick={() => atualizarSituacao(i.id, i.pessoaId, i.cuidado as string, "faltou")} className="flex-1 bg-[var(--tema)] text-white font-bold text-[10px] py-1.5 rounded-md opacity-90 hover:opacity-100">Faltou</button>
                  <button onClick={() => atualizarSituacao(i.id, i.pessoaId, i.cuidado as string, "cancelado")} className="flex-1 bg-[var(--tema)] text-white font-bold text-[10px] py-1.5 rounded-md opacity-90 hover:opacity-100">Cancelou</button>
                </div>
              </div>
            ))}
            
            <p className="text-center text-xs text-[var(--tema-escuro)] font-medium mt-6 opacity-70 italic">
              *clique nos botões para confirmar as ações.
            </p>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES DO COMPROMISSO */}
      {detalheAberto && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <h2 className="font-display text-xl font-bold italic" style={{ color: "var(--tema-escuro)" }}>{detalheAberto.titulo}</h2>
              <button onClick={() => setDetalheAberto(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong className="text-foreground">Data:</strong> {detalheAberto.data.split('-').reverse().join('/')}</p>
              <p><strong className="text-foreground">Horário:</strong> {detalheAberto.hora || "A definir"}</p>
              {detalheAberto.local && <p><strong className="text-foreground">Local:</strong> {detalheAberto.local}</p>}
              {detalheAberto.profissional && <p><strong className="text-foreground">Profissional:</strong> {detalheAberto.profissional}</p>}
              {detalheAberto.situacao && <p><strong className="text-foreground">Status atual:</strong> <span className="uppercase text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded">{detalheAberto.situacao}</span></p>}
            </div>
            <button onClick={() => setDetalheAberto(null)} className="w-full bg-[var(--tema)] text-white font-bold py-2 rounded-xl mt-2">Fechar</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="text-center px-4 mb-2 flex flex-col items-center">
        <h1 className="font-display text-4xl font-bold italic text-[var(--tema-escuro)] flex items-center justify-center gap-2">
          Rotina Azul <span className="text-3xl not-italic">💙</span>
        </h1>
        <p className="text-sm font-semibold tracking-widest uppercase mt-1" style={{ color: "var(--tema)" }}>Hoje</p>
        <p className="text-xs font-sans italic text-muted-foreground mt-2">Cuidando do corpo e da mente.</p>
      </header>

      <div className="px-4"><SeletorTesouro /></div>

      {/* CARD PARA HOJE */}
      <div className="px-4 mt-6">
        <div className="relative overflow-hidden rounded-[2rem] p-6 shadow-xl" style={{ background: `linear-gradient(135deg, var(--tema-claro) 0%, white 100%)`, border: `2px solid var(--tema)` }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
          
          <h2 className="font-display text-2xl font-bold italic mb-4 flex items-center gap-2" style={{ color: "var(--tema-escuro)" }}>
            <Clock className="h-6 w-6" style={{ color: "var(--tema)" }} /> Para Hoje
          </h2>

          <div className="space-y-4 relative z-10">
            {/* Medicações */}
            {agendaHoje.length === 0 ? (
              <div className="bg-white/60 rounded-xl p-3 text-center border border-white/50 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">Tudo em dia por aqui! ✨</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--tema)]">Medicações para tomar</p>
                {agendaHoje.slice(0, 3).map((a, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
                    <span className="font-bold text-sm text-foreground truncate mr-2">
                      {a.med.medicamento} {a.med.dosagem && <span className="font-normal text-xs text-muted-foreground ml-1">{a.med.dosagem}</span>}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-display font-bold text-sm" style={{ color: "var(--tema-escuro)" }}>{a.horario}</span>
                      <button onClick={() => registrarMedicacao(a.med, hoje, a.horario)} className="text-[10px] font-bold text-white px-2 py-1 rounded-md" style={{ backgroundColor: "var(--tema)" }}>Tomei</button>
                    </div>
                  </div>
                ))}
                {agendaHoje.length > 3 && (
                  <button onClick={() => setModalDosesAberto(true)} className="text-xs font-bold text-[var(--tema)] mt-1 hover:underline flex items-center gap-1">
                    + ver todas as {agendaHoje.length} doses <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            <div className="h-px bg-[var(--tema)]/20 my-1"></div>

            {/* Compromissos */}
            {compromissosHoje.length === 0 ? (
               <p className="text-xs text-muted-foreground italic text-center">Nenhum compromisso para hoje.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--tema)]">Compromissos</p>
                
                <div className="flex flex-col bg-white/80 rounded-xl shadow-sm border border-white/50 overflow-hidden">
                  <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white transition" onClick={() => setDetalheAberto(compromissosHoje[0])}>
                    <div className="grid h-8 w-8 place-items-center rounded-full shrink-0" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}>
                      <Stethoscope className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground">{compromissosHoje[0].titulo}</span>
                      <span className="text-xs text-muted-foreground">{compromissosHoje[0].hora || "Horário a definir"}</span>
                    </div>
                  </div>
                  
                  <div className="flex border-t border-gray-100 p-1.5 gap-1.5">
                    <button onClick={() => atualizarSituacao(compromissosHoje[0].id, compromissosHoje[0].pessoaId, compromissosHoje[0].cuidado as string, "feito")} className="flex-1 bg-[var(--tema)] text-white font-bold text-[9px] py-1 rounded-md opacity-90 hover:opacity-100">Compareceu</button>
                    <button onClick={() => atualizarSituacao(compromissosHoje[0].id, compromissosHoje[0].pessoaId, compromissosHoje[0].cuidado as string, "faltou")} className="flex-1 bg-[var(--tema)] text-white font-bold text-[9px] py-1 rounded-md opacity-90 hover:opacity-100">Faltou</button>
                    <button onClick={() => atualizarSituacao(compromissosHoje[0].id, compromissosHoje[0].pessoaId, compromissosHoje[0].cuidado as string, "cancelado")} className="flex-1 bg-[var(--tema)] text-white font-bold text-[9px] py-1 rounded-md opacity-90 hover:opacity-100">Cancelou</button>
                  </div>
                </div>

                {compromissosHoje.length > 1 && (
                  <button onClick={() => setModalCompromissosAberto(true)} className="text-xs font-bold text-[var(--tema)] mt-1 hover:underline flex items-center gap-1">
                    + ver todos os {compromissosHoje.length} compromissos <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NOVO TÍTULO E OS 4 BLOCOS DO CRIAR */}
      <div className="px-4 mt-8">
        <h2 className="font-display text-lg font-bold italic mb-4 whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: "var(--tema-escuro)" }}>
          Adicione aqui os novos registros
        </h2>
        
        <div className="grid grid-cols-2 gap-3">
          {[
            { tipo: "Consulta", icone: Stethoscope },
            { tipo: "Terapia", icone: Leaf },
            { tipo: "Exame", icone: FileText },
            { tipo: "Medicação", icone: PillIcon },
          ].map(({ tipo: c, icone: Icone }) => (
            <button
              key={c}
              onClick={() => abrirCriar(c)}
              className="notebook flex flex-col items-center justify-center p-4 transition hover:bg-muted/10 border-[#B8933F]/60"
              style={{ boxShadow: "0 4px 12px -4px rgba(0,0,0,0.05)" }}
            >
              <div className="grid h-10 w-10 place-items-center rounded-full transition-colors mb-2" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}>
                <Icone className="h-5 w-5" />
              </div>
              <span className="font-display text-sm font-bold italic transition-colors text-[#4A4A4A]">
                {c}
              </span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}