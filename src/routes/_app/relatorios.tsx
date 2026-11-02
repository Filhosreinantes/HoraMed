import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer, Activity, Pill, FileText, HeartPulse, History, Check } from "lucide-react";
import { useState, useMemo } from "react";
import { useApp } from "@/lib/app-store";
import { formatData, hojeYMD, type Situacao } from "@/lib/cuidados";

export const Route = createFileRoute("/_app/relatorios")({
  validateSearch: (search: Record<string, unknown>) => ({
    tipo: (search.tipo as string) || "tudo",
    filtros: (search.filtros as string) || "{}",
  }),
  head: () => ({ meta: [{ title: "Relatórios · HoraMed" }] }),
  component: Relatorios,
});

type FiltrosPorSecao = {
  medicamentos: { emUso: boolean; encerrados: boolean; dataInicio: string; dataFim: string };
  compromissos: { consulta: boolean; exame: boolean; situacao: string; tipo: string; dataInicio: string; dataFim: string };
  sinais: { pressao: boolean; glicose: boolean; dataInicio: string; dataFim: string };
  historico_doses: { medicamento: string; dataInicio: string; dataFim: string };
  tratamentos: { tratamento: string; dataInicio: string; dataFim: string };
};

const PADRAO: FiltrosPorSecao = {
  medicamentos: { emUso: true, encerrados: false, dataInicio: "", dataFim: "" },
  compromissos: { consulta: true, exame: true, situacao: "", tipo: "", dataInicio: "", dataFim: "" },
  sinais: { pressao: true, glicose: true, dataInicio: "", dataFim: "" },
  historico_doses: { medicamento: "", dataInicio: "", dataFim: "" },
  tratamentos: { tratamento: "", dataInicio: "", dataFim: "" },
};

const SECOES_INFO = [
  { chave: "medicamentos", titulo: "Medicamentos", icone: Pill },
  { chave: "compromissos", titulo: "Consultas e Exames", icone: FileText },
  { chave: "sinais", titulo: "Pressão e Glicose", icone: Activity },
  { chave: "historico_doses", titulo: "Histórico de Doses", icone: History },
  { chave: "tratamentos", titulo: "Tratamentos", icone: HeartPulse },
] as const;

function Relatorios() {
  const { tipo, filtros: filtrosJson } = Route.useSearch();
  const { itens, logs, ativa } = useApp();
  const hoje = hojeYMD();

  const filtrosIniciais = useMemo(() => {
    const parsed = JSON.parse(filtrosJson);
    const result: FiltrosPorSecao = JSON.parse(JSON.stringify(PADRAO));
    for (const secao of Object.keys(parsed)) {
      const f = parsed[secao];
      if (!result[secao as keyof FiltrosPorSecao]) continue;
      
      if (f.q) {
        if (secao === "compromissos") {
          if (f.q === "Consulta") { result.compromissos.consulta = true; result.compromissos.exame = false; }
          else if (f.q === "Exame") { result.compromissos.consulta = false; result.compromissos.exame = true; }
        } else if (secao === "sinais") {
          if (f.q === "Pressão") { result.sinais.pressao = true; result.sinais.glicose = false; }
          else if (f.q === "Glicose") { result.sinais.pressao = false; result.sinais.glicose = true; }
        } else if (secao === "historico_doses") {
          result.historico_doses.medicamento = f.q;
        } else if (secao === "tratamentos") {
          result.tratamentos.tratamento = f.q;
        }
      }
      
      if (f.dataInicio) (result as any)[secao].dataInicio = f.dataInicio;
      if (f.dataFim) (result as any)[secao].dataFim = f.dataFim;
      if (f.situacao) (result as any)[secao].situacao = f.situacao;
    }
    return result;
  }, [filtrosJson]);

  const [secoes, setSecoes] = useState<Set<string>>(
    () => tipo === "tudo" ? new Set() : new Set([tipo])
  );
  const [filtros, setFiltros] = useState<FiltrosPorSecao>(filtrosIniciais);

  const toggleSecao = (chave: string) => {
    setSecoes(prev => {
      const nova = new Set(prev);
      nova.has(chave) ? nova.delete(chave) : nova.add(chave);
      return nova;
    });
  };

  const atualizarFiltro = <K extends keyof FiltrosPorSecao>(
    secao: K, campo: keyof FiltrosPorSecao[K], valor: any
  ) => {
    setFiltros(prev => ({ ...prev, [secao]: { ...prev[secao], [campo]: valor } }));
  };

  const tiposConsulta = useMemo(() => Array.from(new Set(
    itens.filter(i => i.cuidado === "Consulta" && i.especialidade).map(i => i.especialidade!)
  )), [itens]);
  const tiposExame = useMemo(() => Array.from(new Set(
    itens.filter(i => i.cuidado === "Exame" && i.tipoExame).map(i => i.tipoExame!)
  )), [itens]);
  const nomesMedicamentos = useMemo(() => Array.from(new Set(
    itens.filter(i => i.cuidado === "Medicação" && i.medicamento).map(i => i.medicamento!)
  )), [itens]);
  const tratamentosUnicos = useMemo(() => Array.from(new Set(
    itens.filter(i => i.cuidado === "Medicação" && i.tratamento).map(i => i.tratamento!)
  )), [itens]);

  // ✅ GERAÇÃO DOS DADOS FILTRADOS
  const dados = useMemo(() => {
    const r: any = { medsEmUso: [], medsEncerrados: [], compromissos: [], pressao: [], glicose: [], historico: [], tratamentos: [] };
    const dentro = (data?: string, ini?: string, fim?: string) => {
      if (!data) return !ini && !fim;
      if (ini && data < ini) return false;
      if (fim && data > fim) return false;
      return true;
    };

    if (secoes.has("medicamentos")) {
      const f = filtros.medicamentos;
      let m = itens.filter(i => i.cuidado === "Medicação");
      if (f.dataInicio || f.dataFim) m = m.filter(i => dentro(i.inicio, f.dataInicio, f.dataFim));
      
      if (f.emUso) r.medsEmUso = m.filter(i => !i.fim || i.fim >= hoje).sort((a, b) => (b.inicio || "").localeCompare(a.inicio || ""));
      if (f.encerrados) r.medsEncerrados = m.filter(i => i.fim && i.fim < hoje).sort((a, b) => (b.inicio || "").localeCompare(a.inicio || ""));
    }

    if (secoes.has("compromissos")) {
      const f = filtros.compromissos;
      let c = itens.filter(i => i.cuidado === "Consulta" || i.cuidado === "Exame");
      if (f.consulta && !f.exame) c = c.filter(i => i.cuidado === "Consulta");
      else if (f.exame && !f.consulta) c = c.filter(i => i.cuidado === "Exame");
      if (f.situacao) c = c.filter(i => (i.situacao ?? "proximo") === f.situacao);
      if (f.tipo) c = c.filter(i => i.especialidade === f.tipo || i.tipoExame === f.tipo);
      c = c.filter(i => dentro(i.data, f.dataInicio, f.dataFim));
      r.compromissos = c.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    }

    if (secoes.has("sinais")) {
      const f = filtros.sinais;
      let s = itens.filter(i => i.cuidado === "Pressão" || i.cuidado === "Glicose");
      s = s.filter(i => dentro(i.data, f.dataInicio, f.dataFim));
      
      if (f.pressao) r.pressao = s.filter(i => i.cuidado === "Pressão").sort((a, b) => (b.data || "").localeCompare(a.data || ""));
      if (f.glicose) r.glicose = s.filter(i => i.cuidado === "Glicose").sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    }

    if (secoes.has("historico_doses")) {
      const f = filtros.historico_doses;
      let d = logs.filter(l => 
        (l.cuidado as string) === "Medicação_Log" || 
        ((l.cuidado as string) === "Medicação" && l.evento === true && !l.acao)
      );
      if (f.medicamento) d = d.filter(l => (l.titulo || "").includes(f.medicamento));
      d = d.filter(l => dentro(l.data, f.dataInicio, f.dataFim));
      
      // ✅ Enriquece o histórico com os dados do remédio pai
      r.historico = d.map(log => {
        const med = itens.find(m => m.id === log.parentId);
        return {
          ...log,
          dosagem: med?.dosagem || "",
          tratamento: med?.tratamento || "",
          medicamento: med?.medicamento || log.titulo
        };
      }).sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
    }

    if (secoes.has("tratamentos")) {
      const f = filtros.tratamentos;
      let lista = tratamentosUnicos;
      if (f.tratamento) lista = lista.filter(t => t === f.tratamento);
      r.tratamentos = lista.map(t => ({
        tratamento: t,
        meds: itens.filter(i => i.cuidado === "Medicação" && i.tratamento === t && dentro(i.inicio, f.dataInicio, f.dataFim))
      })).filter(t => t.meds.length > 0);
    }
    return r;
  }, [secoes, filtros, itens, logs, hoje, tratamentosUnicos]);

  const imprimir = () => {
    if (secoes.size === 0) {
      alert("Marque pelo menos uma seção para gerar o relatório.");
      return;
    }
    window.print();
  };

  const labelStatus = (s?: Situacao) => {
    if (s === "feito") return "Compareceu";
    if (s === "faltou") return "Faltou";
    if (s === "cancelado") return "Cancelou";
    return "Próximo";
  };

  const renderHeader = (titulo: string, Icone: any) => (
    <div className="flex items-center gap-2 mb-2 mt-6">
      <Icone className="h-5 w-5 text-[#5B92C7]" />
      <h2 className="text-lg font-bold text-[#2C4A6B] border-b pb-1 flex-1">{titulo}</h2>
    </div>
  );

  const PillBtn = ({ ativo, onClick, children, cor }: any) => (
    <button
      onClick={onClick}
      className={`rounded-full border-2 px-3 py-1.5 text-xs font-bold transition ${
        ativo ? "text-white" : "border-gray-300 text-muted-foreground hover:border-gray-400"
      }`}
      style={ativo ? { backgroundColor: cor || "var(--tema)", borderColor: cor || "var(--tema)" } : {}}
    >
      {children}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-lg pb-20 pt-2 print:p-0">
      
      {/* BARRA SUPERIOR */}
      <div className="flex items-center justify-between mb-4 print:hidden px-4">
        <Link to="/acompanhamento" className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <button 
          onClick={imprimir} 
          disabled={secoes.size === 0}
          className="flex items-center gap-2 rounded-full bg-[#5B92C7] px-4 py-2 text-sm font-bold text-white shadow-md disabled:opacity-50"
        >
          <Printer className="h-4 w-4" /> Baixar PDF
        </button>
      </div>

      {/* FILTROS (TELA) */}
      <div className="print:hidden px-4">
        <h1 className="text-2xl font-bold text-[#2C4A6B] mb-1">Relatório de Saúde</h1>
        <p className="text-sm text-muted-foreground mb-4">Marque o que incluir e configure os filtros.</p>

        {SECOES_INFO.map(({ chave, titulo, icone: Icone }) => {
          const selecionada = secoes.has(chave);
          return (
            <div key={chave} className={`notebook mb-3 transition-all ${selecionada ? "border-2" : ""}`} style={selecionada ? { borderColor: "var(--tema)" } : {}}>
              <button onClick={() => toggleSecao(chave)} className="flex w-full items-center gap-3 p-4 text-left">
                <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${selecionada ? "text-white" : "border-gray-300 bg-white"}`} style={selecionada ? { backgroundColor: "var(--tema)", borderColor: "var(--tema)" } : {}}>
                  {selecionada && <Check className="h-4 w-4" />}
                </div>
                <Icone className="h-5 w-5" style={{ color: selecionada ? "var(--tema)" : "#7A8A9A" }} />
                <span className={`flex-1 font-bold text-base ${selecionada ? "" : "text-foreground"}`} style={selecionada ? { color: "var(--tema-escuro)" } : {}}>{titulo}</span>
              </button>

              {selecionada && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  {chave === "medicamentos" && (
                    <>
                      <div className="flex gap-2 flex-wrap">
                        <PillBtn ativo={filtros.medicamentos.emUso} onClick={() => atualizarFiltro("medicamentos", "emUso", !filtros.medicamentos.emUso)}>Em uso</PillBtn>
                        <PillBtn ativo={filtros.medicamentos.encerrados} onClick={() => atualizarFiltro("medicamentos", "encerrados", !filtros.medicamentos.encerrados)}>Encerrados</PillBtn>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" className="field text-sm p-2" value={filtros.medicamentos.dataInicio} onChange={(e) => atualizarFiltro("medicamentos", "dataInicio", e.target.value)} />
                        <input type="date" className="field text-sm p-2" value={filtros.medicamentos.dataFim} onChange={(e) => atualizarFiltro("medicamentos", "dataFim", e.target.value)} />
                      </div>
                    </>
                  )}

                  {chave === "compromissos" && (
                    <>
                      <div className="flex gap-2 flex-wrap">
                        <PillBtn ativo={filtros.compromissos.consulta} onClick={() => atualizarFiltro("compromissos", "consulta", !filtros.compromissos.consulta)}>Consultas</PillBtn>
                        <PillBtn ativo={filtros.compromissos.exame} onClick={() => atualizarFiltro("compromissos", "exame", !filtros.compromissos.exame)}>Exames</PillBtn>
                      </div>
                      <select className="field text-sm p-2 w-full" value={filtros.compromissos.situacao} onChange={(e) => atualizarFiltro("compromissos", "situacao", e.target.value)}>
                        <option value="">Todos os status</option>
                        <option value="proximo">Próximos</option>
                        <option value="feito">Compareceu</option>
                        <option value="faltou">Faltou</option>
                        <option value="cancelado">Cancelou</option>
                      </select>
                      <select className="field text-sm p-2 w-full" value={filtros.compromissos.tipo} onChange={(e) => atualizarFiltro("compromissos", "tipo", e.target.value)}>
                        <option value="">Todos os tipos</option>
                        {tiposConsulta.map(t => <option key={`c-${t}`} value={t}>{t} (Consulta)</option>)}
                        {tiposExame.map(t => <option key={`e-${t}`} value={t}>{t} (Exame)</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" className="field text-sm p-2" value={filtros.compromissos.dataInicio} onChange={(e) => atualizarFiltro("compromissos", "dataInicio", e.target.value)} />
                        <input type="date" className="field text-sm p-2" value={filtros.compromissos.dataFim} onChange={(e) => atualizarFiltro("compromissos", "dataFim", e.target.value)} />
                      </div>
                    </>
                  )}

                  {chave === "sinais" && (
                    <>
                      <div className="flex gap-2 flex-wrap">
                        <PillBtn ativo={filtros.sinais.pressao} onClick={() => atualizarFiltro("sinais", "pressao", !filtros.sinais.pressao)}>Pressão</PillBtn>
                        <PillBtn ativo={filtros.sinais.glicose} onClick={() => atualizarFiltro("sinais", "glicose", !filtros.sinais.glicose)}>Glicose</PillBtn>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" className="field text-sm p-2" value={filtros.sinais.dataInicio} onChange={(e) => atualizarFiltro("sinais", "dataInicio", e.target.value)} />
                        <input type="date" className="field text-sm p-2" value={filtros.sinais.dataFim} onChange={(e) => atualizarFiltro("sinais", "dataFim", e.target.value)} />
                      </div>
                    </>
                  )}

                  {chave === "historico_doses" && (
                    <>
                      <select className="field text-sm p-2 w-full" value={filtros.historico_doses.medicamento} onChange={(e) => atualizarFiltro("historico_doses", "medicamento", e.target.value)}>
                        <option value="">Todos os medicamentos</option>
                        {nomesMedicamentos.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" className="field text-sm p-2" value={filtros.historico_doses.dataInicio} onChange={(e) => atualizarFiltro("historico_doses", "dataInicio", e.target.value)} />
                        <input type="date" className="field text-sm p-2" value={filtros.historico_doses.dataFim} onChange={(e) => atualizarFiltro("historico_doses", "dataFim", e.target.value)} />
                      </div>
                    </>
                  )}

                  {chave === "tratamentos" && (
                    <>
                      <select className="field text-sm p-2 w-full" value={filtros.tratamentos.tratamento} onChange={(e) => atualizarFiltro("tratamentos", "tratamento", e.target.value)}>
                        <option value="">Todos os tratamentos</option>
                        {tratamentosUnicos.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" className="field text-sm p-2" value={filtros.tratamentos.dataInicio} onChange={(e) => atualizarFiltro("tratamentos", "dataInicio", e.target.value)} />
                        <input type="date" className="field text-sm p-2" value={filtros.tratamentos.dataFim} onChange={(e) => atualizarFiltro("tratamentos", "dataFim", e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* RELATÓRIO (SÓ NO PDF) */}
      <div className="hidden print:block">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#2C4A6B]">Relatório de Saúde - HoraMed</h1>
          <p className="text-sm text-muted-foreground">Paciente: {ativa?.nome}</p>
          <p className="text-xs text-muted-foreground">Gerado em {formatData(hoje)}</p>
        </div>

        {/* MEDICAMENTOS EM USO */}
        {secoes.has("medicamentos") && dados.medsEmUso.length > 0 && (
          <section className="mb-8">
            {renderHeader("Medicamentos em Uso", Pill)}
            <ul className="space-y-3">
              {dados.medsEmUso.map((m: any) => (
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
          </section>
        )}

        {/* MEDICAMENTOS ENCERRADOS */}
        {secoes.has("medicamentos") && dados.medsEncerrados.length > 0 && (
          <section className="mb-8">
            {renderHeader("Medicamentos Encerrados", Pill)}
            <ul className="space-y-3">
              {dados.medsEncerrados.map((m: any) => (
                <li key={m.id} className="rounded-xl border border-gray-200 bg-white p-4 text-sm opacity-80">
                  <div className="flex justify-between items-start border-b border-gray-100 pb-2 mb-2">
                    <p className="font-bold text-lg text-foreground">{m.medicamento}</p>
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{m.dosagem}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    {m.profissional && <p><strong className="text-foreground">Médico:</strong> {m.profissional}</p>}
                    {m.especialidade && <p><strong className="text-foreground">Especialidade:</strong> {m.especialidade}</p>}
                    {m.tratamento && <p className="col-span-2"><strong className="text-foreground">Tratamento:</strong> {m.tratamento}</p>}
                    <p><strong className="text-foreground">Início:</strong> {formatData(m.inicio)}</p>
                    <p><strong className="text-foreground">Fim:</strong> {formatData(m.fim)}</p>
                    <p className="col-span-2"><strong className="text-foreground">Horários:</strong> {m.horarios?.join(", ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* CONSULTAS E EXAMES */}
        {secoes.has("compromissos") && dados.compromissos.length > 0 && (
          <section className="mb-8">
            {renderHeader(
              filtros.compromissos.consulta && !filtros.compromissos.exame ? "Consultas" : 
              filtros.compromissos.exame && !filtros.compromissos.consulta ? "Exames" : 
              "Consultas e Exames", FileText
            )}
            <ul className="space-y-2">
              {dados.compromissos.map((c: any) => (
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
          </section>
        )}

        {/* PRESSÃO */}
        {secoes.has("sinais") && dados.pressao.length > 0 && (
          <section className="mb-8">
            {renderHeader("Pressão Arterial", Activity)}
            <ul className="space-y-1">
              {dados.pressao.map((s: any) => (
                <li key={s.id} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0 text-sm">
                  <span className="font-bold text-foreground">{s.titulo}</span>
                  <span className="text-xs text-muted-foreground">{formatData(s.data)} {s.hora}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* GLICOSE */}
        {secoes.has("sinais") && dados.glicose.length > 0 && (
          <section className="mb-8">
            {renderHeader("Glicose", Activity)}
            <ul className="space-y-1">
              {dados.glicose.map((s: any) => (
                <li key={s.id} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0 text-sm">
                  <span className="font-bold text-foreground">{s.titulo}</span>
                  <span className="text-xs text-muted-foreground">{formatData(s.data)} {s.hora}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* HISTÓRICO DE DOSES */}
        {secoes.has("historico_doses") && dados.historico.length > 0 && (
          <section className="mb-8">
            {renderHeader("Histórico de Doses", History)}
            <ul className="space-y-2">
              {dados.historico.map((d: any) => (
                <li key={d.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm flex justify-between items-start">
                  <div>
                    <p className="font-bold text-foreground">{d.medicamento} {d.dosagem && `- ${d.dosagem}`}</p>
                    {d.tratamento && <p className="text-xs text-muted-foreground mt-0.5">Tratamento: {d.tratamento}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatData(d.data)} {d.criadoEm?.slice(11, 16)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* TRATAMENTOS */}
        {secoes.has("tratamentos") && dados.tratamentos.length > 0 && (
          <section className="mb-8">
            {renderHeader("Tratamentos", HeartPulse)}
            <div className="space-y-3">
              {dados.tratamentos.map((t: any) => (
                <div key={t.tratamento} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
                  <h3 className="font-bold text-[#2C4A6B] mb-1">{t.tratamento}</h3>
                  <ul className="space-y-1">
                    {t.meds.map((m: any) => (
                      <li key={m.id} className="text-muted-foreground">
                        • {m.medicamento} ({m.dosagem}) - {formatData(m.inicio)} {m.fim ? `a ${formatData(m.fim)}` : "(contínuo)"}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* CSS para impressão */}
      <style>{`
        @media print {
          @page { margin: 15mm; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          main { padding: 0 !important; }
          section { page-break-inside: avoid; }
          nav, .fixed { display: none !important; }
          /* ✅ Resolve a página em branco */
          .hidden.print\\:block { display: block !important; padding: 0 !important; margin: 0 !important; }
          body > div, #root { display: block !important; padding: 0 !important; margin: 0 !important; min-height: auto !important; }
        }
      `}</style>
    </div>
  );
}