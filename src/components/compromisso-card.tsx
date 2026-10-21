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
  const mostraEstoque = item.dosagemUnidade !== "ml" && item.estoqueAtual !== undefined;

  const tituloExibicao = ehMedicamento 
    ? (item.medicamento || item.titulo.replace("Medicação · ", ""))
    : tituloComTipo(item);

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

  const excluir = async () => {
    if (confirm("Tem certeza que deseja excluir?")) {
      await salvarRegistros([{ id: uid(), pessoaId: item.pessoaId, criadoEm: nowLocalISO(), titulo: "Excluído", cuidado: item.cuidado, evento: true, parentId: item.id, acao: "excluir" }], item.cuidado === "Medicação" ? "medicacao_logs" : "acontecimentos");
      toast.success("Excluído!");
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
            <p className={`break-words font-semibold ${compacto ? "text-sm leading-tight" : "text-lg"}`}>{tituloExibicao}</p>
            {ehMedicamento ? (
              <div className={`mt-1 flex flex-col gap-0.5 ${compacto ? "text-[11px]" : "text-sm"} text-muted-foreground`}>
                <span>{item.dosagem}</span>
                {mostraEstoque && <span>Restam {item.estoqueAtual} un.</span>}
              </div>
            ) : (
              <>
                {/* ✅ Data sempre visível */}
                <div className={`flex items-center gap-2 ${compacto ? "text-[11px]" : "text-xs"} text-muted-foreground mt-1`}>
                  {item.data && <span className="font-semibold text-accent">{formatData(item.data)}</span>}
                  <span className="font-semibold text-accent">{item.hora}</span>
                </div>
                {!compacto && subtitulo(item) && <p className="break-words text-sm font-normal text-muted-foreground">{subtitulo(item)}</p>}
              </>
            )}
          </div>

          {/* ✅ Botões de Ação, Editar e Excluir */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1">
              {/* Editar e Excluir (Sempre visíveis) */}
              <button onClick={() => alert("Editar em breve")} className="p-1 text-muted-foreground hover:text-[var(--tema)] transition"><Pencil className="h-4 w-4" /></button>
              <button onClick={excluir} className="p-1 text-muted-foreground hover:text-red-500 transition"><Trash2 className="h-4 w-4" /></button>
              
              {ehMedicamento && (
                <button onClick={() => setAlarmeAberto(true)} className="p-1 text-muted-foreground hover:text-[var(--tema)] transition"><Clock className="h-4 w-4" /></button>
              )}
            </div>

            {/* Se for compacto e pendente, mostra os botões de status embaixo dos ícones */}
            {compacto && pendente && !ehMedicamento && (
              <div className="flex gap-1">
                <button onClick={() => registrar("feito")} className="text-[10px] font-bold text-white px-2 py-0.5 rounded bg-[var(--tema)]">Compareceu</button>
                <button onClick={() => registrar("faltou")} className="text-[10px] font-bold border border-[var(--tema)] text-[var(--tema-escuro)] px-2 py-0.5 rounded">Faltou</button>
              </div>
            )}
          </div>
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