export type Cuidado = "Consulta" | "Exame" | "Medicação" | "Pressão" | "Glicose";
export type Situacao = "proximo" | "feito" | "faltou" | "cancelado";

export interface Pessoa {
  id: string;
  user_id: string;
  nome: string;
  emoji: string | null;
  tema: string | null;
  nascimento: string | null;
  nome_mae: string | null;
  nome_pai: string | null;
  responsavel: string | null;
}

export interface Dados {
  id: string;
  pessoaId: string;
  criadoEm: string;
  titulo: string;
  cuidado?: Cuidado | undefined;
  data?: string | undefined;
  hora?: string | undefined;
  local?: string | undefined;
  profissional?: string | undefined;
  especialidade?: string | undefined;
  tipoExame?: string | undefined;
  recomendacoes?: string | undefined;
  medicamento?: string | undefined;
  dosagem?: string | undefined;
  frequencia?: string | undefined;
  horarios?: string[] | undefined;
  horario?: string | undefined;
  inicio?: string | undefined;
  fim?: string | undefined;
  situacao?: Situacao | undefined;
  observacaoAcompanhamento?: string | undefined;
  duracaoMeses?: number | undefined;
  diaSemana?: string | undefined;
  evento?: boolean | undefined;
  parentId?: string | undefined;
  programa?: boolean | undefined;
  programaId?: string | undefined;
  acao?: "editar" | "excluir" | undefined;
  alteracoes?: Partial<Dados> | undefined;
  fotoUrl?: string | undefined;
  fotoPilula?: string | undefined;
  diasSemana?: number[] | undefined;

  dosagemValor?: string | undefined;
  dosagemUnidade?: string | undefined;
  estoqueAtual?: number | undefined;
  
  // Campos para Pressão e Glicose (salvos no 'detalhes' do banco)
  detalhes?: string | undefined;
}

export const EMOJI: Record<Cuidado, string> = {
  Consulta: "🩺",
  Exame: "📄",
  Medicação: "💊",
  Pressão: "🩸",
  Glicose: "🩸",
};

export const SITUACAO_LABEL: Record<Situacao, string> = {
  proximo: "Próximo",
  feito: "Compareceu",
  faltou: "Faltou",
  cancelado: "Cancelou",
};

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function toYMD(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseYMD(s: string) {
  const [y = 1970, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function hojeYMD() {
  return toYMD(new Date());
}

export function nowLocalISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${toYMD(d)}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function formatData(s?: string) {
  if (!s) return "";
  const d = parseYMD(s);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

export function addMonths(d: Date, n: number) {
  const r = new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
  return r;
}

export type Programacao = "unica" | "semanal" | "quinzenal" | "mensal";

// Mantido caso você queira usar no futuro, mas não é mais usado no criar.tsx
export function gerarSessoes(
  primeira: string,
  programacao: Programacao,
  meses: number,
  diaSemana?: number,
): string[] {
  let start = parseYMD(primeira);
  if (programacao === "unica") return [primeira];
  if (programacao === "semanal" && diaSemana !== undefined) {
    while (start.getDay() !== diaSemana) start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  }
  const total = programacao === "semanal" ? meses * 4 : programacao === "quinzenal" ? meses * 2 : meses;
  const out: string[] = [];
  for (let i = 0; i < total; i++) {
    if (programacao === "mensal") out.push(toYMD(addMonths(start, i)));
    else {
      const step = programacao === "semanal" ? 7 : 14;
      out.push(toYMD(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * step)));
    }
  }
  return out;
}

export function subtitulo(d: Dados) {
  return [d.profissional, d.especialidade || d.tipoExame, d.local].filter(Boolean).join(" · ");
}

export function tituloComTipo(d: Dados) {
  if (!d.cuidado) return d.titulo;
  return d.titulo.startsWith(d.cuidado) ? d.titulo : `${d.cuidado} · ${d.titulo}`;
}

export function tituloEvento(original: Dados, situacao: Situacao) {
  void situacao;
  if (original.cuidado === "Medicação") {
    return tituloComTipo({ ...original, titulo: original.medicamento || original.titulo });
  }
  if (original.profissional?.trim()) {
    const especialidade = original.especialidade || original.tipoExame;
    return `${original.cuidado || "Compromisso"} com ${original.profissional.trim()}${especialidade ? ` (${especialidade})` : ""}`;
  }
  return tituloComTipo(original);
}

const CAMPOS_FIXOS = ["id", "pessoaId", "criadoEm", "cuidado", "evento", "parentId"] as const;

function aplicarEdicoes(original: Dados, edicoes: Dados[] = []) {
  const ordenadas = [...edicoes].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const atual: Dados = Object.assign({}, original, ...ordenadas.map((e) => e.alteracoes));
  const fixos = Object.fromEntries(CAMPOS_FIXOS.map((k) => [k, original[k]]));
  return Object.assign(atual, fixos) as Dados;
}

export function resolverSituacoes(todos: Dados[]) {
  const eventos = todos.filter((d) => d.evento && d.parentId);
  const ultimo = new Map<string, Dados>();
  const edicoes = new Map<string, Dados[]>();
  const excluidos = new Set<string>();

  for (const e of eventos) {
    if (!e.parentId) continue;
    
    if (e.acao === "excluir") {
      excluidos.add(e.parentId);
      continue;
    }
    
    if (e.acao === "editar") {
      edicoes.set(e.parentId, [...(edicoes.get(e.parentId) ?? []), e]);
      continue;
    }

    const prev = ultimo.get(e.parentId);
    if (!prev || e.criadoEm >= prev.criadoEm) ultimo.set(e.parentId, e);
  }

  return todos
    .filter((d) => !d.evento)
    .filter((d) => !excluidos.has(d.id)) 
    .map((original) => {
      const d = aplicarEdicoes(original, edicoes.get(original.id));
      const ev = ultimo.get(d.id);
      return ev
        ? { ...d, situacao: ev.situacao, observacaoAcompanhamento: ev.observacaoAcompanhamento, _evento: ev }
        : { ...d, _evento: undefined as Dados | undefined };
    });
}

export type Item = ReturnType<typeof resolverSituacoes>[number];

export function medicacaoEmUso(d: Dados, hoje = hojeYMD()) {
  return !d.fim || d.fim >= hoje;
}

export function ordenarPorDataHora<T extends Dados>(itens: T[]): T[] {
  const chave = (d: Dados) => {
    const data = d.data || d.inicio || "9999-12-31";
    const hora = d.hora || [...(d.horarios || [])].sort()[0] || "00:00";
    return `${data}T${hora}`;
  };
  return [...itens].sort((a, b) => chave(a).localeCompare(chave(b)));
}

export function compromissoPendente(d: Dados, hoje = hojeYMD()) {
  return d.cuidado === "Medicação" ? medicacaoEmUso(d, hoje) : (d.situacao ?? "proximo") === "proximo";
}

export function medicacoesComLembrete(todos: Dados[], hoje = hojeYMD()) {
  const semLogs = todos.filter((d) => !d.evento || d.situacao || d.acao);
  return resolverSituacoes(semLogs).filter(
    (d) =>
      d.cuidado === "Medicação" &&
      (d.horarios?.length ?? 0) > 0 &&
      (!d.inicio || d.inicio <= hoje) &&
      medicacaoEmUso(d, hoje) &&
      (!d.diasSemana?.length || d.diasSemana.includes(parseYMD(hoje).getDay())) &&
      d.situacao !== "cancelado",
  );
}

export function horarioDoLog(d: Dados) {
  return d.horario ?? d.titulo.match(/\((\d{2}:\d{2})(?:\s*->|\))/)?.[1];
}

export function doseRegistrada(todos: Dados[], medId: string, dia: string, horario: string) {
  const excluidos = new Set(todos.filter((d) => d.acao === "excluir" && d.parentId).map((d) => d.parentId));
  return todos.find(
    (d) =>
      d.evento && !d.acao && !excluidos.has(d.id) &&
      d.parentId === medId && d.data === dia && horarioDoLog(d) === horario,
  );
}

export const INSISTIR_APOS_MIN = 15;

function somarMinutos(hora: string, min: number) {
  const [h = 0, m = 0] = hora.split(":").map(Number);
  const t = h * 60 + m + min;
  if (t >= 24 * 60) return null;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export type Lembrete = {
  med: Item;
  horario: string;
  hora: string;
  tipo: "lembrete" | "insistir";
};

export function lembretesDoDia(todos: Dados[], dia = hojeYMD()): Lembrete[] {
  const out: Lembrete[] = [];
  for (const med of medicacoesComLembrete(todos, dia)) {
    for (const horario of med.horarios ?? []) {
      if (doseRegistrada(todos, med.id, dia, horario)) continue;
      out.push({ med, horario, hora: horario, tipo: "lembrete" });
      const depois = somarMinutos(horario, INSISTIR_APOS_MIN);
      if (depois) out.push({ med, horario, hora: depois, tipo: "insistir" });
    }
  }
  return out;
}

export const CUIDADOS_COM_VESPERA: Cuidado[] = ["Consulta", "Exame"];
export const HORA_VESPERA_SEM_HORARIO = "09:00";

export function somarDias(ymd: string, dias: number) {
  const d = parseYMD(ymd);
  return toYMD(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias));
}

export function avisosDeVespera(todos: Dados[], dia = hojeYMD()) {
  const amanha = somarDias(dia, 1);
  return resolverSituacoes(todos.filter((d) => !d.evento || d.situacao || d.acao))
    .filter(
      (d) =>
        d.cuidado !== undefined &&
        CUIDADOS_COM_VESPERA.includes(d.cuidado) &&
        d.data === amanha &&
        compromissoPendente(d, dia),
    )
    .map((item) => ({ item, hora: item.hora || HORA_VESPERA_SEM_HORARIO }));
}