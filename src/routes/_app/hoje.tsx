import { createFileRoute } from "@tanstack/react-router";
import { Clock, Stethoscope, ChevronRight, X, Pill, Activity, Check } from "lucide-react";
import { useState, useMemo } from "react";
import { useApp } from "@/lib/app-store";
import { hojeYMD, medicacaoEmUso, doseRegistrada, nowLocalISO, uid, type Dados, formatData } from "@/lib/cuidados";
import { SeletorTesouro } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner"; 

export const Route = createFileRoute("/_app/hoje")({
  head: () => ({ meta: [{ title: "Hoje · HoraMed" }] }),
  component: Hoje,
});

function Hoje() {
  const { itens, logs, carregando, salvarRegistros } = useApp();
  const hoje = hojeYMD();

  const [modalDosesAberto, setModalDosesAberto] = useState(false);
  const [modalCompromissosAberto, setModalCompromissosAberto] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState<any>(null);

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

  const dosesTomadasHoje = useMemo(() => {
    const arr: any[] = [];
    emUso.forEach((m) => {
      const horarios = m.horarios || [];
      horarios.forEach((h: string) => {
        if (doseRegistrada(logs, m.id, hoje, h.trim())) {
          arr.push({ med: m, horario: h });
        }
      });
    });
    return arr.sort((a, b) => a.horario.localeCompare(b.horario));
  }, [emUso, logs, hoje]);

  const compromissosHoje = useMemo(() => {
    return itens
      .filter(i => 
        i.data === hoje && 
        (i.cuidado === "Consulta" || i.cuidado === "Exame") &&
        (i.situacao ?? "proximo") === "proximo" 
      )
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
    }
  };

  const atualizarSituacao = async (id: string, pessoaId: string, cuidado: string, situacao: string) => {
    const ok = await salvarRegistros([{ 
      id: uid(), pessoaId, criadoEm: nowLocalISO(), titulo: `Status: ${situacao}`, cuidado, evento: true, parentId: id, situacao 
    }], "acontecimentos");
    if (ok) toast.success("Status atualizado!");
  };

  if (carregando) return <div className="p-4 space-y-3"><Skeleton className="h-60 rounded-3xl bg-muted" /></div>;

  return (
    <div className="mx-auto max-w-lg space-y-4 py-6 pb-24">
      
      {/* MODAL: DETALHES COMPLETOS */}
      {detalheAberto && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <h2 className="font-display text-xl font-bold italic" style={{ color: "var(--tema-escuro)" }}>{detalheAberto.titulo || detalheAberto.medicamento}</h2>
              <button onClick={() => setDetalheAberto(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-3 text-sm">
              {detalheAberto.cuidado === "Medicação" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-xs text-muted-foreground block">Dosagem</span><p className="font-bold">{detalheAberto.dosagem || "-"}</p></div>
                    <div><span className="text-xs text-muted-foreground block">Estoque Restante</span><p className={`font-bold ${(detalheAberto.estoqueAtual || 0) <= 5 ? "text-red-600" : ""}`}>{detalheAberto.estoqueAtual || 0} {detalheAberto.dosagemUnidade || "un"}</p></div>
                    <div className="col-span-2"><span className="text-xs text-muted-foreground block">Tratamento</span><p className="font-bold">{detalheAberto.tratamento || "-"}</p></div>
                    <div><span className="text-xs text-muted-foreground block">Médico Prescritor</span><p>{detalheAberto.profissional || "-"}</p></div>
                    <div><span className="text-xs text-muted-foreground block">Especialidade</span><p>{detalheAberto.especialidade || "-"}</p></div>
                    <div><span className="text-xs text-muted-foreground block">Início</span><p>{formatData(detalheAberto.inicio)}</p></div>
                    <div><span className="text-xs text-muted-foreground block">Fim</span><p>{detalheAberto.fim ? formatData(detalheAberto.fim) : "Uso contínuo"}</p></div>
                    <div className="col-span-2"><span className="text-xs text-muted-foreground block">Horários</span><p>{detalheAberto.horarios?.join(", ") || "-"}</p></div>
                    {detalheAberto.detalhes && (
                      <div className="col-span-2 bg-gray-50 p-2 rounded-lg"><span className="text-xs text-muted-foreground block">Observações</span><p className="italic">{detalheAberto.detalhes}</p></div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><span className="text-xs text-muted-foreground block">Tipo</span><p className="font-bold">{detalheAberto.cuidado}</p></div>
                    <div><span className="text-xs text-muted-foreground block">Data</span><p className="font-bold">{formatData(detalheAberto.data)}</p></div>
                    <div><span className="text-xs text-muted-foreground block">Horário</span><p className="font-bold">{detalheAberto.hora || "A definir"}</p></div>
                    <div className="col-span-2"><span className="text-xs text-muted-foreground block">Local</span><p>{detalheAberto.local || "Não informado"}</p></div>
                    <div><span className="text-xs text-muted-foreground block">Profissional</span><p>{detalheAberto.profissional || "-"}</p></div>
                    <div><span className="text-xs text-muted-foreground block">Especialidade / Tipo</span><p>{detalheAberto.especialidade || detalheAberto.tipoExame || "-"}</p></div>
                    {detalheAberto.recomendacoes && (
                      <div className="col-span-2 bg-blue-50 p-2 rounded-lg"><span className="text-xs text-blue-800 block">Recomendações</span><p className="text-blue-900 italic">{detalheAberto.recomendacoes}</p></div>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setDetalheAberto(null)} className="w-full bg-[var(--tema)] text-white font-bold py-2 rounded-xl mt-2">Fechar</button>
          </div>
        </div>
      )}

      {/* MODAL: TODAS AS DOSES */}
      {modalDosesAberto && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-[var(--tema-claro)] to-white">
          <div className="sticky top-0 z-50 flex justify-between items-center p-4 bg-white/80 backdrop-blur-md border-b border-[var(--tema)]/20 max-w-lg mx-auto">
             <h2 className="font-display text-xl font-bold italic" style={{ color: "var(--tema-escuro)" }}>Todas as doses de hoje</h2>
             <button onClick={() => setModalDosesAberto(false)} className="flex items-center gap-1 rounded-full bg-white/60 px-4 py-2 text-sm font-bold text-[var(--tema-escuro)] hover:bg-white shadow-sm border border-[var(--tema)]/30"><X className="h-4 w-4" /> Fechar</button>
          </div>
          <div className="p-4 space-y-2 max-w-lg mx-auto pb-24">
            {agendaHoje.map((a, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-white/50 gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => { setModalDosesAberto(false); setDetalheAberto(a.med); }}>
                  <div className="grid h-8 w-8 place-items-center rounded-full shrink-0" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><Pill className="h-4 w-4" /></div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-foreground truncate">{a.med.medicamento}</span>
                    <span className="text-[11px] text-muted-foreground truncate">{a.med.dosagem}</span>
                  </div>
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-[var(--tema-claro)] to-white">
          <div className="sticky top-0 z-50 flex justify-between items-center p-4 bg-white/80 backdrop-blur-md border-b border-[var(--tema)]/20 max-w-lg mx-auto">
             <h2 className="font-display text-xl font-bold italic" style={{ color: "var(--tema-escuro)" }}>Compromissos de hoje</h2>
             <button onClick={() => setModalCompromissosAberto(false)} className="flex items-center gap-1 rounded-full bg-white/60 px-4 py-2 text-sm font-bold text-[var(--tema-escuro)] hover:bg-white shadow-sm border border-[var(--tema)]/30"><X className="h-4 w-4" /> Fechar</button>
          </div>
          <div className="p-4 space-y-3 max-w-lg mx-auto pb-24">
            {compromissosHoje.map((i) => (
              <div key={i.id} className="bg-white rounded-2xl shadow-sm border border-white p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => { setModalCompromissosAberto(false); setDetalheAberto(i); }}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="grid h-10 w-10 place-items-center rounded-full shrink-0" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><Stethoscope className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-foreground truncate">{i.titulo}</h3>
                      <p className="text-xs text-muted-foreground truncate">{i.hora || "Horário a definir"}{i.local ? ` · ${i.local}` : ""}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => atualizarSituacao(i.id, i.pessoaId, i.cuidado as string, "feito")} className="flex-1 bg-green-600 text-white font-bold text-[10px] py-1.5 rounded-md hover:bg-green-700">Compareceu</button>
                  <button onClick={() => atualizarSituacao(i.id, i.pessoaId, i.cuidado as string, "faltou")} className="flex-1 bg-amber-500 text-white font-bold text-[10px] py-1.5 rounded-md hover:bg-amber-600">Faltou</button>
                  <button onClick={() => atualizarSituacao(i.id, i.pessoaId, i.cuidado as string, "cancelado")} className="flex-1 bg-red-500 text-white font-bold text-[10px] py-1.5 rounded-md hover:bg-red-600">Cancelou</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="text-center px-4 mb-2 flex flex-col items-center">
        <h1 className="font-display text-4xl font-bold italic text-[var(--tema-escuro)] flex items-center justify-center gap-2">HoraMed <span className="text-3xl not-italic">🩺</span></h1>
        <p className="text-xs font-sans italic text-muted-foreground mt-2">Sua saúde organizada de forma simples.</p>
      </header>

      <div className="px-4"><SeletorTesouro /></div>

      {/* CARD PARA HOJE */}
      <div className="px-4 mt-6">
        <div className="relative overflow-hidden rounded-[2rem] p-6 shadow-xl" style={{ background: `linear-gradient(135deg, var(--tema-claro) 0%, white 100%)`, border: `2px solid var(--tema)` }}>
          
          <h2 className="font-display text-2xl font-bold italic mb-4 flex items-center gap-2" style={{ color: "var(--tema-escuro)" }}><Clock className="h-6 w-6" style={{ color: "var(--tema)" }} /> Para Hoje</h2>

          <div className="space-y-4 relative z-10">
            {/* Medicações Pendentes */}
            {agendaHoje.length === 0 ? (
              <div className="bg-white/60 rounded-xl p-3 text-center border border-white/50 shadow-sm"><p className="text-sm font-medium text-muted-foreground">Nenhuma medicação pendente! ✨</p></div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2"><span className="h-3.5 w-1.5 rounded-full bg-[var(--tema)] shrink-0" /><p className="text-sm font-bold uppercase tracking-wider text-[var(--tema-escuro)]">Medicações para tomar</p></div>
                {agendaHoje.slice(0, 3).map((a, idx) => (
                  <div key={idx} className="flex flex-col bg-white/80 p-3 rounded-xl shadow-sm border border-white/50 gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="grid h-8 w-8 place-items-center rounded-full shrink-0" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}><Pill className="h-4 w-4" /></div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm text-foreground truncate">{a.med.medicamento}</span>
                          <span className="text-[11px] text-muted-foreground truncate">{a.med.dosagem}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-display font-bold text-sm" style={{ color: "var(--tema-escuro)" }}>{a.horario}</span>
                        <button onClick={() => registrarMedicacao(a.med, hoje, a.horario)} className="text-[12px] font-bold text-white px-2.5 py-1 rounded-md" style={{ backgroundColor: "var(--tema)" }}>Tomei</button>
                      </div>
                    </div>
                    <button onClick={() => setDetalheAberto(a.med)} className="text-[10px] font-bold text-[var(--tema)] underline self-start ml-11">Detalhes</button>
                  </div>
                ))}
                {agendaHoje.length > 3 && (
                  <button type="button" onClick={() => setModalDosesAberto(true)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--tema)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95"><span>Ver todas as {agendaHoje.length} doses</span><ChevronRight className="h-4 w-4" /></button>
                )}
              </div>
            )}

            {/* Doses já tomadas (Verde) */}
            {dosesTomadasHoje.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2"><span className="h-3.5 w-1.5 rounded-full bg-green-500 shrink-0" /><p className="text-sm font-bold uppercase tracking-wider text-green-700">Já tomadas</p></div>
                {dosesTomadasHoje.map((a, idx) => (
                  <div key={`tomada-${idx}`} className="flex items-center justify-between bg-green-50 p-2.5 rounded-xl border border-green-200 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="grid h-8 w-8 place-items-center rounded-full shrink-0 bg-green-100 text-green-600"><Check className="h-4 w-4" /></div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-green-800 truncate">{a.med.medicamento}</span>
                        <span className="text-[11px] text-green-600 truncate">{a.med.dosagem}</span>
                      </div>
                    </div>
                    <span className="font-display font-bold text-sm text-green-700">{a.horario}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="h-px bg-[var(--tema)]/20 my-1"></div>

            {/* Compromissos */}
            {compromissosHoje.length === 0 ? (
               <p className="text-xs text-muted-foreground italic text-center">Nenhum compromisso pendente para hoje.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2"><span className="h-3.5 w-1.5 rounded-full bg-[var(--tema)] shrink-0" /><p className="text-sm font-bold uppercase tracking-wider text-[var(--tema-escuro)]">Compromissos</p></div>
                {compromissosHoje.slice(0, 3).map((comp) => (
                  <div key={comp.id} className="flex flex-col bg-white/80 rounded-xl shadow-sm border border-white/50 overflow-hidden">
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="grid h-8 w-8 place-items-center rounded-full shrink-0" style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}>{comp.cuidado === "Consulta" ? <Stethoscope className="h-4 w-4" /> : <Activity className="h-4 w-4" />}</div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm text-foreground truncate">{comp.titulo}</span>
                          <span className="text-xs text-muted-foreground truncate">{comp.hora || "Horário a definir"}{comp.local ? ` · ${comp.local}` : ""}</span>
                        </div>
                      </div>
                      <button onClick={() => setDetalheAberto(comp)} className="text-[10px] font-bold text-[var(--tema)] underline shrink-0">Detalhes</button>
                    </div>
                    <div className="flex border-t border-gray-100 p-1.5 gap-1.5">
                      <button onClick={() => atualizarSituacao(comp.id, comp.pessoaId, comp.cuidado as string, "feito")} className="flex-1 bg-green-600 text-white font-bold text-[12px] py-1 rounded-md hover:bg-green-700">Compareceu</button>
                      <button onClick={() => atualizarSituacao(comp.id, comp.pessoaId, comp.cuidado as string, "faltou")} className="flex-1 bg-amber-500 text-white font-bold text-[12px] py-1 rounded-md hover:bg-amber-600">Faltou</button>
                      <button onClick={() => atualizarSituacao(comp.id, comp.pessoaId, comp.cuidado as string, "cancelado")} className="flex-1 bg-red-500 text-white font-bold text-[12px] py-1 rounded-md hover:bg-red-600">Cancelou</button>
                    </div>
                  </div>
                ))}
                {compromissosHoje.length > 3 && (
                  <button type="button" onClick={() => setModalCompromissosAberto(true)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--tema)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95"><span>Ver todos os {compromissosHoje.length} compromissos</span><ChevronRight className="h-4 w-4" /></button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}