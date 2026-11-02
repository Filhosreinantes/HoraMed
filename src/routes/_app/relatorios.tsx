import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer, Activity, Pill, FileText, HeartPulse, History } from "lucide-react";
import { useState, useMemo } from "react";
import { useApp } from "@/lib/app-store";
import { formatData, hojeYMD, type Situacao } from "@/lib/cuidados";

export const Route = createFileRoute("/_app/relatorios")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tipo: (search.tipo as string) || "tudo",
      filtros: (search.filtros as string) || "{}",
    };
  },
  head: () => ({ meta: [{ title: "Relatórios · HoraMed" }] }),
  component: Relatorios,
});

type FiltroSecao = { q?: string; dataInicio?: string; dataFim?: string; situacao?: string };

function Relatorios() {
  const { tipo, filtros: filtrosJson } = Route.useSearch();
  const { itens, logs, ativa } = useApp();
  const hoje = hojeYMD();

  const filtrosIniciais = useMemo(() => JSON.parse(filtrosJson) as Record<string, FiltroSecao>, [filtrosJson]);
  const [filtros, setFiltros] = useState<Record<string, FiltroSecao>>(filtrosIniciais);

  const atualizarFiltro = (secao: string, campo: keyof FiltroSecao, valor: string) => {
    setFiltros(prev => ({
      ...prev,
      [secao]: { ...prev[secao], [campo]: valor }
    }));
  };

  // --- FILTROS BASE ---
  let historicoDoses = logs.filter(l => 
    (l.cuidado as string) === "Medicação_Log" || 
    ((l.cuidado as string) === "Medicação" && l.evento === true && !l.acao)
  ).sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));

  // ✅ Suporte a medicamentos encerrados
  let medsEmUso = itens.filter(i => i.cuidado === "Medicação" && (!i.fim || i.fim >= hoje));
  if (tipo === "medicamentos_encerrados") {
    medsEmUso = itens.filter(i => i.cuidado === "Medicação" && i.fim && i.fim < hoje);
  }

  let sinaisVitais = itens.filter(i => i.cuidado === "Pressão" || i.cuidado === "Glicose").sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  let compromissos = itens.filter(i => i.cuidado === "Consulta" || i.cuidado === "Exame").sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const aplicarFiltros = (lista: any[], secao: string) => {
    const f = filtros[secao] || {};
    let resultado = [...lista];
    
    if (f.q) {
      const termo = f.q.toLowerCase();
      resultado = resultado.filter(item => {
        const texto = `${item.titulo || ""} ${item.medicamento || ""} ${item.local || ""} ${item.profissional || ""} ${item.tratamento || ""} ${item.detalhes || ""}`.toLowerCase();
        return texto.includes(termo);
      });
    }
    
    if (f.dataInicio) {
      resultado = resultado.filter(item => {
        const data = item.data || item.inicio || item.criadoEm?.slice(0, 10);
        return data && data >= f.dataInicio!;
      });
    }
    
    if (f.dataFim) {
      resultado = resultado.filter(item => {
        const data = item.data || item.inicio || item.criadoEm?.slice(0, 10);
        return data && data <= f.dataFim!;
      });
    }
    
    if (f.situacao) {
      resultado = resultado.filter(item => (item.situacao ?? "proximo") === f.situacao);
    }
    
    return resultado;
  };

  medsEmUso = aplicarFiltros(medsEmUso, "medicamentos");
  sinaisVitais = aplicarFiltros(sinaisVitais, "sinais");
  compromissos = aplicarFiltros(compromissos, "compromissos");
  historicoDoses = aplicarFiltros(historicoDoses, "historico_doses");

  const tratamentosUnicos = Array.from(new Set(
    itens.filter(i => i.cuidado === "Medicação" && i.tratamento).map(i => i.tratamento)
  )) as string[];

  const tratamentosFiltrados = tratamentosUnicos.filter(t => {
    const f = filtros["tratamentos"] || {};
    if (f.q) return t.toLowerCase().includes(f.q.toLowerCase());
    return true;
  });

  const mostraTudo = tipo === "tudo";
  const imprimir = () => window.print();

  // ✅ Título dinâmico para a seção de medicamentos
  const tituloMeds = tipo === "medicamentos_encerrados" ? "Medicações Encerradas" : "Medicações em Uso";

  const renderHeader = (titulo: string, Icone: any) => (
    <div className="flex items-center gap-2 mb-2 mt-6">
      <Icone className="h-5 w-5 text-[#5B92C7]" />
      <h2 className="text-lg font-bold text-[#2C4A6B] border-b pb-1 flex-1">{titulo}</h2>
    </div>
  );

  const labelStatus = (s?: Situacao) => {
    if (s === "feito") return "Compareceu";
    if (s === "faltou") return "Faltou";
    if (s === "cancelado") return "Cancelou";
    return "Próximo";
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
        <h1 className="text-2xl font-bold text-[#2C4A6B]">Relatório de Saúde - HoraMed</h1>
        <p className="text-sm text-muted-foreground">Paciente: {ativa?.nome}</p>
        <p className="text-xs text-muted-foreground">Gerado em {formatData(hoje)}</p>
      </div>

      {/* ✅ Bloco de Filtros por seção */}
      {mostraTudo && (
        <div className="notebook p-4 mb-4 space-y-4 print:hidden">
          <p className="text-sm font-bold text-[#2C4A6B]">Refine o Relatório Geral</p>
          
          {/* Filtro de Medicamentos */}
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Medicamentos</p>
            <input type="text" placeholder="Buscar remédio..." className="field text-sm p-2 w-full mb-2" 
              value={filtros["medicamentos"]?.q || ""} 
              onChange={(e) => atualizarFiltro("medicamentos", "q", e.target.value)} 
            />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="field text-sm p-2" 
                value={filtros["medicamentos"]?.dataInicio || ""} 
                onChange={(e) => atualizarFiltro("medicamentos", "dataInicio", e.target.value)} 
              />
              <input type="date" className="field text-sm p-2" 
                value={filtros["medicamentos"]?.dataFim || ""} 
                onChange={(e) => atualizarFiltro("medicamentos", "dataFim", e.target.value)} 
              />
            </div>
          </div>

          {/* Filtro de Consultas e Exames */}
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Consultas e Exames</p>
            <input type="text" placeholder="Buscar consulta..." className="field text-sm p-2 w-full mb-2" 
              value={filtros["compromissos"]?.q || ""} 
              onChange={(e) => atualizarFiltro("compromissos", "q", e.target.value)} 
            />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input type="date" className="field text-sm p-2" 
                value={filtros["compromissos"]?.dataInicio || ""} 
                onChange={(e) => atualizarFiltro("compromissos", "dataInicio", e.target.value)} 
              />
              <input type="date" className="field text-sm p-2" 
                value={filtros["compromissos"]?.dataFim || ""} 
                onChange={(e) => atualizarFiltro("compromissos", "dataFim", e.target.value)} 
              />
            </div>
            <select className="field text-sm p-2 w-full"
              value={filtros["compromissos"]?.situacao || ""}
              onChange={(e) => atualizarFiltro("compromissos", "situacao", e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="proximo">Próximos</option>
              <option value="feito">Compareceu</option>
              <option value="faltou">Faltou</option>
              <option value="cancelado">Cancelou</option>
            </select>
          </div>

          {/* Filtro de Pressão e Glicose */}
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Pressão e Glicose</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="field text-sm p-2" 
                value={filtros["sinais"]?.dataInicio || ""} 
                onChange={(e) => atualizarFiltro("sinais", "dataInicio", e.target.value)} 
              />
              <input type="date" className="field text-sm p-2" 
                value={filtros["sinais"]?.dataFim || ""} 
                onChange={(e) => atualizarFiltro("sinais", "dataFim", e.target.value)} 
              />
            </div>
          </div>

          {/* Filtro de Histórico de Doses */}
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Histórico de Doses</p>
            <input type="text" placeholder="Buscar dose..." className="field text-sm p-2 w-full mb-2" 
              value={filtros["historico_doses"]?.q || ""} 
              onChange={(e) => atualizarFiltro("historico_doses", "q", e.target.value)} 
            />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="field text-sm p-2" 
                value={filtros["historico_doses"]?.dataInicio || ""} 
                onChange={(e) => atualizarFiltro("historico_doses", "dataInicio", e.target.value)} 
              />
              <input type="date" className="field text-sm p-2" 
                value={filtros["historico_doses"]?.dataFim || ""} 
                onChange={(e) => atualizarFiltro("historico_doses", "dataFim", e.target.value)} 
              />
            </div>
          </div>

          {/* Filtro de Tratamentos */}
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Tratamentos</p>
            <input type="text" placeholder="Buscar tratamento..." className="field text-sm p-2 w-full" 
              value={filtros["tratamentos"]?.q || ""} 
              onChange={(e) => atualizarFiltro("tratamentos", "q", e.target.value)} 
            />
          </div>
        </div>
      )}

      <div className="px-4 print:px-0">
        {/* ✅ Seção de Medicamentos (com título dinâmico) */}
        {(mostraTudo || tipo === "medicamentos" || tipo === "medicamentos_encerrados") && (
          <section className="mb-8">
            {renderHeader(tituloMeds, Pill)}
            {medsEmUso.length === 0 ? <p className="text-sm italic text-muted-foreground">Nenhuma medicação encontrada.</p> : (
              <ul className="space-y-3">
                {medsEmUso.map(m => (
                  <li key={m.id} className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                    <div className="flex justify-between items-start border-b border-gray-100 pb-2 mb-2">
                      <p className="font-bold text-lg text-foreground">{m.medicamento}</p>
                      <span className="text-xs font-bold text-[#5B92C7] bg-[#E8F1F9] px-2 py-0.5 rounded-full">{m.dosagem}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      {m.profissional && <p><strong className="text-foreground">Médico:</strong> {m.profissional}</p>}
                      {m.especialidade && <p><strong className="text-foreground">Especialidade:</strong> {m.especialidade}</p>}
                      {m.tratamento && <p className="col-span-2"><strong className="text-foreground">Tratamento:</strong> {m.tratamento}</p>}
                      <p><strong className="text-foreground">Início:</strong> {formatData(m.inicio)}</p>
                      <p><strong className="text-foreground">Fim:</strong> {m.fim ? formatData(m.fim) : "Uso contínuo"}</p>
                      <p className="col-span-2"><strong className="text-foreground">Horários:</strong> {m.horarios?.join(", ")}</p>
                      <p><strong className="text-foreground">Estoque:</strong> {m.estoqueAtual || 0} {m.dosagemUnidade || "un"}</p>
                      {m.detalhes && <p className="col-span-2"><strong className="text-foreground">Observações:</strong> {m.detalhes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Seção de Histórico de Doses */}
        {(mostraTudo || tipo === "historico_doses") && (
          <section className="mb-8">
            {renderHeader("Histórico de Doses", History)}
            {historicoDoses.length === 0 ? <p className="text-sm italic text-muted-foreground">Nenhuma dose registrada no período.</p> : (
              <ul className="space-y-2">
                {historicoDoses.map(d => (
                  <li key={d.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm flex justify-between items-start">
                    <p className="font-bold text-foreground">{d.titulo}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatData(d.data)} {d.criadoEm?.slice(11, 16)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Seção de Pressão e Glicose */}
        {(mostraTudo || tipo === "sinais") && (
          <section className="mb-8">
            {renderHeader("Pressão e Glicose", Activity)}
            {sinaisVitais.length === 0 ? <p className="text-sm italic text-muted-foreground">Nenhuma medição encontrada.</p> : (
              <ul className="space-y-2">
                {sinaisVitais.map(s => (
                  <li key={s.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
                    <p className="font-bold text-[#2C4A6B] uppercase tracking-wide text-xs mb-1">{s.cuidado}</p>
                    <p className="font-bold text-foreground">{s.titulo}</p>
                    {s.detalhes && <p className="text-muted-foreground text-xs">{s.detalhes}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{formatData(s.data)} {s.hora}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Seção de Compromissos */}
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
                      <p className="text-xs font-bold mt-1 text-[#5B92C7]">{labelStatus(c.situacao)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatData(c.data)} {c.hora}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Seção de Tratamentos */}
        {(mostraTudo || tipo === "tratamentos") && (
          <section className="mb-8">
            {renderHeader("Histórico de Tratamentos", HeartPulse)}
            {tratamentosFiltrados.length === 0 ? <p className="text-sm italic text-muted-foreground">Nenhum tratamento registrado.</p> : (
              <div className="space-y-3">
                {tratamentosFiltrados.map(tratamento => (
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
          
          nav, .fixed, .print\\:hidden { display: none !important; }
          
          body > div, #root { padding: 0 !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}