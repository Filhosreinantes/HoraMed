import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useApp } from "@/lib/app-store";
import {
  EMOJI, hojeYMD, medicacaoEmUso, ordenarPorDataHora, compromissoPendente, resolverSituacoes,
  type Cuidado
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
  const { carregando, registros } = useApp();
  const [filtro, setFiltro] = useState<"mes" | "ano" | "tudo">("mes");
  const [drillDown, setDrillDown] = useState<{ tipo: Cuidado; filtro: string } | null>(null);

  const hoje = hojeYMD();

  // Resolve as situações (mescla eventos com o item original)
  const resolvidos = useMemo(() => resolverSituacoes(registros), [registros]);

  const filtrados = resolvidos.filter((item) => {
    if (item.evento) return false;
    if (filtro === "mes") return item.data?.startsWith(hoje.slice(0, 7)) || item.inicio?.startsWith(hoje.slice(0, 7));
    if (filtro === "ano") return item.data?.startsWith(hoje.slice(0, 4)) || item.inicio?.startsWith(hoje.slice(0, 4));
    return true;
  });

  const pendentes = resolvidos
    .filter((item) => {
      if (item.evento) return false;
      return compromissoPendente(item, hoje);
    })
    .sort((a, b) => ordenarPorDataHora([a, b])[0]?.id === a.id ? -1 : 1);

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

  const medicacoes = filtrados.filter((a) => a.cuidado === "Medicação");
  const medsEmUso = medicacoes.filter((m) => medicacaoEmUso(m, hoje));
  const medsEncerradas = medicacoes.filter((m) => !medicacaoEmUso(m, hoje));

  const CardContagem = ({ tipo }: { tipo: Cuidado }) => {
    const c = contarPor(tipo);
    const Btn = ({ chave, rotulo, emoji, qtd }: any) => (
      <button onClick={() => setDrillDown({ tipo, filtro: chave })} className="flex items-center gap-1.5 rounded-lg bg-[#F8FAFC] px-2 py-1 text-[0.68rem] hover:bg-gray-100">
        <span>{emoji}</span> <span className="flex-1 text-left text-[#7A8A9A]">{rotulo}</span> <span className="font-bold">{qtd}</span>
      </button>
    );

    return (
      <div className="rounded-2xl border border-gold/30 bg-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[0.95rem]">{EMOJI[tipo]}</span>
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider">{tipo}</p>
          <span className="ml-auto font-bold">{c.total}</span>
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
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="pb-24 space-y-4">
      <header className="px-4 pt-6">
        <h1 className="font-display text-2xl font-semibold italic text-foreground">Acompanhamento</h1>
        <p className="text-sm text-muted-foreground mt-1">Sua agenda de cuidados num só lugar.</p>
        <div className="mt-4"><SeletorTesouro /></div>
      </header>

      <section className="px-4">
        <div className="flex gap-2">
          {FILTROS.map((f) => (
            <Botao key={f.chave} variant={filtro === f.chave ? "default" : "outline"} onClick={() => { setFiltro(f.chave); setDrillDown(null); }} className="flex-1 rounded-full text-xs h-9">
              {f.rotulo}
            </Botao>
          ))}
        </div>
      </section>

      <Divisor />

      <section className="px-4">
        <p className="mb-2 text-[0.65rem] font-bold tracking-widest uppercase text-muted-foreground">🩺 Cuidados médicos</p>
        <div className="grid grid-cols-2 gap-2">
          <CardContagem tipo="Consulta" />
          <CardContagem tipo="Terapia" />
          <CardContagem tipo="Exame" />
        </div>
      </section>

      {drillDown && (
        <section className="px-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-foreground">{drillDown.tipo} · {drillDown.filtro}</h2>
            <Botao variant="ghost" onClick={() => setDrillDown(null)} className="text-xs h-8 px-2 text-muted-foreground"><X className="h-4 w-4 mr-1"/> Fechar</Botao>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {getListaDrill().length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Nenhum registro nesta categoria.</p>
            ) : (
              getListaDrill().map((item) => <CompromissoCard key={item.id} item={item} />)
            )}
          </div>
        </section>
      )}

      {!drillDown && pendentes.length > 0 && (
        <section className="px-4">
          <h2 className="text-lg font-semibold italic text-foreground mb-3">Próximos compromissos</h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {pendentes.map((item) => <CompromissoCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {!drillDown && (medsEmUso.length > 0 || medsEncerradas.length > 0) && (
        <section className="px-4">
          <div className="flex items-center gap-2 mb-3">
            <Pill className="h-5 w-5 text-rose-500" />
            <h2 className="text-lg font-semibold italic text-foreground">Medicações</h2>
          </div>
          {medsEmUso.length > 0 && (
            <>
              <p className="mb-2 text-[0.68rem] font-bold tracking-widest uppercase text-muted-foreground">Em uso · {medsEmUso.length}</p>
              <div className="space-y-2 mb-4">{medsEmUso.map((m) => <CompromissoCard key={m.id} item={m} />)}</div>
            </>
          )}
          {medsEncerradas.length > 0 && (
            <>
              <p className="mb-2 text-[0.68rem] font-bold tracking-widest uppercase text-muted-foreground">Encerradas · {medsEncerradas.length}</p>
              <div className="space-y-2 opacity-70">{medsEncerradas.map((m) => <CompromissoCard key={m.id} item={m} />)}</div>
            </>
          )}
        </section>
      )}
    </div>
  );
}