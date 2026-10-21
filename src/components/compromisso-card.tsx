import { useId, useState } from "react";
import { Check, ChevronDown, X, Clock, Pencil, Trash2, Stethoscope, Leaf, FileText, Pill } from "lucide-react";
import { toast } from "sonner";
import { Botao, Selo } from "@/components/ui-kit";
import { useApp } from "@/lib/app-store";
import { formatData, nowLocalISO, subtitulo, tituloComTipo, tituloEvento, uid, type Item, type Situacao } from "@/lib/cuidados";
import { AlarmeModal } from "./alarme-modal";

export function CompromissoCard({ item, compacto = false }: { item: Item; compacto?: boolean }) {
  const { salvarRegistros } = useApp();
  const [expandido, setExpandido] = useState(false);
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [alarmeAberto, setAlarmeAberto] = useState(false);
  const detalhesId = useId();

  const pendente = (item.situacao ?? "proximo") === "proximo";
  const ehMedicamento = item.cuidado === "Medicação";

  const quando = ehMedicamento
    ? [item.inicio && `desde ${formatData(item.inicio)}`, item.fim ? `até ${formatData(item.fim)}` : "uso contínuo"].filter(Boolean).join(" · ")
    : [formatData(item.data), item.hora].filter(Boolean).join(" · ");

  const registrar = async (situacao: Situacao) => {
    if (salvando) return;
    setSalvando(true);
    try {
      const ok = await salvarRegistros([{
        id: uid(), pessoaId: item.pessoaId, criadoEm: nowLocalISO(),
        titulo: tituloEvento(item, situacao), cuidado: item.cuidado,
        situacao, observacaoAcompanhamento: nota, evento: true, parentId: item.id,
      }], item.cuidado === "Medicação" ? "medicacao_logs" : "acontecimentos");

      if (ok) {
        toast.success("Acompanhamento registrado!");
        setNota("");
      }
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const linhas: [string, string | undefined][] = [
    ["Data", formatData(item.data)], ["Hora", item.hora], ["Local", item.local],
    ["Profissional", item.profissional], ["Especialidade", item.especialidade],
    ["Tipo de terapia", item.tipoTerapia], ["Tipo de exame", item.tipoExame],
    ["Recomendações", item.recomendacoes], ["Medicamento", item.medicamento],
    ["Dosagem", item.dosagem], ["Horários", item.horarios?.length ? item.horarios.join(" · ") : item.frequencia],
    ["Início", formatData(item.inicio)], ["Fim", item.cuidado === "Medicação" ? (item.fim ? formatData(item.fim) : "Uso contínuo") : undefined],
    ["Anotações", item.observacaoAcompanhamento],
  ];

  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-gold/30 bg-card shadow-soft transition-all">
        <div className="flex w-full items-center gap-3 p-3 text-left text-foreground">
          
          {/* ÍCONE / FOTO */}
          <button onClick={() => setExpandido((v) => !v)} className="shrink-0">
            {item.fotoUrl ? (
              <img src={item.fotoUrl} alt={item.medicamento} className={`${compacto ? "h-10 w-10" : "h-14 w-14"} rounded-xl object-cover border border-gold/30 shadow-sm`} />
            ) : (
              <span className={`grid ${compacto ? "h-10 w-10" : "h-14 w-14"} place-items-center rounded-xl`} style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}>
                {item.cuidado === "Consulta" && <Stethoscope className={compacto ? "h-5 w-5" : "h-7 w-7"} />}
                {item.cuidado === "Terapia" && <Leaf className={compacto ? "h-5 w-5" : "h-7 w-7"} />}
                {item.cuidado === "Exame" && <FileText className={compacto ? "h-5 w-5" : "h-7 w-7"} />}
                {item.cuidado === "Medicação" && <Pill className={compacto ? "h-5 w-5" : "h-7 w-7"} />}
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpandido((v) => !v)}>
            <p className={`break-words font-semibold ${compacto ? "text-sm leading-tight" : "text-lg"}`}>{tituloComTipo(item)}</p>
            {ehMedicamento ? (
              <div className={`mt-1 flex flex-col gap-0.5 ${compacto ? "text-[11px]" : "text-sm"} text-muted-foreground`}>
                <span>{item.dosagem}</span>
                {item.estoqueAtual !== undefined && <span>Restam {item.estoqueAtual} un.</span>}
              </div>
            ) : (
              <>
                {!compacto && subtitulo(item) && <p className="break-words text-sm font-normal text-muted-foreground">{subtitulo(item)}</p>}
                <div className={`flex items-center gap-2 ${compacto ? "text-[11px]" : "text-xs"} text-muted-foreground mt-1`}>
                  <span className="font-semibold text-accent">{item.hora}</span>
                  {!compacto && <span>{quando}</span>}
                </div>
              </>
            )}
          </div>

          {/* AÇÕES: Se for compacto e compromisso pendente, mostra os botões na lateral */}
          {compacto && pendente && !ehMedicamento ? (
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={() => registrar("feito")} className="text-[10px] font-bold text-white px-2 py-1 rounded-md" style={{ backgroundColor: "var(--tema)" }}>Compareceu</button>
              <button onClick={() => registrar("faltou")} className="text-[10px] font-bold rounded-md px-2 py-1 border" style={{ borderColor: "var(--tema)", color: "var(--tema-escuro)" }}>Faltou</button>
              <button onClick={() => registrar("cancelado")} className="text-[10px] font-bold text-muted-foreground px-2 py-1">Cancelou</button>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              {ehMedicamento && (
                <button onClick={() => setAlarmeAberto(true)} className={`grid ${compacto ? "h-8 w-8" : "h-10 w-10"} place-items-center rounded-full transition hover:opacity-80`} style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}>
                  <Clock className={compacto ? "h-4 w-4" : "h-5 w-5"} />
                </button>
              )}
              <button onClick={() => setExpandido((v) => !v)} className={compacto ? "p-1" : "p-2"}>
                <ChevronDown className={`${compacto ? "h-4 w-4" : "h-5 w-5"} transition-transform ${expandido ? "rotate-180" : ""}`} />
              </button>
            </div>
          )}
        </div>

        {expandido && (
          <div id={detalhesId} className="space-y-3 border-t border-border p-4 bg-muted/10">
            <dl className="space-y-2 text-sm">
              {linhas.filter(([, valor]) => valor).map(([nome, valor]) => (
                <div key={nome} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                  <dt className="text-muted-foreground">{nome}</dt>
                  <dd className="min-w-0 whitespace-pre-wrap break-words font-medium">{valor}</dd>
                </div>
              ))}
            </dl>
            {pendente && !ehMedicamento && !compacto && (
              <>
                <textarea aria-label="Anotações" className="field min-h-20 mt-2" placeholder="Anotações" value={nota} onChange={(e) => setNota(e.target.value)} disabled={salvando} />
                <div className="flex flex-wrap gap-2 mt-2">
                  <Botao onClick={() => registrar("feito")} disabled={salvando} className="flex items-center gap-1 px-3 py-2 text-sm rounded-full" style={{ backgroundColor: "var(--tema)", color: "white" }}><Check className="h-4 w-4" /> Compareceu</Botao>
                  <Botao variant="outline" onClick={() => registrar("faltou")} disabled={salvando} className="flex items-center gap-1 px-3 py-2 text-sm rounded-full" style={{ borderColor: "var(--tema)", color: "var(--tema-escuro)" }}><X className="h-4 w-4" /> Faltou</Botao>
                  <Botao variant="ghost" onClick={() => registrar("cancelado")} disabled={salvando} className="px-3 py-2 text-sm text-muted-foreground rounded-full">Cancelou</Botao>
                </div>
              </>
            )}
          </div>
        )}
      </article>

      {alarmeAberto && <AlarmeModal item={item} fechar={() => setAlarmeAberto(false)} />}
    </>
  );
}