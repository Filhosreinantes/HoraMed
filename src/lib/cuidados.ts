export type Cuidado = "Consulta" | "Terapia" | "Exame" | "Medicação";
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
  tipoTerapia?: string | undefined;
  tipoExame?: string | undefined;
  recomendacoes?: string | undefined;
  medicamento?: string | undefined;
  dosagem?: string | undefined;
  frequencia?: string | undefined;
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
}

export const EMOJI: Record<Cuidado, string> = {
  Consulta: "🩺",
  Terapia: "🌿",
  Exame: "📄",
  Medicação: "💊",
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

/** Local YYYY-MM-DD (never toISOString). */
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

/** Generates the session dates for a therapy program. */
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
  return [d.profissional, d.especialidade || d.tipoTerapia || d.tipoExame, d.local].filter(Boolean).join(" · ");
}

export function tituloEvento(original: Dados, situacao: Situacao) {
  const partes = [original.cuidado, original.profissional, original.especialidade || original.tipoTerapia || original.tipoExame]
    .filter(Boolean)
    .join(" · ");
  const quando = [formatData(original.data), original.hora].filter(Boolean).join(" · ");
  return `${SITUACAO_LABEL[situacao]}: ${partes}${quando ? `, seria dia ${quando}` : ""}`;
}

/** Original items with effective situation derived from immutable event records. */
export function resolverSituacoes(todos: Dados[]) {
  const eventos = todos.filter((d) => d.evento && d.parentId);
  const ultimo = new Map<string, Dados>();
  for (const e of eventos) {
    const prev = ultimo.get(e.parentId!);
    if (!prev || e.criadoEm > prev.criadoEm) ultimo.set(e.parentId!, e);
  }
  return todos
    .filter((d) => !d.evento)
    .map((d) => {
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
