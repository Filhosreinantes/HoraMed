// Checkout PIX do Rotina Azul.
//   { acao: "criar", nome, email, cpf, plano?, ref? } → cria a intenção + pedido PIX no PagBank
//   { acao: "status", id }                    → status do pagamento (para a tela atualizar sozinha)
import {
  cors,
  dataBrasilia,
  db,
  json,
  MINUTOS_PARA_PAGAR,
  pagbank,
  PLANOS,
  ehPlano,
  sincronizarCheckout,
} from "../_shared/pagbank.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cpfValido(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(cpf[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

function resposta(c: { id: string; status: string; qr_text: string | null; qr_png: string | null; expira_em: string }) {
  return json({ id: c.id, status: c.status, qrText: c.qr_text, qrPng: c.qr_png, expiraEm: c.expira_em });
}

async function criar(body: Record<string, unknown>) {
  const nome = String(body.nome ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const cpf = String(body.cpf ?? "").replace(/\D/g, "");
  const ref = String(body.ref ?? "").trim().slice(0, 64) || null;
  const plano = body.plano ?? "mensal";
  if (!ehPlano(plano)) return json({ error: "Plano inválido." }, 400);
  const { centavos, nome: nomePlano } = PLANOS[plano];

  if (nome.split(/\s+/).length < 2) return json({ error: "Informe seu nome completo." }, 400);
  if (!EMAIL.test(email)) return json({ error: "E-mail inválido." }, 400);
  if (!cpfValido(cpf)) return json({ error: "CPF inválido." }, 400);

  // Reaproveita um PIX ainda válido da mesma pessoa (evita gerar vários pedidos).
  const agora = new Date();
  const { data: aberto } = await db
    .from("rotina_checkouts")
    .select("id, status, qr_text, qr_png, expira_em")
    .eq("email", email)
    .eq("cpf", cpf)
    .eq("status", "pendente")
    .eq("plano", plano)
    .not("qr_text", "is", null)
    .gt("expira_em", new Date(agora.getTime() + 5 * 60_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (aberto) return resposta(aberto);

  // Limite simples contra abuso: no máximo 5 pedidos por CPF por hora.
  const { count } = await db
    .from("rotina_checkouts")
    .select("id", { count: "exact", head: true })
    .eq("cpf", cpf)
    .gt("created_at", new Date(agora.getTime() - 3600_000).toISOString());
  if ((count ?? 0) >= 5) return json({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429);

  const expira = new Date(agora.getTime() + MINUTOS_PARA_PAGAR * 60_000);
  const { data: intencao, error } = await db
    .from("rotina_checkouts")
    .insert({ nome, email, cpf, codigo_ref: ref, valor_centavos: centavos, plano, expira_em: expira.toISOString() })
    .select("id")
    .single();
  if (error || !intencao) throw new Error(`criar intenção: ${error?.message}`);

  const webhook =
    Deno.env.get("ROTINA_WEBHOOK_URL") ?? `${Deno.env.get("SUPABASE_URL")}/functions/v1/rotina-azul-webhook`;

  let pedido;
  try {
    pedido = await pagbank("/orders", {
      method: "POST",
      headers: { "x-idempotency-key": intencao.id },
      body: JSON.stringify({
        reference_id: intencao.id,
        customer: { name: nome, email, tax_id: cpf },
        items: [{ reference_id: `rotina-azul-${plano}`, name: `Rotina Azul - ${nomePlano}`, quantity: 1, unit_amount: centavos }],
        qr_codes: [{ amount: { value: centavos }, expiration_date: dataBrasilia(expira) }],
        notification_urls: [webhook],
      }),
    });
  } catch (e) {
    await db.from("rotina_checkouts").update({ status: "falhou" }).eq("id", intencao.id);
    throw e;
  }

  const qr = pedido.qr_codes?.[0];
  // deno-lint-ignore no-explicit-any
  const png = qr?.links?.find((l: any) => l.rel === "QRCODE.PNG")?.href ?? null;
  const { data: c, error: errUpd } = await db
    .from("rotina_checkouts")
    .update({ pagbank_order_id: pedido.id, qr_text: qr?.text ?? null, qr_png: png })
    .eq("id", intencao.id)
    .select("id, status, qr_text, qr_png, expira_em")
    .single();
  if (errUpd || !c) throw new Error(`salvar pedido: ${errUpd?.message}`);
  if (!c.qr_text) throw new Error(`PagBank não devolveu QR Code no pedido ${pedido.id}`);
  return resposta(c);
}

async function status(body: Record<string, unknown>) {
  const id = String(body.id ?? "");
  if (!UUID.test(id)) return json({ error: "id inválido" }, 400);

  const { data: c } = await db
    .from("rotina_checkouts")
    .select("status, verificado_em")
    .eq("id", id)
    .maybeSingle();
  if (!c) return json({ error: "não encontrado" }, 404);

  // O webhook costuma confirmar antes; consultamos o PagBank no máximo a cada 15 s como reserva.
  const recente = c.verificado_em && Date.now() - new Date(c.verificado_em).getTime() < 15_000;
  if (c.status !== "pendente" || recente) return json({ status: c.status });
  return json({ status: await sincronizarCheckout(id) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    if (body.acao === "criar") return await criar(body);
    if (body.acao === "status") return await status(body);
    return json({ error: "ação inválida" }, 400);
  } catch (e) {
    console.error("[rotina-azul-checkout]", e);
    return json({ error: "Não foi possível gerar o PIX. Tente novamente." }, 500);
  }
});
