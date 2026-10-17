import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import {
  EMOJI, formatData, hojeYMD, medicacaoEmUso, nowLocalISO, subtitulo, tituloEvento, uid,
  type Cuidado, type Item, type Situacao,
} from "@/lib/cuidados";
import { Botao, Divisor, Pill, SeletorTesouro, Selo } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/acompanhamento")({
  head: () => ({
    meta: [
      { title: "Acompanhamento · Rotina Azul" },
      { name: "description", content: "Panorama de consultas, terapias, exames e medicações." },
      { property: "og:title", content: "Acompanhamento · Rotina Azul" },
      { property: "og:description", content: "Panorama da rotina de cuidados do seu Tesouro." },
    ],
  }),
  component: Acompanhamento,
});

type Periodo = "mes" | "ano" | "tudo";
type Drill = { cuidado: Cuidado; situacao: Situacao } | { med: "uso" | "encerradas" } | null;

const LINHAS: { s: Situacao; label: string }[] = [
  { s: "feito", label: "Compareceu" },
  { s: "faltou", label: "Faltou" },
  { s: "cancelado", label: "Cancelou" },
  { s: "proximo", label: "Próximos" },
];

function Acompanhamento() {
  const { itens, carregando } = useApp();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [drill, setDrill] = useState<Drill>(null);
  const [aberto, setAberto] = useState<Item | null>(null);

  const filtrados = useMemo(() => {
    const hoje = hojeYMD();
    return itens.filter((i) => {
      if (periodo === "tudo") return true;
      const d = i.data || i.inicio || "";
      return periodo === "mes" ? d.slice(0, 7) === hoje.slice(0, 7) : d.slice(0, 4) === hoje.slice(0, 4);
    });
  }, [itens, periodo]);

  const meds = itens.filter((i) => i.cuidado === "Medicação");
  const emUso = meds.filter((m) => medicacaoEmUso(m));
  const encerradas = meds.filter((m) => !medicacaoEmUso(m));
  const proximos = itens
    .filter((i) => i.situacao === "proximo" && i.cuidado !== "Medicação")
    .sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`));

  const listaDrill = !drill
    ? []
    : "med" in drill
      ? drill.med === "uso" ? emUso : encerradas
      : filtrados.filter((i) => i.cuidado === drill.cuidado && (i.situacao ?? "proximo") === drill.situacao);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-semibold">Acompanhamento</h1>
        <p className="text-sm text-muted-foreground">Sua agenda de cuidados num só lugar.</p>
      </header>
      <SeletorTesouro />
      <div className="flex gap-2">
        <Pill ativo={periodo === "mes"} onClick={() => setPeriodo("mes")}>Este mês</Pill>
        <Pill ativo={periodo === "ano"} onClick={() => setPeriodo("ano")}>Este ano</Pill>
        <Pill ativo={periodo === "tudo"} onClick={() => setPeriodo("tudo")}>Tudo</Pill>
      </div>

      {carregando ? (
        <div className="space-y-3">
          <Skeleton className="h-40 rounded-3xl bg-muted" />
          <Skeleton className="h-40 rounded-3xl bg-muted" />
          <Skeleton className="h-24 rounded-3xl bg-muted" />
        </div>
      ) : (
        <>
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
                        const ativo = drill && "cuidado" in drill && drill.cuidado === c && drill.situacao === s;
                        return (
                          <button
                            key={s}
                            onClick={() => setDrill({ cuidado: c, situacao: s })}
                            className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${ativo ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                          >
                            <span>{label}</span>
                            <strong>{n}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">💊 Medicações</h2>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDrill({ med: "uso" })} className="notebook p-4 text-left">
                <p className="text-sm text-muted-foreground">Em uso</p>
                <p className="font-display text-3xl font-bold text-accent">{emUso.length}</p>
              </button>
              <button onClick={() => setDrill({ med: "encerradas" })} className="notebook p-4 text-left">
                <p className="text-sm text-muted-foreground">Encerradas</p>
                <p className="font-display text-3xl font-bold text-gold">{encerradas.length}</p>
              </button>
            </div>
          </section>

          {drill && (
            <section className="notebook space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {"med" in drill
                    ? drill.med === "uso" ? "💊 Medicações em uso" : "💊 Medicações encerradas"
                    : `${EMOJI[drill.cuidado]} ${drill.cuidado} · ${LINHAS.find((l) => l.s === drill.situacao)?.label}`}
                </h3>
                <button onClick={() => setDrill(null)} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-semibold">
                  <X className="h-4 w-4" /> Fechar
                </button>
              </div>
              {listaDrill.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada por aqui.</p>
              ) : "cuidado" in drill && drill.cuidado === "Terapia" ? (
                Object.entries(
                  listaDrill.reduce<Record<string, Item[]>>((acc, i) => {
                    const k = i.tipoTerapia || "Sem tipo";
                    (acc[k] ||= []).push(i);
                    return acc;
                  }, {}),
                ).map(([tipo, lista]) => (
                  <div key={tipo} className="space-y-2">
                    <p className="text-sm font-bold text-gold">🌿 {tipo} ({lista.length})</p>
                    {lista.map((i) => <Linha key={i.id} i={i} onClick={() => setAberto(i)} />)}
                  </div>
                ))
              ) : (
                listaDrill.map((i) => <Linha key={i.id} i={i} onClick={() => setAberto(i)} />)
              )}
            </section>
          )}

          <Divisor />

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Próximos compromissos</h2>
            {proximos.length === 0 ? (
              <p className="notebook p-4 text-sm text-muted-foreground">Nenhum compromisso agendado.</p>
            ) : (
              proximos.map((i) => <Linha key={i.id} i={i} onClick={() => setAberto(i)} />)
            )}
          </section>
        </>
      )}

      {aberto && <Detalhes item={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}

function Linha({ i, onClick }: { i: Item; onClick: () => void }) {
  const quando = i.cuidado === "Medicação"
    ? [i.inicio && `desde ${formatData(i.inicio)}`, i.fim ? `até ${formatData(i.fim)}` : "uso contínuo"].filter(Boolean).join(" ")
    : [formatData(i.data), i.hora].filter(Boolean).join(" · ");
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-gold/30 bg-card p-3 text-left shadow-soft">
      <span className="text-3xl">{i.cuidado ? EMOJI[i.cuidado] : "📌"}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{i.titulo}</p>
        {subtitulo(i) && <p className="truncate text-sm text-muted-foreground">{subtitulo(i)}</p>}
        <p className="text-xs text-accent">{quando}</p>
      </div>
      {i.cuidado !== "Medicação" && <Selo s={i.situacao} />}
    </button>
  );
}

function Detalhes({ item, onClose }: { item: Item; onClose: () => void }) {
  const { salvarRegistros } = useApp();
  const emAberto = !!item.cuidado && (item.situacao ?? "proximo") === "proximo" && item.cuidado !== "Medicação";
  const [sit, setSit] = useState<Situacao | null>(null);
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!sit) { toast.error("Escolha o que aconteceu."); return; }
    setSalvando(true);
    const ok = await salvarRegistros([
      {
        id: uid(),
        pessoaId: item.pessoaId,
        criadoEm: nowLocalISO(),
        titulo: tituloEvento(item, sit),
        cuidado: item.cuidado,
        situacao: sit,
        observacaoAcompanhamento: nota,
        evento: true,
        parentId: item.id,
      },
    ]);
    setSalvando(false);
    if (ok) {
      toast.success("Acompanhamento registrado!");
      onClose();
    }
  };

  const linhas: [string, string | undefined][] = [
    ["Data", formatData(item.data)], ["Hora", item.hora], ["Local", item.local],
    ["Profissional", item.profissional], ["Especialidade", item.especialidade],
    ["Tipo de terapia", item.tipoTerapia], ["Tipo de exame", item.tipoExame],
    ["Recomendações", item.recomendacoes], ["Medicamento", item.medicamento],
    ["Dosagem", item.dosagem], ["Horário(s)", item.frequencia],
    ["Início", formatData(item.inicio)], ["Fim", item.cuidado === "Medicação" ? (item.fim ? formatData(item.fim) : "Uso contínuo") : undefined],
    ["Anotações", item.observacaoAcompanhamento],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-3 sm:items-center" onClick={onClose}>
      <div className="notebook max-h-[85vh] w-full max-w-md overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="text-4xl">{item.cuidado ? EMOJI[item.cuidado] : "📌"}</span>
          <div className="flex-1">
            <h3 className="text-xl font-semibold">{item.titulo}</h3>
            {item.cuidado !== "Medicação" && <Selo s={item.situacao} />}
          </div>
        </div>
        <dl className="mt-4 space-y-1.5 text-sm">
          {linhas.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-28 shrink-0 text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {emAberto ? (
          <>
            <Divisor />
            <p className="font-display text-lg font-semibold italic">O que aconteceu?</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["feito", "faltou", "cancelado"] as Situacao[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSit(s)}
                  className={`rounded-xl py-2 text-sm font-semibold ${sit === s ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {s === "feito" ? "Compareceu" : s === "faltou" ? "Faltou" : "Cancelou"}
                </button>
              ))}
            </div>
            <textarea className="field mt-3 min-h-24" placeholder="Anotações" value={nota} onChange={(e) => setNota(e.target.value)} />
            <div className="mt-4 flex gap-2">
              <Botao variant="outline" className="flex-1" onClick={onClose}>Cancelar</Botao>
              <Botao className="flex-1" disabled={salvando} onClick={salvar}>Salvar</Botao>
            </div>
          </>
        ) : (
          <Botao className="mt-5 w-full" onClick={onClose}>Fechar</Botao>
        )}
      </div>
    </div>
  );
}
