// Notificação do PagBank para os pedidos PIX do Rotina Azul.
// O corpo só serve para descobrir QUAL pedido mudou: a confirmação vem de uma
// consulta à API do PagBank com o nosso token, então uma notificação forjada
// não libera nada. Precisa ser publicada com --no-verify-jwt.
import { cors, db, json, sincronizarCheckout } from "../_shared/pagbank.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const corpo = await req.json().catch(() => null);
  const referencia = String(corpo?.reference_id ?? "");
  const pedidoId = String(corpo?.id ?? "");
  if (!UUID.test(referencia)) return json({ status: "ignorado" });

  // Confere que a notificação aponta para o pedido que nós mesmos criamos.
  const { data: c } = await db
    .from("rotina_checkouts")
    .select("id, pagbank_order_id")
    .eq("id", referencia)
    .maybeSingle();
  if (!c || c.pagbank_order_id !== pedidoId) return json({ status: "ignorado" });

  try {
    const status = await sincronizarCheckout(c.id);
    console.log(`[rotina-azul-webhook] checkout ${c.id}: ${status}`);
    return json({ status });
  } catch (e) {
    // 500 faz o PagBank reenviar mais tarde.
    console.error("[rotina-azul-webhook]", e);
    return json({ error: "falha temporária" }, 500);
  }
});
