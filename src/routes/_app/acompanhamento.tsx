import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useApp } from "@/lib/app-store";
import {
  EMOJI, hojeYMD, medicacaoEmUso, ordenarPorDataHora, compromissoPendente,
  type Cuidado, type Situacao,
} from "@/lib/cuidados";
import { Botao, Divisor, Pill, SeletorTesouro } from "@/components/ui-kit";
import { CompromissoCard } from "@/components/compromisso-card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/acompanhamento")({
  head: () => ({
    meta: [
      { title: "Acompanhamento · Rotina Azul" },
      { name: "description", content: "Panorama de consultas, terapias, exames e medicações." },
      { property: "og:title", content: "Acompanhamento · Rotina Azul" },
      { property: "og:description", content: "Panorama da rotina de cuidados do seu Tesouro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

  const filtrados = useMemo(() => {
    const hoje = hojeYMD();
    return itens.filter((i) => {
      if (periodo === "tudo") return true;
      const d = i.data || i.inicio || "";
      return periodo === "mes" ? d.slice(0, 7) === hoje.slice(0, 7) : d.slice(0, 4) === hoje.slice(0, 4);
    });
  }, [itens, periodo]);

  const meds = itens.filter((i) => i.cuidado === "Medicação");
  const emUso = ordenarPorDataHora(meds.filter((m) => medicacaoEmUso(m)));
  const encerradas = ordenarPorDataHora(meds.filter((m) => !medicacaoEmUso(m)));
  const proximos = ordenarPorDataHora(itens.filter((i) => compromissoPendente(i)));

  const listaDrill = ordenarPorDataHora(!drill
    ? []
    : "med" in drill
      ? drill.med === "uso" ? emUso : encerradas
      : filtrados.filter((i) => i.cuidado === drill.cuidado && (i.situacao ?? "proximo") === drill.situacao));

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
                          <Botao variant="ghost"
                            key={s}
                            onClick={() => setDrill({ cuidado: c, situacao: s })}
                            className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${ativo ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                          >
                            <span>{label}</span>
                            <strong>{n}</strong>
                          </Botao>
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
              <Botao variant="ghost" onClick={() => setDrill({ med: "uso" })} className="notebook p-4 text-left">
                <p className="text-sm text-muted-foreground">Em uso</p>
                <p className="font-display text-3xl font-bold text-accent">{emUso.length}</p>
              </Botao>
              <Botao variant="ghost" onClick={() => setDrill({ med: "encerradas" })} className="notebook p-4 text-left">
                <p className="text-sm text-muted-foreground">Encerradas</p>
                <p className="font-display text-3xl font-bold text-gold">{encerradas.length}</p>
              </Botao>
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
                <Botao variant="ghost" onClick={() => setDrill(null)} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm font-semibold">
                  <X className="h-4 w-4" /> Fechar
                </Botao>
              </div>
              {listaDrill.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada por aqui.</p>
              ) : (
                listaDrill.map((i) => <CompromissoCard key={i.id} item={i} />)
              )}
            </section>
          )}

          <Divisor />

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Próximos compromissos</h2>
            {proximos.length === 0 ? (
              <p className="notebook p-4 text-sm text-muted-foreground">Nenhum compromisso agendado.</p>
            ) : (
              <div className="max-h-[400px] space-y-2 overflow-y-auto">
                {proximos.map((i) => <CompromissoCard key={i.id} item={i} />)}
              </div>
            )}
          </section>
        </>
      )}

    </div>
  );
}
