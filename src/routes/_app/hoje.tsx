/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, Stethoscope, Pill as PillIcon, ChevronRight, X, CalendarDays } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/app-store";
import { hojeYMD, medicacaoEmUso, doseRegistrada } from "@/lib/cuidados";
import { SeletorTesouro } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { CompromissoCard } from "@/components/compromisso-card";
import { toast } from "sonner";

// ✅ Puxa o formulário da página "Criar" para dentro da tela "Hoje"
import { Criar } from "./criar";

export const Route = createFileRoute("/_app/hoje")({
  head: () => ({ meta: [{ title: "Hoje · Rotina Azul" }] }),
  component: Hoje,
});

function Hoje() {
  const { itens, logs, carregando } = useApp();
  const navigate = useNavigate();
  const hoje = hojeYMD();

  const [modalCriarAberto, setModalCriarAberto] = useState(false);
  const [modalCompromissosAberto, setModalCompromissosAberto] = useState(false);

  // --- Lógica de Medicações ---
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

  // --- Lógica de Compromissos ---
  const compromissosHoje = itens.filter(i => i.data === hoje && i.cuidado !== "Medicação" && (i.cuidado as any) !== "Sintoma" && (i.cuidado as any) !== "BemEstar" && (i.cuidado as any) !== "Tesouro").sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

  if (carregando) return <div className="p-4 space-y-3"><Skeleton className="h-60 rounded-3xl bg-muted" /></div>;

  return (
    <div className="mx-auto max-w-lg space-y-4 py-6 pb-24">
      
      {/* MODAL NOVO REGISTRO */}
      {modalCriarAberto && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-50 flex justify-end p-4 bg-white/80 backdrop-blur-sm border-b border-gray-100">
             <button onClick={() => setModalCriarAberto(false)} className="flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 shadow-sm">
               <X className="h-4 w-4" /> Fechar
             </button>
          </div>
          <div className="p-4 pb-24">
            <Criar />
          </div>
        </div>
      )}

      {/* MODAL TODOS OS COMPROMISSOS */}
      {modalCompromissosAberto && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-50 flex justify-between items-center p-4 bg-white/90 backdrop-blur-sm border-b border-gray-100">
             <h2 className="font-display text-xl font-bold italic" style={{ color: "var(--tema-escuro)" }}>Compromissos de Hoje</h2>
             <button onClick={() => setModalCompromissosAberto(false)} className="flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 shadow-sm">
               <X className="h-4 w-4" /> Fechar
             </button>
          </div>
          <div className="p-4 space-y-4 max-w-lg mx-auto pb-24">
            {compromissosHoje.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center">Nenhum compromisso para hoje.</p>
            ) : (
              compromissosHoje.map((i) => <CompromissoCard key={i.id} item={i} />)
            )}
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
                      <button onClick={async () => {
                        const dados = { id: Math.random().toString(36).substring(7), pessoaId: a.med.pessoaId, criadoEm: new Date().toISOString(), titulo: `Tomou: ${a.med.medicamento} (${a.horario})`, cuidado: "Medicação_Log" as any, evento: true, parentId: a.med.id, data: hoje, horario: a.horario };
                        if(await useApp.getState().salvarRegistros([dados], "medicacao_logs")) toast.success("Tomou!");
                      }} className="text-[10px] font-bold text-white px-2 py-1 rounded-md" style={{ backgroundColor: "var(--tema)" }}>Tomei</button>
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

            {/* Compromissos */}
            {compromissosHoje.length === 0 ? (
               <p className="text-xs text-muted-foreground italic text-center">Nenhum compromisso para hoje.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--tema)]">Compromissos</p>
                {compromissosHoje.slice(0, 3).map((i) => (
                  <div key={i.id} className="flex items-center justify-between bg-white/80 p-3 rounded-xl shadow-sm border border-white/50 cursor-pointer hover:bg-white transition" onClick={() => setModalCompromissosAberto(true)}>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground">{i.titulo}</span>
                      <span className="text-xs text-muted-foreground">{i.hora || "Horário a definir"}</span>
                    </div>
                  </div>
                ))}
                {compromissosHoje.length > 3 && (
                  <button onClick={() => setModalCompromissosAberto(true)} className="text-xs font-bold text-[var(--tema)] mt-1 hover:underline flex items-center gap-1">
                    + ver todos os {compromissosHoje.length} compromissos <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTOES DE BAIXO */}
      <div className="grid grid-cols-2 gap-4 px-4 mt-6">
        <button onClick={() => setModalCriarAberto(true)} className="notebook flex flex-col items-center justify-center gap-2 border-[#B8933F]/60 p-4 transition hover:bg-muted/10 group">
          <div className="grid h-10 w-10 place-items-center rounded-full group-hover:scale-110 transition-transform" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><PillIcon className="h-5 w-5" /></div>
          <span className="font-display text-sm font-semibold italic text-center">Novo Registro</span>
          <span className="text-[10px] text-muted-foreground">Toque para abrir</span>
        </button>
      </div>
    </div>
  );
}