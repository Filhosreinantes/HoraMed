// Lembretes de medicação do Rotina Azul.
// Chamada a cada minuto pelo pg_cron. Envia só os lembretes que vencem agora
// (horário de Brasília) e marca cada um em rotina_lembretes_enviados, então
// chamadas extras não geram envios repetidos.
//   {}                          → envia os lembretes devidos
//   { acao: "limpar-agendados" } → cancela no OneSignal os agendamentos do sistema antigo
import { createClient } from "npm:@supabase/supabase-js@2";
import { medicacoesComLembrete, type Dados } from "../../../src/lib/cuidados.ts";

const FUSO = "America/Sao_Paulo";
const JANELA_MIN = 5; // tolera atrasos do cron sem perder lembretes
const ONESIGNAL = "https://api.onesignal.com";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY"))!,
  { auth: { persistSession: false } },
);
const appId = Deno.env.get("ONESIGNAL_APP_ID")!;
const chave = Deno.env.get("ONESIGNAL_REST_KEY")!;
// Chaves novas do OneSignal começam com "os_v2_" e usam "Key"; as antigas, "Basic".
const autorizacao = chave?.startsWith("os_v2_") ? `Key ${chave}` : `Basic ${chave}`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Data (YYYY-MM-DD) e hora (HH:MM) de um instante no fuso de Brasília. */
function emBrasilia(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: FUSO,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

async function enviarPush(userId: string, titulo: string, texto: string, topico: string) {
  const res = await fetch(`${ONESIGNAL}/notifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: autorizacao },
    body: JSON.stringify({
      app_id: appId,
      target_channel: "push",
      include_aliases: { external_id: [userId] },
      headings: { en: titulo, pt: titulo },
      contents: { en: texto, pt: texto },
      url: "/acompanhamento",
      web_push_topic: topico, // o mesmo lembrete nunca aparece duplicado
      priority: 10,
      ttl: 3600, // se o celular estiver desligado, não entrega lembrete velho
    }),
  });
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OneSignal ${res.status}: ${JSON.stringify(corpo)}`);
  // Sem celular inscrito não é erro do sistema: não adianta tentar de novo.
  return { semDispositivo: !corpo.id };
}

async function enviarDevidos() {
  const agora = Date.now();
  const momentos = Array.from({ length: JANELA_MIN }, (_, k) => emBrasilia(new Date(agora - k * 60_000)));
  const dias = [...new Set(momentos.map((m) => m.data))];

  const { data: regs, error } = await db
    .from("pedacinho_registros")
    .select("user_id, pessoa_id, dados")
    .eq("dados->>cuidado", "Medicação");
  if (error) throw new Error(`ler registros: ${error.message}`);

  // Agrupa por usuária: o histórico de cada uma é resolvido separadamente.
  const porUsuaria = new Map<string, Dados[]>();
  for (const r of regs ?? []) {
    const lista = porUsuaria.get(r.user_id) ?? [];
    lista.push(r.dados as Dados);
    porUsuaria.set(r.user_id, lista);
  }

  const devidos: { userId: string; med: Dados; data: string; hora: string }[] = [];
  for (const [userId, todos] of porUsuaria) {
    for (const dia of dias) {
      const horasDoDia = new Set(momentos.filter((m) => m.data === dia).map((m) => m.hora));
      for (const med of medicacoesComLembrete(todos, dia)) {
        for (const hora of med.horarios ?? []) {
          if (horasDoDia.has(hora)) devidos.push({ userId, med, data: dia, hora });
        }
      }
    }
  }
  if (devidos.length === 0) return { enviados: 0 };

  const pessoaIds = [...new Set(devidos.map((d) => d.med.pessoaId))];
  const { data: pessoas } = await db.from("pedacinho_pessoas").select("id, nome").in("id", pessoaIds);
  const nomes = new Map((pessoas ?? []).map((p) => [p.id, p.nome as string]));

  let enviados = 0;
  for (const d of devidos) {
    // Reserva o envio; se outra execução já reservou, pula.
    const { data: reserva } = await db
      .from("rotina_lembretes_enviados")
      .upsert(
        { item_id: d.med.id, data: d.data, horario: d.hora, user_id: d.userId },
        { onConflict: "item_id,data,horario", ignoreDuplicates: true },
      )
      .select("item_id");
    if (!reserva?.length) continue;

    const nome = nomes.get(d.med.pessoaId);
    const remedio = [d.med.medicamento || "a medicação", d.med.dosagem].filter(Boolean).join(" ");
    try {
      const r = await enviarPush(
        d.userId,
        `💊 Hora do remédio${nome ? ` de ${nome}` : ""}`,
        `${d.hora} · ${remedio}`,
        `med-${d.med.id}-${d.data}-${d.hora}`,
      );
      if (r.semDispositivo) console.log(`[lembretes] sem dispositivo inscrito: ${d.userId}`);
      else enviados++;
    } catch (e) {
      // Libera a reserva para a próxima execução (dentro da janela) tentar de novo.
      await db
        .from("rotina_lembretes_enviados")
        .delete()
        .match({ item_id: d.med.id, data: d.data, horario: d.hora });
      console.error("[lembretes]", e);
    }
  }
  return { enviados, devidos: devidos.length };
}

/** Cancela os envios futuros que o sistema antigo (agendar-lembretes) deixou no OneSignal. */
async function limparAgendados() {
  let cancelados = 0;
  for (let offset = 0; offset < 2000; offset += 50) {
    const res = await fetch(`${ONESIGNAL}/notifications?app_id=${appId}&limit=50&offset=${offset}`, {
      headers: { Authorization: autorizacao },
    });
    if (!res.ok) throw new Error(`OneSignal ${res.status}: ${await res.text()}`);
    const { notifications = [] } = await res.json();
    for (const n of notifications) {
      const futuro = n.send_after && n.send_after * 1000 > Date.now();
      if (futuro && !n.canceled && n.headings?.en === "💊 Hora do Remédio!") {
        const del = await fetch(`${ONESIGNAL}/notifications/${n.id}?app_id=${appId}`, {
          method: "DELETE",
          headers: { Authorization: autorizacao },
        });
        if (del.ok) cancelados++;
      }
    }
    if (notifications.length < 50) break;
  }
  return { cancelados };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.acao === "limpar-agendados") return json(await limparAgendados());
    return json(await enviarDevidos());
  } catch (e) {
    console.error("[rotina-azul-lembretes]", e);
    return json({ error: "falha temporária" }, 500);
  }
});
