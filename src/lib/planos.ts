// Planos do Rotina Azul. Arquivo sem dependências: o app usa para mostrar os planos e as
// Edge Functions (supabase/functions/_shared/pagbank.ts) usam para cobrar. O preço e o
// prazo que valem são sempre os do servidor; o app só informa o id do plano.
export type PlanoId = "mensal" | "anual" | "vitalicio";

export const PLANOS: Record<
  PlanoId,
  { nome: string; descricao: string; centavos: number; cobranca: string; dias: number }
> = {
  anual: {
    nome: "Plano Anual",
    descricao: "O melhor custo-benefício (50% de desconto)",
    centavos: 5999,
    cobranca: "Cobrado anualmente",
    dias: 365,
  },
  mensal: {
    nome: "Plano Mensal",
    descricao: "Acesso completo",
    centavos: 999,
    cobranca: "Cobrado mensalmente",
    dias: 30,
  },
  vitalicio: {
    nome: "Acesso Vitalício",
    descricao: "Pague uma vez, use para sempre",
    centavos: 14999,
    cobranca: "Pagamento único",
    // Cem anos: a assinatura guarda uma data de fim, então "para sempre" é uma data distante.
    dias: 36500,
  },
};

export const ORDEM_PLANOS: PlanoId[] = ["anual", "mensal", "vitalicio"];

export function ehPlano(v: unknown): v is PlanoId {
  return typeof v === "string" && v in PLANOS;
}

export function reais(centavos: number) {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

/** Datas de fim a partir de 2100 são o acesso vitalício. */
export function ehVitalicio(fimIso: string) {
  return new Date(fimIso).getFullYear() >= 2100;
}
