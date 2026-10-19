import { useId, useState } from "react";
import { Check, ChevronDown, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Botao, Selo } from "@/components/ui-kit";
import { useApp } from "@/lib/app-store";
import { EMOJI, formatData, nowLocalISO, subtitulo, tituloComTipo, tituloEvento, uid, type Dados, type Item, type Situacao } from "@/lib/cuidados";

export function CompromissoCard({ item }: { item: Item }) {
  const { salvarRegistros } = useApp();
  const [expandido, setExpandido] = useState(false);
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const detalhesId = useId();
  const pendente = (item.situacao ?? "proximo") === "proximo";
  const ehMedicacao = item.cuidado === "Medicação";
  const [editando, setEditando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
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
      }], item.cuidado === "Medicação" ? "medicacao_logs" : "acontecimentos"); // <-- AQUI: passa o tipo correto
      
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

  // Editar/excluir criam um evento novo; o registro original nunca é alterado.
  const salvarMudanca = async (acao: "editar" | "excluir", alteracoes?: Partial<Dados>) => {
    if (salvando) return false;
    setSalvando(true);
    try {
      const ok = await salvarRegistros([{
        id: uid(), pessoaId: item.pessoaId, criadoEm: nowLocalISO(),
        titulo: `${acao === "editar" ? "Edição" : "Exclusão"} · ${tituloComTipo(item)}`,
        cuidado: item.cuidado, evento: true, parentId: item.id, acao, alteracoes,
      }]);
      if (ok) toast.success(acao === "editar" ? "Medicação atualizada!" : "Medicação excluída.");
      return ok;
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
          {ehMedicacao && !editando && (
            confirmarExclusao ? (
              <div className="space-y-2 rounded-xl bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-700">Excluir esta medicação? Os lembretes dela param.</p>
                <div className="flex gap-2">
                  <Botao variant="danger" onClick={() => salvarMudanca("excluir")} disabled={salvando} className="px-3 py-2 text-sm">Sim, excluir</Botao>
                  <Botao variant="outline" onClick={() => setConfirmarExclusao(false)} disabled={salvando} className="px-3 py-2 text-sm">Não</Botao>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Botao onClick={() => setEditando(true)} disabled={salvando} className="flex items-center justify-center gap-1 px-3 py-2 text-sm"><Pencil className="h-4 w-4" />Editar</Botao>
                <Botao variant="outline" onClick={() => setConfirmarExclusao(true)} disabled={salvando} className="flex items-center justify-center gap-1 px-3 py-2 text-sm"><Trash2 className="h-4 w-4" />Excluir</Botao>
              </div>
            )
          )}
          {ehMedicacao && editando && (
            <EditarMedicacao
              item={item}
              salvando={salvando}
              onCancelar={() => setEditando(false)}
              onSalvar={async (alteracoes) => {
                if (await salvarMudanca("editar", alteracoes)) setEditando(false);
              }}
            />
          )}
          {!ehMedicacao && pendente && (
            <>
              <textarea aria-label="Anotações do acompanhamento" className="field min-h-20" placeholder="Anotações" value={nota} onChange={(e) => setNota(e.target.value)} disabled={salvando} />
              <div className="flex flex-wrap gap-2">
                <Botao onClick={() => registrar("feito")} disabled={salvando} className="flex items-center justify-center gap-1 px-3 py-2 text-sm"><Check className="h-4 w-4" />Compareceu</Botao>
                <Botao variant="outline" onClick={() => registrar("faltou")} disabled={salvando} className="flex items-center justify-center gap-1 px-3 py-2 text-sm"><X className="h-4 w-4" />Faltou</Botao>
                <Botao variant="ghost" onClick={() => registrar("cancelado")} disabled={salvando} className="px-3 py-2 text-sm">Cancelou</Botao>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function EditarMedicacao({ item, salvando, onCancelar, onSalvar }: {
  item: Item;
  salvando: boolean;
  onCancelar: () => void;
  onSalvar: (alteracoes: Partial<Dados>) => void;
}) {
  const [medicamento, setMedicamento] = useState(item.medicamento ?? "");
  const [dosagem, setDosagem] = useState(item.dosagem ?? "");
  const [horarios, setHorarios] = useState<string[]>(item.horarios?.length ? item.horarios : ["08:00"]);
  const [inicio, setInicio] = useState(item.inicio ?? "");
  const [fim, setFim] = useState(item.fim ?? "");

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    const limpos = [...new Set(horarios.filter(Boolean))].sort();
    if (!medicamento.trim()) { toast.error("Informe o nome do remédio."); return; }
    if (limpos.length === 0) { toast.error("Informe pelo menos um horário."); return; }
    if (inicio && fim && fim < inicio) { toast.error("O fim não pode ser antes do início."); return; }
    onSalvar({
      titulo: `Medicação · ${medicamento.trim()}`, medicamento: medicamento.trim(), dosagem: dosagem.trim(),
      horarios: limpos, frequencia: limpos.join(", "), inicio,
      fim, // vazio = uso contínuo
    });
  };

  const campo = "field w-full";
  return (
    <form onSubmit={salvar} className="space-y-3">
      <label className="block space-y-1 text-sm"><span className="font-semibold">Nome</span>
        <input className={campo} value={medicamento} onChange={(e) => setMedicamento(e.target.value)} required />
      </label>
      <label className="block space-y-1 text-sm"><span className="font-semibold">Dosagem</span>
        <input className={campo} value={dosagem} onChange={(e) => setDosagem(e.target.value)} />
      </label>
      <div className="space-y-2 text-sm">
        <span className="font-semibold">Horários</span>
        {horarios.map((h, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input className="field flex-1" type="time" aria-label={`Horário ${idx + 1}`} value={h}
              onChange={(e) => setHorarios((p) => p.map((v, i) => (i === idx ? e.target.value : v)))} />
            {horarios.length > 1 && (
              <button type="button" aria-label="Remover horário" onClick={() => setHorarios((p) => p.filter((_, i) => i !== idx))}
                className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold">✕</button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setHorarios((p) => [...p, ""])}
          className="rounded-xl border border-gold/50 bg-card px-4 py-2 text-sm font-semibold">+ Adicionar horário</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1 text-sm"><span className="font-semibold">Início</span>
          <input className={campo} type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label className="block space-y-1 text-sm"><span className="font-semibold">Fim</span>
          <input className={campo} type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Deixe o fim em branco para uso contínuo.</p>
      <div className="flex gap-2">
        <Botao type="submit" disabled={salvando} className="px-3 py-2 text-sm">{salvando ? "Salvando..." : "Salvar"}</Botao>
        <Botao type="button" variant="outline" onClick={onCancelar} disabled={salvando} className="px-3 py-2 text-sm">Cancelar</Botao>
      </div>
    </form>
  );
}
