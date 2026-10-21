import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Camera, Loader2, X, Clock, CalendarDays } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { supabase } from "@/lib/supabase";
import { DIAS_SEMANA, EMOJI, gerarSessoes, nowLocalISO, uid, type Cuidado, type Dados, type Programacao } from "@/lib/cuidados";
import { Botao, Campo, Divisor, SeletorTesouro } from "@/components/ui-kit";

export const Route = createFileRoute("/_app/criar")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Novo compromisso · Rotina Azul" },
      { name: "description", content: "Agende consultas, terapias, exames e medicações." },
      { property: "og:title", content: "Novo compromisso · Rotina Azul" },
      { property: "og:description", content: "Agende consultas, terapias, exames e medicações." },
    ],
  }),
  component: Criar,
});

type K = "data"|"hora"|"local"|"profissional"|"especialidade"|"tipoTerapia"|"tipoExame"|"recomendacoes"|"medicamento"|"dosagem"|"frequencia"|"inicio"|"fim"|"programacao"|"meses"|"diaSemana";
type F = Partial<Record<K, string>>;

function Criar() {
  const { ativa, salvarRegistros } = useApp();
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<Cuidado | null>(null);
  const [f, setF] = useState<F>({ programacao: "unica", meses: "3", diaSemana: "1" });
  
  // Estados de Medicação
  const [fotoUrl, setFotoUrl] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [vezesAoDia, setVezesAoDia] = useState(1);
  const [horaInicial, setHoraInicial] = useState("08:00");
  const [diasSemana, setDiasSemana] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const [salvando, setSalvando] = useState(false);
  const set = (k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const inp = (k: K, type = "text", req = false) => (
    <input className="field" type={type} required={req} value={f[k] ?? ""} onChange={set(k)} />
  );

  // ✅ Lógica para calcular horários automaticamente
  const calcularHorarios = () => {
    if (!horaInicial) return [];
    const [h, m] = horaInicial.split(":").map(Number);
    const intervalHours = 24 / vezesAoDia;
    const horarios = [];

    for (let i = 0; i < vezesAoDia; i++) {
      let novaHora = (h + i * intervalHours) % 24;
      let horaFormatada = Math.floor(novaHora).toString().padStart(2, "0");
      let minutoFormatado = m.toString().padStart(2, "0");
      horarios.push(`${horaFormatada}:${minutoFormatado}`);
    }
    return horarios;
  };

  const toggleDia = (diaIndex: number) => {
    setDiasSemana((prev) =>
      prev.includes(diaIndex)
        ? prev.filter((d) => d !== diaIndex)
        : [...prev, diaIndex]
    );
  };

  const fazerUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setEnviandoFoto(true);
    const extensao = file.name.split(".").pop();
    const nomeArquivo = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extensao}`;

    const { data, error } = await supabase.storage.from("medicamentos").upload(nomeArquivo, file);
    
    if (error) {
      console.error(error);
      toast.error("Erro ao enviar a foto. Tente novamente.");
      setEnviandoFoto(false);
      return;
    }
    
    const { data: publicUrl } = supabase.storage.from("medicamentos").getPublicUrl(data.path);
    setFotoUrl(publicUrl.publicUrl);
    setEnviandoFoto(false);
    toast.success("Foto anexada!");
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ativa || !tipo) return;
    const base = { pessoaId: ativa.id, criadoEm: nowLocalISO(), cuidado: tipo, situacao: "proximo" as const };
    let lista: Dados[] = [];
    
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
        dosagem: f.dosagem, 
        horarios: horariosCalculados, 
        frequencia: `${vezesAoDia}x ao dia`, 
        profissional: f.profissional, 
        especialidade: f.especialidade, 
        inicio: f.inicio, 
        fim: f.fim || undefined,
        fotoUrl: fotoUrl, // ✅ Salva a foto
        diasSemana: diasSemana, // ✅ Salva os dias
      }];
    } else {
      const prog = f.programacao as Programacao;
      const meses = Number(f.meses);
      const dia = Number(f.diaSemana);
      const datas = gerarSessoes(f.data ?? "", prog, meses, prog === "semanal" ? dia : undefined);
      const programaId = prog === "unica" ? undefined : uid();
      lista = datas.map((data, idx) => ({
        ...base,
        id: uid(),
        titulo: `Terapia · ${f.tipoTerapia}${datas.length > 1 ? ` (${idx + 1}/${datas.length})` : ""}`,
        tipoTerapia: f.tipoTerapia, profissional: f.profissional, local: f.local, data, hora: f.hora,
        ...(programaId ? { programa: true, programaId, duracaoMeses: meses, frequencia: prog, diaSemana: prog === "semanal" ? DIAS_SEMANA[dia] : undefined } : {}),
      }));
    }
    
    setSalvando(true);
    const ok = await salvarRegistros(lista);
    setSalvando(false);
    if (ok) {
      toast.success(lista.length > 1 ? `${lista.length} sessões agendadas!` : "Agendamento guardado!");
      navigate({ to: "/acompanhamento" });
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Novo compromisso</h1>
      <SeletorTesouro prefixo="Para" />
      
      <div className="grid grid-cols-2 gap-3">
        {(["Consulta", "Terapia", "Exame", "Medicação"] as Cuidado[]).map((c) => (
          <button
            key={c}
            onClick={() => setTipo(c)}
            className={`flex flex-col items-center gap-1 rounded-3xl border p-5 shadow-soft transition ${tipo === c ? "border-primary bg-sky" : "border-gold/40 bg-card"}`}
          >
            <span className="text-4xl">{EMOJI[c]}</span>
            <span className="font-display text-lg font-semibold italic">{c}</span>
          </button>
        ))}
      </div>

      {tipo && (
        <form onSubmit={guardar} className="notebook space-y-4 p-5">
          <h2 className="text-xl font-semibold">{EMOJI[tipo]} {tipo}</h2>
          
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
          
          {tipo === "Terapia" && (
            <>
              <Campo label="Tipo">{inp("tipoTerapia", "text", true)}</Campo>
              <Campo label="Profissional">{inp("profissional")}</Campo>
              <Campo label="Local">{inp("local")}</Campo>
              <Campo label="Programação">
                <select className="field" value={f.programacao} onChange={set("programacao")}>
                  <option value="unica">Sessão única</option>
                  <option value="semanal">Toda semana</option>
                  <option value="quinzenal">A cada 15 dias</option>
                  <option value="mensal">Uma vez por mês</option>
                </select>
              </Campo>
              {f.programacao === "semanal" && (
                <Campo label="Dia da semana">
                  <select className="field" value={f.diaSemana} onChange={set("diaSemana")}>
                    {DIAS_SEMANA.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </Campo>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Primeira sessão">{inp("data", "date", true)}</Campo>
                <Campo label="Hora">{inp("hora", "time")}</Campo>
              </div>
              {f.programacao !== "unica" && (
                <Campo label="Por quanto tempo">
                  <select className="field" value={f.meses} onChange={set("meses")}>
                    <option value="3">3 meses</option>
                    <option value="6">6 meses</option>
                    <option value="12">12 meses</option>
                  </select>
                </Campo>
              )}
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
              <Campo label="Recomendações">
                <textarea className="field min-h-24" value={f.recomendacoes ?? ""} onChange={set("recomendacoes")} />
              </Campo>
            </>
          )}
          
          {tipo === "Medicação" && (
            <>
              <Campo label="Nome">{inp("medicamento", "text", true)}</Campo>
              <Campo label="Dosagem">{inp("dosagem")}</Campo>

              {/* ✅ NOVO: FOTO DO REMÉDIO */}
              <div>
                <span className="text-sm font-semibold block mb-1">Foto do Remédio (Opcional)</span>
                {fotoUrl ? (
                  <div className="relative w-24 h-24 overflow-hidden rounded-xl border border-gold/40">
                    <img src={fotoUrl} alt="Remédio" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setFotoUrl("")} className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-gold/40 bg-muted/30">
                    {enviandoFoto ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Camera className="h-6 w-6 text-muted-foreground" />}
                  </button>
                )}
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={fazerUploadFoto} className="hidden" />
              </div>

              {/* ✅ NOVO: HORÁRIOS INTELIGENTES */}
              <div className="space-y-3">
                <span className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Horários</span>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Começa às:">
                    <input type="time" className="field" value={horaInicial} onChange={(e) => setHoraInicial(e.target.value)} />
                  </Campo>
                  <Campo label="Tomadas ao dia:">
                    <select className="field" value={vezesAoDia} onChange={(e) => setVezesAoDia(Number(e.target.value))}>
                      <option value={1}>1x ao dia (24h)</option>
                      <option value={2}>2x ao dia (12h)</option>
                      <option value={3}>3x ao dia (8h)</option>
                      <option value={4}>4x ao dia (6h)</option>
                    </select>
                  </Campo>
                </div>
                <div className="rounded-xl bg-sky/30 p-3 text-sm text-primary">
                  <strong>Horários gerados: </strong> 
                  {calcularHorarios().join(" • ")}
                </div>
              </div>

              {/* ✅ NOVO: DIAS DA SEMANA */}
              <div className="space-y-3">
                <span className="text-sm font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Dias da Semana</span>
                <p className="text-xs text-muted-foreground">Desmarque os dias em que NÃO vai tomar o remédio.</p>
                <div className="flex flex-wrap gap-2">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia, index) => {
                    const ativo = diasSemana.includes(index);
                    return (
                      <button
                        key={dia}
                        type="button"
                        onClick={() => toggleDia(index)}
                        className={`grid h-10 w-10 place-items-center rounded-full text-xs font-bold transition ${
                          ativo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {dia}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Campo label="Profissional que prescreveu">{inp("profissional")}</Campo>
              <Campo label="Especialidade">{inp("especialidade")}</Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Início">{inp("inicio", "date")}</Campo>
                <Campo label="Fim">{inp("fim", "date")}</Campo>
              </div>
              <p className="text-xs text-muted-foreground">Deixe o fim em branco para uso contínuo.</p>
            </>
          )}
          
          <Divisor />
          <Botao type="submit" disabled={salvando} className="w-full">
            {salvando ? "Salvando..." : "Guardar agendamento"}
          </Botao>
        </form>
      )}
    </div>
  );
}