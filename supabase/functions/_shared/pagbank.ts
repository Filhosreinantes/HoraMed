// Código compartilhado pelas funções do checkout PIX do Rotina Azul.
import { createClient } from "npm:@supabase/supabase-js@2";

// Preço e prazo de cada plano vêm de src/lib/planos.ts e nunca do navegador (ele só diz o id).
export { PLANOS, ehPlano, type PlanoId } from "../../../src/lib/planos.ts";
export const MINUTOS_PARA_PAGAR = 30;

const sandbox = Deno.env.get("ROTINA_PAGBANK_SANDBOX") === "true";
const PAGBANK_URL = sandbox ? "https://sandbox.api.pagseguro.com" : "https://api.pagseguro.com";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY"))!,
  { auth: { persistSession: false } },
);

function token() {
  const t = Deno.env.get("ROTINA_PAGBANK_TOKEN");
  if (!t) throw new Error("ROTINA_PAGBANK_TOKEN não configurado");
  return t;
}

export async function pagbank(path: string, init: RequestInit = {}) {
  const res = await fetch(`${PAGBANK_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`PagBank ${res.status}: ${texto}`);
  return JSON.parse(texto);
}

/** Data no formato que o PagBank exige (offset de Brasília, sem horário de verão). */
export function dataBrasilia(d: Date) {
  return new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 19) + "-03:00";
}

/**
 * Consulta o pedido no PagBank (fonte da verdade) e, se houver cobrança PAID,
 * confirma no banco. Retorna o status final do checkout.
 */
export async function sincronizarCheckout(checkoutId: string): Promise<string> {
  const { data: c } = await db
    .from("rotina_checkouts")
    .select("id, status, pagbank_order_id, expira_em")
    .eq("id", checkoutId)
    .maybeSingle();
  if (!c) return "nao_encontrado";
  if (c.status === "pago" || !c.pagbank_order_id) return c.status;

  await db.from("rotina_checkouts").update({ verificado_em: new Date().toISOString() }).eq("id", c.id);

  const pedido = await pagbank(`/orders/${encodeURIComponent(c.pagbank_order_id)}`);
  if (pedido.reference_id !== c.id) throw new Error(`reference_id divergente no pedido ${pedido.id}`);

  // deno-lint-ignore no-explicit-any
  const paga = (pedido.charges ?? []).find((ch: any) => ch.status === "PAID");
  if (paga) {
    const valor = Number(paga.amount?.summary?.paid ?? paga.amount?.value ?? 0);
    const pct = Number(Deno.env.get("ROTINA_COMISSAO_PCT") ?? "30");
    const { error } = await db.rpc("rotina_confirmar_pagamento", {
      p_checkout: c.id,
      p_charge_id: paga.id,
      p_valor_centavos: valor,
      p_comissao_pct: pct,
    });
    if (error) throw new Error(`confirmar pagamento: ${error.message}`);
    return "pago";
  }

  if (new Date(c.expira_em).getTime() < Date.now() - 5 * 60_000) {
    await db.from("rotina_checkouts").update({ status: "expirado" }).eq("id", c.id).eq("status", "pendente");
    return "expirado";
  }
  return c.status;
}
