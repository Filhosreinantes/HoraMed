import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer, Activity, Pill, FileText, HeartPulse } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { formatData, hojeYMD } from "@/lib/cuidados";

export const Route = createFileRoute("/_app/relatorios")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tipo: (search.tipo as string) || "tudo",
      q: (search.q as string) || "", // Filtro de busca
    };
  },
  head: () => ({ meta: [{ title: "Relatórios · HoraMed" }] }),
  component: Relatorios,
});

function Relatorios() {
  const { tipo, q } = Route.useSearch();
  const { itens, ativa } = useApp();
  const hoje = hojeYMD();

  // Filtros básicos
  let medsEmUso = itens.filter(i => i.cuidado === "Medicação" && (!i.fim || i.fim >= hoje));
  let sinaisVitais = itens.filter(i => i.cuidado === "Pressão" || i.cuidado === "Glicose").sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  let compromissos = itens.filter(i => i.cuidado === "Consulta" || i.cuidado === "Exame").sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  // ✅ Aplicar busca de texto, se houver
  if (q) {
    const termo = q.toLowerCase();
    medsEmUso = medsEmUso.filter(i => (i.medicamento || i.titulo || "").toLowerCase().includes(termo) || (i.tratamento || "").toLowerCase().includes(termo));
    sinaisVitais = sinaisVitais.filter(i => (i.titulo || "").toLowerCase().includes(termo) || (i.detalhes || "").toLowerCase().includes(termo));
    compromissos = compromissos.filter(i => (i.titulo || "").toLowerCase().includes(termo) || (i.local || "").toLowerCase().includes(termo));
  }
  
  const tratamentosUnicos = Array.from(new Set(
    itens.filter(i => i.cuidado === "Medicação" && i.tratamento).map(i => i.tratamento)
  )) as string[];

  const mostraTudo = tipo === "tudo";
  const imprimir = () => window.print();

  const renderHeader = (titulo: string, Icone: any) => (
    <div className="flex items-center gap-2 mb-2 mt-6">
      <Icone className="h-5 w-5 text-[#5B92C7]" />
      <h2 className="text-lg font-bold text-[#2C4A6B] border-b pb-1 flex-1">{titulo}</h2>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-lg pb-20 pt-2">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link to="/acompanhamento" className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <button onClick={imprimir} className="flex items-center gap-2 rounded-full bg-[#5B92C7] px-4 py-2 text-sm font-bold text-white shadow-md">
          <Printer className="h-4 w-4" /> Baixar PDF
        </button>
      </div>

      <div className="hidden print:block mb-6 text-center">
        <h1 className="text-2xl font-bold text-[#2C4A6B]">Relatório de Saúde - HoraMed</h1>
        <p className="text-sm text-muted-foreground">Paciente: {ativa?.nome}</p>
        <p className="text-xs text-muted-foreground">Gerado em {formatData(hoje)}</p>
        {q && <p className="text-xs text-muted-foreground">Filtro de busca: "{q}"</p>}
      </div>

      <div className="px-4 print:px-0">
        {(mostraTudo || tipo === "medicamentos") && (
          <section className="mb-8">
            {renderHeader("Medicações em Uso", Pill)}
            {medsEmUso.length === 0 ? <p className="text-sm italic text-muted-foreground">Nenhuma medicação encontrada.</p> : (
              <ul className="space-y-2">
                {medsEmUso.map(m => (
                  <li key={m.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
                    <p className="font-bold text-foreground">{m.medicamento} {m.dosagem && `- ${m.dosagem}`}</p>
                    <p className="text-muted-foreground">Horários: {m.horarios?.join(", ")}</p>
                    <p className="text-muted-foreground">Início: {formatData(m.inicio)} {m.fim ? `| Fim: ${formatData(m.fim)}` : "(Uso contínuo)"}</p>
                    {m.tratamento && <p className="text-[#2C4A6B] font-medium mt-1">Tratamento: {m.tratamento}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {(mostraTudo || tipo === "sinais") && (
          <section className="mb-8">
            {renderHeader("Pressão e Glicose", Activity)}
            {sinaisVitais.length === 0 ? <p className="text-sm italic text-muted-foreground">Nenhuma medição encontrada.</p> : (
              <ul className="space-y-2">
                {sinaisVitais.map(s => (
                  <li key={s.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm flex justify-between items-start">
                    <div>
                      <p className="font-bold text-foreground">{s.titulo}</p>
                      {s.detalhes && <p className="text-muted-foreground text-xs">{s.detalhes}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatData(s.data)} {s.hora}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {(mostraTudo || tipo === "compromissos") && (
          <section className="mb-8">
            {renderHeader("Consultas e Exames", FileText)}
            {compromissos.length === 0 ? <p className="text-sm italic text-muted-foreground">Nenhum compromisso encontrado.</p> : (
              <ul className="space-y-2">
                {compromissos.map(c => (
                  <li key={c.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm flex justify-between items-start">
                    <div>
                      <p className="font-bold text-foreground">{c.titulo}</p>
                      <p className="text-muted-foreground">{c.local || "Local não informado"} | {c.profissional || "Profissional não informado"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatData(c.data)} {c.hora}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {(mostraTudo || tipo === "tratamentos") && (
          <section className="mb-8">
            {renderHeader("Histórico de Tratamentos", HeartPulse)}
            {tratamentosUnicos.length === 0 ? <p className="text-sm italic text-muted-foreground">Nenhum tratamento registrado.</p> : (
              <div className="space-y-3">
                {tratamentosUnicos.map(tratamento => (
                  <div key={tratamento} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
                    <h3 className="font-bold text-[#2C4A6B] mb-1">{tratamento}</h3>
                    <ul className="space-y-1">
                      {itens.filter(i => i.cuidado === "Medicação" && i.tratamento === tratamento).map(m => (
                        <li key={m.id} className="text-muted-foreground">
                          • {m.medicamento} ({m.dosagem}) - {formatData(m.inicio)} {m.fim ? `a ${formatData(m.fim)}` : "(contínuo)"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          main { padding: 0 !important; }
          section { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}