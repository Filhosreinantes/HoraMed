import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { X, Clock, Check, Pill, PenLine, Trash2 } from "lucide-react";
import { useApp } from "@/lib/app-store";
import {
  EMOJI, hojeYMD, medicacaoEmUso, ordenarPorDataHora, compromissoPendente,
  nowLocalISO, uid, type Cuidado, type Dados
} from "@/lib/cuidados";
import { Botao, Divisor, SeletorTesouro } from "@/components/ui-kit";
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

const FILTROS = [
  { chave: "mes", rotulo: "Este mês" },
  { chave: "ano", rotulo: "Este ano" },
  { chave: "tudo", rotulo: "Tudo" },
] as const;

function Acompanhamento() {
  const { carregando, itens, salvarRegistros } = useApp();
  const [filtro, setFiltro] = useState<"mes" | "ano" | "tudo">("mes");
  const [drillDown, setDrillDown] = useState<{ tipo: Cuidado; filtro: string } | null>(null);
  
  // Estado para o modal de atraso de medicação
  const [medAtrasada, setMedAtrasada] = useState<{ item: any; horario: string } | null>(null);

  const hoje = hojeYMD();

  const filtrados = useMemo(() => {
    return itens.filter((item) => {
      if (item.evento) return false;
      if (filtro === "mes") return item.data?.startsWith(hoje.slice(0, 7)) || item.inicio?.startsWith(hoje.slice(0, 7));
      if (filtro === "ano") return item.data?.startsWith(hoje.slice(0, 4)) || item.inicio?.startsWith(hoje.slice(0, 4));
      return true;
    });
  }, [itens, filtro, hoje]);

  // Compromissos (sem medicação)
  const pendentes = useMemo(
    () => ordenarPorDataHora(filtrados.filter((item) => item.cuidado !== "Medicação" && compromissoPendente(item, hoje))),
    [filtrados, hoje]
  );

  // Medicações em uso
  const medicacoes = filtrados.filter((a) => a.cuidado === "Medicação");
  const medsEmUso = medicacoes.filter((m) => medicacaoEmUso(m, hoje));
  const medsEncerradas = medicacoes.filter((m) => !medicacaoEmUso(m, hoje));

  // Agenda de horários de hoje
  const horariosHoje = useMemo(() => {
    const lista: any[] = [];
    medsEmUso.forEach((m) => {
      const horarios = m.horarios && m.horarios.length > 0 ? m.horarios : (m.frequencia ? [m.frequencia] : ["08:00"]);
      horarios.forEach((h) => {
        // Verifica se já tomou hoje olhando os logs (itens que são medicacao_logs)
        const tomou = itens.find((i: any) => 
          i.cuidado === "Medicação_Log" && 
          i.parentId === m.id && 
          i.titulo.includes(h) && 
          i.data === hoje
        );
        lista.push({ ...m, horarioHoje: h, tomou });
      });
    });
    return lista.sort((a, b) => a.horarioHoje.localeCompare(b.horarioHoje));
  }, [medsEmUso, itens, hoje]);

  const contarPor = (tipo: Cuidado) => {
    const doTipo = filtrados.filter((a) => a.cuidado === tipo);
    return {
      total: doTipo.length,
      proximo: doTipo.filter((a) => compromissoPendente(a, hoje)).length,
      feito: doTipo.filter((a) => a.situacao === "feito").length,
      faltou: doTipo.filter((a) => a.situacao === "faltou").length,
      cancelado: doTipo.filter((a) => a.situacao === "cancelado").length,
    };
  };

  const getListaDrill = () => {
    if (!drillDown) return [];
    let lista = filtrados.filter((a) => a.cuidado === drillDown.tipo);
    if (drillDown.filtro === "proximo") {
      lista = lista.filter((a) => compromissoPendente(a, hoje));
    } else {
      lista = lista.filter((a) => a.situacao === drillDown.filtro);
    }
    return ordenarPorDataHora(lista);
  };

  const registrarMedicacao = async (item: any, horario: string, novoHorario?: string) => {
    const titulo = novoHorario 
      ? `Atrasou: ${item.medicamento} (${horario} -> ${novoHorario})`
      : `Tomou: ${item.medicamento} (${horario})`;
      
    const dados: Dados = {
      id: uid(),
      pessoaId: item.pessoaId,
      criadoEm: nowLocalISO(),
      titulo,
      cuidado: "Medicação_Log",
      evento: true,
      parentId: item.id,
      data: hoje,
    };
    
    // Salva com tipo diferente para NÃO ir para o Pedacinho Azul
    const ok = await salvarRegistros([dados], "medicacao_logs");
    if (ok) {
      toast.success(novoHorario ? "Atraso registrado!" : "Medicação registrada!");
      setMedAtrasada(null);
    }
  };

  const CardContagem = ({ tipo }: { tipo: Cuidado }) => {
    const c = contarPor(tipo);
    const Btn = ({ chave, rotulo, emoji, qtd }: any) => (
      <button onClick={() => setDrillDown({ tipo, filtro: chave })} className="flex items-center gap-1.5 rounded-xl border border-transparent bg-[#F8FAFC] px-2.5 py-1.5 text-[0.68rem] transition-colors hover:border-[rgba(91,146,199,0.2)]">
        <span>{emoji}</span> <span className="flex-1 text-left text-[#7A8A9A]">{rotulo}</span> <span className="font-bold">{qtd}</span>
      </button>
    );

    return (
      <div className="rounded-2xl border border-gold/30 bg-card p-3 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[0.95rem]">{EMOJI[tipo]}</span>
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">{tipo}</p>
          <span className="ml-auto text-lg font-bold">{c.total}</span>
        </div>
        <div className="space-y-1">
          <Btn chave="proximo" rotulo="Próximos" emoji="⏰" qtd={c.proximo} />
          <Btn chave="feito" rotulo="Compareceu" emoji="✓" qtd={c.feito} />
          <Btn chave="faltou" rotulo="Faltou" emoji="—" qtd={c.faltou} />
          <Btn chave="cancelado" rotulo="Cancelou" emoji="✗" qtd={c.cancelado} />
        </div>
      </div>
    );
  };

  if (carregando) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <header className="px-4 pt-6">
        <h1 className="font-display text-2xl font-semibold italic text-foreground">Acompanhamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sua agenda de cuidados num só lugar.</p>
        <div className="mt-4"><SeletorTesouro /></div>
      </header>

      <section className="px-4">
        <div className="flex gap-2">
          {FILTROS.map((f) => (
            <Botao key={f.chave} variant={filtro === f.chave ? "default" : "outline"} onClick={() => { setFiltro(f.chave); setDrillDown(null); }} className="h-9 flex-1 rounded-full text-xs">
              {f.rotulo}
            </Botao>
          ))}
        </div>
      </section>

      <Divisor />

      <section className="px-4">
        <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground">🩺 Cuidados médicos</p>
        <div className="grid grid-cols-2 gap-2">
          <CardContagem tipo="Consulta" />
          <CardContagem tipo="Terapia" />
          <CardContagem tipo="Exame" />
        </div>
      </section>

      {drillDown && (
        <section className="px-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">{drillDown.tipo} · {drillDown.filtro}</h2>
            <Botao variant="ghost" onClick={() => setDrillDown(null)} className="h-8 px-2 text-xs text-muted-foreground">
              <X className="mr-1 h-4 w-4" /> Fechar
            </Botao>
          </div>
          <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
            {getListaDrill().length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum registro nesta categoria.</p>
            ) : (
              getListaDrill().map((item) => <CompromissoCard key={item.id} item={item} />)
            )}
          </div>
        </section>
      )}

      {!drillDown && pendentes.length > 0 && (
        <section className="px-4">
          <h2 className="mb-3 text-lg font-semibold italic text-foreground">Todos os próximos compromissos</h2>
          <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
            {pendentes.map((item) => <CompromissoCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {/* NOVO BLOCO: HORÁRIOS DE MEDICAÇÃO */}
      {!drillDown && (
        <section className="px-4">
          <div className="mb-3 flex items-center gap-2">
            <Pill className="h-5 w-5 text-rose-500" />
            <h2 className="text-lg font-semibold italic text-foreground">Horários dos próximos medicamentos</h2>
          </div>
          <div className="space-y-2">
            {horariosHoje.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum medicamento para hoje.</p>
            ) : (
              horariosHoje.map((h) => (
                <div key={h.id + h.horarioHoje} className="flex items-center justify-between rounded-2xl border border-gold/30 bg-card p-3 shadow-sm">
                  <div>
                    <p className="font-semibold text-foreground">{h.medicamento}</p>
                    <p className="text-xs text-muted-foreground">Horário: {h.horarioHoje} · {h.dosagem}</p>
                  </div>
                  {h.tomou ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700"><Check className="h-3 w-3"/> Tomou</span>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => registrarMedicacao(h, h.horarioHoje)} className="rounded-full bg-[#5B92C7] px-3 py-1 text-xs font-bold text-white shadow-sm">Tomou</button>
                      <button onClick={() => setMedAtrasada({ item: h, horario: h.horarioHoje })} className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700 shadow-sm">Atrasei</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Bloco de Encerrados (como estava antes) */}
          {medsEncerradas.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-widest text-muted-foreground">Medicações Encerradas · {medsEncerradas.length}</p>
              <div className="space-y-2 opacity-70">
                {medsEncerradas.map((m) => <CompromissoCard key={m.id} item={m} />)}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Modal de Atraso */}
      {medAtrasada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-3xl bg-card p-5 shadow-xl">
            <h3 className="font-display text-lg font-bold text-foreground">Atrasou a medicação</h3>
            <p className="text-sm text-muted-foreground">Qual o novo horário que você deu a dose?</p>
            <input 
              type="time" 
              className="w-full rounded-xl border p-2" 
              defaultValue={new Date().toTimeString().slice(0, 5)}
              onChange={(e) => setMedAtrasada({ ...medAtrasada, novoHorario: e.target.value })}
            />
            <div className="flex gap-2">
              <button onClick={() => setMedAtrasada(null)} className="flex-1 rounded-full border py-2 text-sm font-bold text-muted-foreground">Cancelar</button>
              <button onClick={() => {
                const novoH = (document.querySelector('input[type="time"]') as HTMLInputElement).value;
                registrarMedicacao(medAtrasada.item, medAtrasada.horario, novoH);
              }} className="flex-1 rounded-full bg-[#5B92C7] py-2 text-sm font-bold text-white">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}