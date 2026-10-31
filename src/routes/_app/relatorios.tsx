import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer, Activity, Pill, FileText } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { formatData, hojeYMD, type Dados } from "@/lib/cuidados";
import { Botao } from "@/components/ui-kit";

export const Route = createFileRoute("/_app/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios · horaMed" }] }),
  component: Relatorios,
});

function Relatorios() {
  const { itens, logs, ativa, pessoas } = useApp();
  const hoje = hojeYMD();

  // Filtrar dados
  const medsEmUso = itens.filter(i => i.cuidado === "Medicação" && (!i.fim || i.fim >= hoje));
  const sinaisVitais = itens.filter(i => i.cuidado === "Pressão" || i.cuidado === "Glicose").sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  const compromissos = itens.filter(i => i.cuidado === "Consulta" || i.cuidado === "Exame").sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const imprimir = () => {
    window.print();
  };

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
        <h1 className="text-2xl font-bold text-[#2C4A6B]">Relatório de Saúde - horaMed</h1>
        <p className="text-sm text-muted-foreground">Paciente: {ativa?.nome}</p>
        <p className="text-xs text-muted-foreground">Gerado em {formatData(hoje)}</p>
      </div>

      {/* Seção de Medicações */}
      <section className="mb-8 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#2C4A6B] border-b pb-1">
          <Pill className="h-5 w-5 text-[#5B92C7]" /> Medicações em Uso
        </h2>
        {medsEmUso.length === 0 ? <p className="text-sm italic text-muted-foreground">Nenhuma medicação em uso.</p> : (
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

      {/* Seção de Sinais Vitais */}
      <section className="mb-8 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#2C4A6B] border-b pb-1">
          <Activity className="h-5 w-5 text-[#5B92C7]" /> Histórico de Pressão e Glicose
        </h2>
        {sinaisVitais.length === 0 ? <p className="text-sm italic text-muted-foreground">Nenhuma medição registrada.</p> : (
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

      {/* Seção de Consultas e Exames */}
      <section className="mb-8 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[#2C4A6B] border-b pb-1">
          <FileText className="h-5 w-5 text-[#5B92C7]" /> Consultas e Exames
        </h2>
        {compromissos.length === 0 ? <p className="text-sm italic text-muted-foreground">Nenhum compromisso registrado.</p> : (
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