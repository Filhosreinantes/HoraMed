import { useId, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { Botao, Selo } from "@/components/ui-kit";
import { useApp } from "@/lib/app-store";
import { EMOJI, formatData, nowLocalISO, subtitulo, tituloComTipo, tituloEvento, uid, type Item, type Situacao } from "@/lib/cuidados";

export function CompromissoCard({ item }: { item: Item }) {
  const { salvarRegistros } = useApp();
  const [expandido, setExpandido] = useState(false);
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const detalhesId = useId();
  const pendente = (item.situacao ?? "proximo") === "proximo";
  const quando = item.cuidado === "Medicação"
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
      }]);
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
    <article className="overflow-hidden rounded-2xl border border-gold/30 bg-card shadow-soft">
      <Botao variant="ghost" aria-expanded={expandido} aria-controls={detalhesId}
        onClick={() => setExpandido((v) => !v)}
        className="flex w-full items-center gap-3 rounded-none p-3 text-left text-foreground hover:no-underline active:scale-100">
        <span aria-hidden="true" className="shrink-0 text-2xl">{item.cuidado ? EMOJI[item.cuidado] : "📌"}</span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold">{tituloComTipo(item)}</p>
          {subtitulo(item) && <p className="break-words text-sm font-normal text-muted-foreground">{subtitulo(item)}</p>}
          <p className="text-xs font-normal text-accent">{quando}</p>
          <span className="mt-1 inline-block"><Selo s={item.situacao} /></span>
        </div>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${expandido ? "rotate-180" : ""}`} />
      </Botao>
      {expandido && (
        <div id={detalhesId} className="space-y-3 border-t border-border p-3">
          <dl className="space-y-2 text-sm">
            {linhas.filter(([, valor]) => valor).map(([nome, valor]) => (
              <div key={nome} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">{nome}</dt>
                <dd className="min-w-0 whitespace-pre-wrap break-words font-medium">{valor}</dd>
              </div>
            ))}
          </dl>
          {pendente && (
            <>
              <textarea aria-label="Anotações do acompanhamento" className="field min-h-20" placeholder="Anotações" value={nota} onChange={(e) => setNota(e.target.value)} disabled={salvando} />
              <div className="flex flex-wrap gap-2">
                <Botao onClick={() => registrar("feito")} disabled={salvando} className="flex items-center justify-center gap-1 px-3 py-2 text-sm"><Check className="h-4 w-4" />Compareceu</Botao>
                <Botao variant="outline" onClick={() => registrar("faltou")} disabled={salvando} className="flex items-center justify-center gap-1 px-3 py-2 text-sm"><X className="h-4 w-4" />Faltou</Botao>
                {item.cuidado !== "Medicação" && <Botao variant="ghost" onClick={() => registrar("cancelado")} disabled={salvando} className="px-3 py-2 text-sm">Cancelou</Botao>}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}