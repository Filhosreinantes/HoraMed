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
  horarios?: string[] | undefined;
  fotoUrl?: string | undefined;      // ✅ NOVO
  fotoPilula?: string | undefined;   // ✅ NOVO
  diasSemana?: number[] | undefined; // ✅ NOVO
  /** Dose log: the scheduled time this record refers to ("08:00"). */
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
  /** Change event: edits the parent's fields or removes it, keeping the original intact. */
  acao?: "editar" | "excluir" | undefined;
  alteracoes?: Partial<Dados> | undefined;
}

// ... (O RESTO DO ARQUIVO CONTINUA EXATAMENTE IGUAL AO SEU) ...