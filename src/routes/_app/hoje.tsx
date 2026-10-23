/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Stethoscope, Pill as PillIcon, ChevronRight } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { hojeYMD, medicacaoEmUso, doseRegistrada, nowLocalISO, uid, type Dados } from "@/lib/cuidados";
import { SeletorTesouro } from "@/components/ui-kit";
import { CompromissoCard } from "@/components/compromisso-card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/hoje")({
  head: () => ({ meta: [{ title: "Hoje · Rotina Azul" }] }),
  component: Hoje,
});

function Hoje() {
  const { itens, logs, carregando, salvarRegistros } = useApp();
  const navigate = useNavigate();
  const hoje = hojeYMD();

  // Lógica para calcular o que tem para hoje
  const emUso = itens.filter((i) => i.cuidado === "Medicação" && medicacaoEmUso(i));
  
  const agendaHoje: any[] = [];
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
      agendaHoje.push({ med: m, horario: hora });
    });
  });
  agendaHoje.sort((a, b) => a.horario.localeCompare(b.horario));

  const compromissosHoje = itens.filter(i => i.data === hoje && i.cuidado !== "Medicação" && (i.cuidado as any) !== "Sintoma" && (i.cuidado as any) !== "BemEstar" && (i.cuidado as any) !== "Tesouro");

  const registrarMedicacao = async (item: any, data: string, horario: string) => {
    const dados: Dados = { id: uid(), pessoaId: item.pessoaId, criadoEm: nowLocalISO(), titulo: `Tomou: ${item.medicamento} (${horario})`, cuidado: "Medicação_Log" as any, evento: true, parentId: item.id, data, horario };
    let ok = await salvarRegistros([dados], "medicacao_logs");
    if (ok && item.estoqueAtual !== undefined) {
      const novoEstoque = Math.max(0, item.estoqueAtual - Number(item.dosagemValor || 1));
      await salvarRegistros([{ id: uid(), pessoaId: item.pessoaId, criadoEm: nowLocalISO(), titulo: "Estoque", cuidado: item.cuidado, evento: true, parentId: item.id, acao: "editar", alteracoes: { estoqueAtual: novoEstoque } }], "acontecimentos");
    }
    if (ok) toast.success("Medicação registrada!");
  };

  if (carregando) return <div className="p-4 space-y-3"><Skeleton className="h-60 rounded-3xl bg-muted" /></div>;

  return (
    <div className="mx-auto max-w-lg space-y-4 py-6 pb-24">
      <header className="text-center px-4 mb-2 flex flex-col items-center">
        <h1 className="font-display text-4xl font-bold italic text-[var(--tema-escuro)] flex items-center justify-center gap-2">
          Rotina Azul <span className="text-3xl not-italic">💙</span>
        </h1>
        <p className="text-sm font-semibold tracking-widest uppercase mt-1" style={{ color: "var(--tema)" }}>Hoje</p>
        <p className="text-xs font-sans italic text-muted-foreground mt-2">Cuidando do corpo e da mente.</p>
      </header>

      <div className="px-4"><SeletorTesouro /></div>

      {/* CARD MODERNO PARA HOJE */}
      <div className="px-4 mt-6">
        <div className="relative overflow-hidden rounded-[2rem] p-6 shadow-xl" style={{ background: `linear-gradient(135deg, var(--tema-claro) 0%, white 100%)`, border: `2px solid var(--tema)` }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
          
          <h2 className="font-display text-2xl font-bold italic mb-4 flex items-center gap-2" style={{ color: "var(--tema-escuro)" }}>
            <Clock className="h-6 w-6" style={{ color: "var(--tema)" }} /> Para Hoje
          </h2>

          <div className="space-y-4 relative z-10">
            {agendaHoje.length === 0 ? (
              <div className="bg-white/60 rounded-xl p-3 text-center border border-white/50 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">Tudo em dia por aqui! ✨</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--tema)]">Medicações Pendentes ({agendaHoje.length})</p>
                {agendaHoje.slice(0, 3).map((a, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white/80 p-2 rounded-xl shadow-sm border border-white/50">
                    <span className="font-bold text-sm text-foreground truncate mr-2">{a.med.medicamento}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-display font-bold text-sm" style={{ color: "var(--tema-escuro)" }}>{a.horario}</span>
                      <button onClick={() => registrarMedicacao(a.med, hoje, a.horario)} className="text-[10px] font-bold text-white px-2 py-1 rounded-md" style={{ backgroundColor: "var(--tema)" }}>Tomei</button>
                    </div>
                  </div>
                ))}
                {agendaHoje.length > 3 && (
                  <button onClick={() => navigate({ to: "/acompanhamento" })} className="text-xs font-bold text-[var(--tema)] mt-1 hover:underline flex items-center gap-1">
                    + ver todas as {agendaHoje.length} doses <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            <div className="h-px bg-[var(--tema)]/20 my-1"></div>

            {compromissosHoje.length === 0 ? (
               <p className="text-xs text-muted-foreground italic text-center">Nenhum compromisso agendado.</p>
            ) : (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--tema)] mb-2">Próximos Compromissos</p>
                <div className="space-y-2">
                  {compromissosHoje.slice(0, 2).map((i) => (
                    <CompromissoCard key={i.id} item={i} compacto />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GRID DE BOTÕES */}
      <div className="grid grid-cols-2 gap-4 px-4 mt-6">
        <button onClick={() => navigate({ to: "/acompanhamento" })} className="notebook flex flex-col items-center justify-center gap-2 border-[#B8933F]/60 p-4 transition hover:bg-muted/10">
          <div className="grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><Stethoscope className="h-5 w-5" /></div>
          <span className="font-display text-sm font-semibold italic text-center">Acompanhamento</span>
        </button>
        <button onClick={() => navigate({ to: "/criar" })} className="notebook flex flex-col items-center justify-center gap-2 border-[#B8933F]/60 p-4 transition hover:bg-muted/10">
          <div className="grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><PillIcon className="h-5 w-5" /></div>
          <span className="font-display text-sm font-semibold italic text-center">Novo Registro</span>
        </button>
      </div>
    </div>
  );
}