/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Camera, Loader2, X, Clock, CalendarDays, Stethoscope, FileText, Pill, Check, Activity, Droplet } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { supabase } from "@/lib/supabase";
import { nowLocalISO, uid, hojeYMD, type Cuidado, type Dados } from "@/lib/cuidados";
import { Botao, Campo, Divisor, SeletorTesouro } from "@/components/ui-kit";

export const Route = createFileRoute("/_app/criar")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      duplicar: search.duplicar as string | undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Novo registro · horaMed" },
      { name: "description", content: "Agende medicamentos, consultas, exames e registre sinais vitais." },
    ],
  }),
  component: Criar,
});

// Adicionamos os novos tipos e removemos os de terapia
type K = "data"|"hora"|"local"|"profissional"|"especialidade"|"tipoExame"|"recomendacoes"|"medicamento"|"frequencia"|"inicio"|"fim"|"prazoDias"|"pressaoSistolica"|"pressaoDiastolica"|"observacoes"|"glicoseValor"|"glicoseContexto";
type F = Partial<Record<K, string>>;

export function Criar({ tipoInicial, onFechar }: { tipoInicial?: any, onFechar?: () => void } = {}) {
  const { duplicar } = Route.useSearch() as { duplicar?: string };
  const { ativa, salvarRegistros, itens } = useApp(); 
  const navigate = useNavigate();
  
  const [tipo, setTipo] = useState<any>(tipoInicial || "Consulta");
  const [f, setF] = useState<F>({ inicio: hojeYMD() });

  useEffect(() => {
    if (tipoInicial) {
      setTipo(tipoInicial);
    }
  }, [tipoInicial]);

  const [fotoUrl, setFotoUrl] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState<"caixa" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [vezesAoDia, setVezesAoDia] = useState(1);
  const [horaInicial, setHoraInicial] = useState("08:00");
  const [diasSemana, setDiasSemana] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const [dosagemValor, setDosagemValor] = useState("");
  const [dosagemUnidade, setDosagemUnidade] = useState("ml");
  const [estoqueAtual, setEstoqueAtual] = useState("");

  const [tratamento, setTratamento] = useState("");
  const [tratamentoOutro, setTratamentoOutro] = useState("");
  const [mostrarLista, setMostrarLista] = useState(false);
  const [digitandoOutro, setDigitandoOutro] = useState(false);

  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (duplicar && itens.length > 0) {
      const med: any = itens.find(i => i.id === duplicar);
      if (med && med.cuidado === "Medicação") {
        setTipo("Medicação");
        setF(prev => ({
          ...prev,
          medicamento: med.medicamento || "",
          profissional: med.profissional || "",
          especialidade: med.especialidade || "",
          inicio: hojeYMD(),
        }));
        if (med.dosagemValor) setDosagemValor(String(med.dosagemValor));
        if (med.dosagemUnidade) setDosagemUnidade(med.dosagemUnidade);
        if (med.estoqueAtual !== undefined) setEstoqueAtual(String(med.estoqueAtual));
        if (med.horarios && med.horarios.length > 0) {
          setVezesAoDia(med.horarios.length);
          setHoraInicial(med.horarios[0] || "08:00");
        }
        if (med.diasSemana) setDiasSemana(med.diasSemana);
        if (med.fotoUrl) setFotoUrl(med.fotoUrl);
        if (med.tratamento) {
          setTratamento(med.tratamento);
          setTratamentoOutro(med.tratamento);
        }
      }
    }
  }, [duplicar, itens]);

  const set = (k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const inp = (k: K, type = "text", req = false) => (
    <input className="field" type={type} required={req} value={f[k] ?? ""} onChange={set(k)} />
  );

  const calcularHorarios = () => {
    if (!horaInicial) return [];
    const [h = 0, m = 0] = horaInicial.split(":").map(Number);
    const intervalHours = 24 / vezesAoDia;
    const horarios = [];

    for (let i = 0; i < vezesAoDia; i++) {
      const novaHora = (h + i * intervalHours) % 24;
      const horaFormatada = Math.floor(novaHora).toString().padStart(2, "0");
      const minutoFormatado = m.toString().padStart(2, "0");
      horarios.push(`${horaFormatada}:${minutoFormatado}`);
    }
    return horarios;
  };

  const toggleDia = (diaIndex: number) => {
    setDiasSemana((prev) =>
      prev.includes(diaIndex) ? prev.filter((d) => d !== diaIndex) : [...prev, diaIndex]
    );
  };

  const fazerUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEnviandoFoto("caixa");
    const extensao = file.name.split(".").pop();
    const nomeArquivo = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extensao}`;

    const { data, error } = await supabase.storage.from("medicamentos").upload(nomeArquivo, file);

    if (error) {
      toast.error("Erro ao enviar a foto.");
      setEnviandoFoto(null);
      return;
    }

    const { data: publicUrl } = await supabase.storage.from("medicamentos").getPublicUrl(data.path);
    setFotoUrl(publicUrl.publicUrl);

    setEnviandoFoto(null);
    toast.success("Foto anexada!");
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ativa || !tipo) return;
    
    let fimCalculado: any = f.fim;
    if (f.prazoDias && f.inicio) {
      const inicioStr = f.inicio || hojeYMD();
      const dataInicio = new Date(inicioStr);
      dataInicio.setDate(dataInicio.getDate() + Number(f.prazoDias) - 1);
      fimCalculado = dataInicio.toISOString().slice(0, 10);
    }

    const base = { pessoaId: ativa.id, criadoEm: nowLocalISO(), cuidado: tipo, situacao: "proximo" as const };
    let lista: Dados[] = [];

    // USANDO CAMPOS GENÉRICOS (titulo / detalhes) PARA NÃO QUEBRAR O BANCO
    if (tipo === "Consulta") {
      lista = [{ ...base, id: uid(), titulo: `Consulta${f.especialidade ? ` · ${f.especialidade}` : ""}`, data: f.data, hora: f.hora, local: f.local, profissional: f.profissional, especialidade: f.especialidade }];
    } else if (tipo === "Exame") {
      lista = [{ ...base, id: uid(), titulo: `Exame · ${f.tipoExame}`, tipoExame: f.tipoExame, data: f.data, hora: f.hora, local: f.local, profissional: f.profissional, recomendacoes: f.recomendacoes }];
    } else if (tipo === "Medicação") {
      const horariosCalculados = calcularHorarios();
      lista = [{
        ...base,
        id: uid(),
        titulo: `Medicação · ${f.medicamento}`,
        medicamento: f.medicamento,
        dosagem: `${dosagemValor} ${dosagemUnidade}`.trim(),
        dosagemValor: dosagemValor || undefined,
        dosagemUnidade: dosagemUnidade || undefined,
        estoqueAtual: estoqueAtual ? Number(estoqueAtual) : undefined,
        horarios: horariosCalculados,
        frequencia: `${vezesAoDia}x ao dia`,
        profissional: f.profissional,
        especialidade: f.especialidade,
        inicio: f.inicio,
        fim: fimCalculado || undefined,
        fotoUrl: fotoUrl,
        diasSemana: diasSemana,
        tratamento: tratamento || undefined,
      }];
    } else if (tipo === "Pressão") {
      lista = [{ 
        ...base, 
        id: uid(), 
        titulo: `Pressão: ${f.pressaoSistolica}/${f.pressaoDiastolica}`, 
        data: f.data, 
        hora: f.hora,
        detalhes: f.observacoes // Salvando observações no detalhes genérico
      }];
    } else if (tipo === "Glicose") {
      lista = [{ 
        ...base, 
        id: uid(), 
        titulo: `Glicose: ${f.glicoseValor} mg/dL`, 
        data: f.data, 
        hora: f.hora,
        detalhes: `Contexto: ${f.glicoseContexto || "jejum"}. ${f.observacoes || ""}`.trim()
      }];
    }

    setSalvando(true);
    const ok = await salvarRegistros(lista);
    setSalvando(false);
    if (ok) {
      toast.success("Registro salvo com sucesso!");
      navigate({ to: "/acompanhamento" }); // Ajuste se a rota principal for outra
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 py-6 pb-24">
      <header className="text-center px-4 mb-2 flex flex-col items-center">
        <h1 className="font-display text-4xl font-bold italic text-[var(--tema-escuro)] flex items-center justify-center gap-2">
          horaMed <span className="text-3xl not-italic">🩺</span>
        </h1>
        <p className="text-xs font-sans italic text-muted-foreground mt-2">
          {duplicar ? "Renovar Programação" : "Sua saúde organizada de forma simples."}
        </p>
      </header>
      
      <div className="px-4">
        <SeletorTesouro prefixo="Para" permitirCriar />
      </div>

      <p className="font-display text-xl up font-bold text-[var(--tema)] text-center mb-2">
        O que você quer registrar?
      </p>

      <div className="grid grid-cols-2 gap-4 px-4 mt-6">
        {[
          { tipo: "Medicação", icone: Pill },
          { tipo: "Consulta", icone: Stethoscope },
          { tipo: "Exame", icone: FileText },
          { tipo: "Pressão", icone: Activity },
          { tipo: "Glicose", icone: Droplet },
        ].map(({ tipo: c, icone: Icone }) => {
          const selecionado = tipo === c;
          return (
            <button
              key={c}
              onClick={() => setTipo(selecionado ? null : c)}
              className={`notebook flex flex-col items-center justify-center p-4 transition hover:bg-muted/10 ${
                selecionado ? "border-[var(--tema)]" : "border-[#B8933F]/60"
              }`}
              style={{
                borderWidth: selecionado ? "3px" : "2px",
                borderColor: selecionado ? "var(--tema)" : "",
                boxShadow: selecionado
                  ? "0 0 25px 8px var(--tema-claro), 0 8px 20px -5px var(--tema)"
                  : "0 4px 12px -4px rgba(0,0,0,0.05)",
              }}
            >
              <div
                className="grid h-10 w-10 place-items-center rounded-full transition-colors mb-2"
                style={{ backgroundColor: "var(--tema-claro)", color: "var(--tema-escuro)" }}
              >
                <Icone className="h-5 w-5" />
              </div>
              <span className="font-display text-sm font-bold italic transition-colors" style={{ color: selecionado ? "var(--tema-escuro)" : "#4A4A4A" }}>
                {c}
              </span>
            </button>
          );
        })}
      </div>

      {tipo && (
        <div className="relative mt-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="fixed inset-0 z-0" onClick={() => setTipo(null)} />

          <form onSubmit={guardar} className="relative z-10 space-y-5 rounded-[2rem] bg-white p-6 shadow-xl" style={{ border: "1px solid var(--tema-claro)", borderTop: "4px solid var(--tema)" }}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="font-display text-xl font-bold italic" style={{ color: "var(--tema-escuro)" }}>
                {tipo === "Medicação" ? (duplicar ? "Renovar Medicação" : "Nova Medicação") : `Novo(a) ${tipo}`}
              </h2>
              <button type="button" onClick={() => setTipo(null)} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-200">
                <X className="h-3 w-3" /> Fechar
              </button>
            </div>
            
            <style>{`
              form input.field, form select.field, form textarea.field {
                border-radius: 1rem; border: 1.5px solid #E2E8F0; background-color: #FFFFFF;
                font-family: var(--font-sans); padding: 0.75rem 1rem;
              }
              form input.field:focus, form select.field:focus, form textarea.field:focus {
                border-color: var(--tema); box-shadow: 0 0 0 3px var(--tema-claro); outline: none;
              }
              form label > span { font-family: var(--font-display); font-style: italic; color: var(--tema-escuro); font-weight: 600; }
            `}</style>

            {tipo === "Consulta" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Data">{inp("data", "date", true)}</Campo>
                  <Campo label="Hora">{inp("hora", "time")}</Campo>
                </div>
                <Campo label="Local">{inp("local")}</Campo>
                <Campo label="Profissional">{inp("profissional")}</Campo>
                <Campo label="Especialidade">{inp("especialidade")}</Campo>
              </>
            )}

            {tipo === "Exame" && (
              <>
                <Campo label="Tipo de exame">{inp("tipoExame", "text", true)}</Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Data">{inp("data", "date", true)}</Campo>
                  <Campo label="Hora">{inp("hora", "time")}</Campo>
                </div>
                <Campo label="Local">{inp("local")}</Campo>
                <Campo label="Profissional / solicitante">{inp("profissional")}</Campo>
                <Campo label="Recomendações"><textarea className="field min-h-24" value={f.recomendacoes ?? ""} onChange={set("recomendacoes")} /></Campo>
              </>
            )}

            {tipo === "Pressão" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Data">{inp("data", "date", true)}</Campo>
                  <Campo label="Hora">{inp("hora", "time")}</Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Sistólica (Máx)">{inp("pressaoSistolica", "number", true)}</Campo>
                  <Campo label="Diastólica (Mín)">{inp("pressaoDiastolica", "number", true)}</Campo>
                </div>
                <Campo label="Observações"><textarea className="field min-h-20" value={f.observacoes ?? ""} onChange={set("observacoes")} placeholder="Ex: Após caminhada..." /></Campo>
              </>
            )}

            {tipo === "Glicose" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Data">{inp("data", "date", true)}</Campo>
                  <Campo label="Hora">{inp("hora", "time")}</Campo>
                </div>
                <Campo label="Valor (mg/dL)">{inp("glicoseValor", "number", true)}</Campo>
                <Campo label="Contexto">
                  <select className="field" value={f.glicoseContexto ?? "jejum"} onChange={set("glicoseContexto")}>
                    <option value="jejum">Em jejum</option>
                    <option value="pos_prandial">Após refeição</option>
                    <option value="aleatorio">Aleatório</option>
                  </select>
                </Campo>
                <Campo label="Observações"><textarea className="field min-h-20" value={f.observacoes ?? ""} onChange={set("observacoes")} /></Campo>
              </>
            )}

            {tipo === "Medicação" && (
              <>
                <Campo label="Nome">{inp("medicamento", "text", true)}</Campo>
                <div className="grid grid-cols-[1.5fr_2fr] gap-3">
                  <Campo label="Dosagem"><input className="field" type="number" placeholder="Ex: 5" value={dosagemValor} onChange={(e) => setDosagemValor(e.target.value)} /></Campo>
                  <Campo label="Unidade">
                    <select className="field" value={dosagemUnidade} onChange={(e) => setDosagemUnidade(e.target.value)}>
                      <option value="ml">ml (mililitros)</option>
                      <option value="Gotas">Gotas</option>
                      <option value="Comprimido(s)">Comprimido(s)</option>
                      <option value="Cápsula(s)">Cápsula(s)</option>
                      <option value="Injeção">Injeção</option>
                    </select>
                  </Campo>
                </div>
                <Campo label="Estoque"><input className="field text-xs" type="number" placeholder="Quantos comprimidos/ml tem." value={estoqueAtual} onChange={(e) => setEstoqueAtual(e.target.value)} /></Campo>
                <Campo label="Tratamento">
                  <div className="border-[1.5px] border-[#E2E8F0] rounded-2xl bg-white overflow-hidden">
                    {digitandoOutro ? (
                      <div className="p-3 flex items-center gap-2">
                        <input type="text" className="w-full bg-transparent text-sm focus:outline-none text-foreground" placeholder="Escreva aqui o seu tratamento." value={tratamentoOutro} onChange={(e) => setTratamentoOutro(e.target.value)} autoFocus />
                        <button type="button" onClick={() => { if (tratamentoOutro.trim()) { setTratamento(tratamentoOutro); } else { setTratamento(""); } setDigitandoOutro(false); }} className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition"><Check className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setMostrarLista(!mostrarLista)} className="w-full flex items-center justify-between p-3 text-sm text-left bg-white hover:bg-gray-50 transition">
                        <span className={tratamento ? "text-foreground font-medium" : "text-muted-foreground"}>{tratamento || "Selecione ou escreva abaixo..."}</span>
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    )}
                    {mostrarLista && !digitandoOutro && (
                      <div className="border-t border-[#E2E8F0] max-h-56 overflow-y-auto p-2 bg-slate-50">
                        {["Febre", "Dor", "Gripe", "Resfriado", "Infecção urinária", "Alergia", "Laringite", "Asma", "Bronquite", "Sinusite", "Gastrite", "Refluxo", "Diabetes", "Hipertensão", "Colesterol", "Cardiológico", "Renal", "Hepático", "Tireoide", "Ansiedade", "Depressão", "Vitaminas / Suplementos"].map(doenca => (
                          <button key={doenca} type="button" onClick={() => { setTratamento(doenca); setTratamentoOutro(""); setMostrarLista(false); }} className={`w-full text-left p-2.5 text-sm rounded-lg mb-1 transition ${tratamento === doenca ? "bg-primary text-primary-foreground font-bold" : "hover:bg-white text-foreground"}`}>{doenca}</button>
                        ))}
                        <button type="button" onClick={() => { setTratamentoOutro(""); setMostrarLista(false); setDigitandoOutro(true); }} className={`w-full text-left p-2.5 text-sm rounded-lg mt-1 border-t border-gray-200 transition hover:bg-white text-foreground font-semibold`}>Outro (não listado acima)</button>
                      </div>
                    )}
                  </div>
                </Campo>
                <div>
                  <span className="text-xs font-semibold block mb-1">Foto da Caixa</span>
                  {fotoUrl ? (
                    <div className="relative w-20 h-20 overflow-hidden rounded-xl border border-gold/40">
                      <img src={fotoUrl} alt="Caixa" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setFotoUrl("")} className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-gold/40 bg-muted/30">
                      {enviandoFoto === "caixa" ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
                    </button>
                  )}
                  <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={fazerUploadFoto} className="hidden" />
                </div>
                <div className="space-y-3">
                  <span className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Horários</span>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Começa às:"><input type="time" className="field" value={horaInicial} onChange={(e) => setHoraInicial(e.target.value)} /></Campo>
                    <Campo label="Tomadas ao dia:">
                      <select className="field" value={vezesAoDia} onChange={(e) => setVezesAoDia(Number(e.target.value))}>
                        <option value={1}>1x ao dia (24h)</option>
                        <option value={2}>2x ao dia (12h)</option>
                        <option value={3}>3x ao dia (8h)</option>
                        <option value={4}>4x ao dia (6h)</option>
                      </select>
                    </Campo>
                  </div>
                  <div className="rounded-xl bg-sky/30 p-3 text-sm text-primary"><strong>Horários gerados: </strong>{calcularHorarios().join(" • ")}</div>
                </div>
                <div className="space-y-3">
                  <span className="text-sm font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Dias da Semana</span>
                  <div className="flex flex-wrap gap-2">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia, index) => {
                      const ativo = diasSemana.includes(index);
                      return (
                        <button key={dia} type="button" onClick={() => toggleDia(index)} className={`grid h-10 w-10 place-items-center rounded-full text-xs font-bold transition ${ativo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{dia}</button>
                      );
                    })}
                  </div>
                </div>
                <Campo label="Profissional que prescreveu">{inp("profissional")}</Campo>
                <Campo label="Especialidade">{inp("especialidade")}</Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Início">{inp("inicio", "date")}</Campo>
                  <Campo label="Prazo (dias)"><input className="field" type="number" placeholder="Ex: 5" value={f.prazoDias ?? ""} onChange={set("prazoDias")} /></Campo>
                </div>
              </>
            )}

            <Divisor />
            <div className="pt-4 pb-24">
              <Botao type="submit" disabled={salvando} className="w-full rounded-full py-3 text-base font-bold shadow-lg transition-transform hover:scale-[1.01]" style={{ backgroundColor: "var(--tema)", color: "white" }}>
                {salvando ? "Salvando..." : "Guardar Registro"}
              </Botao>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}