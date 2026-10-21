// Lembretes no app Android: alarmes agendados no próprio celular, com as mesmas
// regras do servidor (lembretesDoDia / avisosDeVespera). Tocam sem internet e não
// dependem do OneSignal, que não funciona dentro do app.
import { registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  avisosDeVespera,
  hojeYMD,
  lembretesDoDia,
  parseYMD,
  somarDias,
  tituloEvento,
  type Dados,
  type Pessoa,
} from "./cuidados";
import { ehAppAndroid } from "./plataforma";

export { ehAppAndroid };

/** Canal criado pelo ConfiabilidadePlugin.java (som de alarme). */
const CANAL = "lembretes";
/** Dias à frente: os alarmes continuam tocando mesmo sem abrir o app nesse período. */
const DIAS = 14;
/** O Android limita os alarmes pendentes de um app (500); sobra folga. */
const MAXIMO = 400;

interface ConfiabilidadePlugin {
  status(): Promise<{ bateriaLiberada: boolean }>;
  abrirBateria(): Promise<void>;
  abrirConfiguracoes(): Promise<void>;
}
const Confiabilidade = registerPlugin<ConfiabilidadePlugin>("Confiabilidade");

/** Id numérico estável (o Android exige int de 32 bits) a partir de uma chave. */
function idDe(chave: string) {
  let h = 5381;
  for (let i = 0; i < chave.length; i++) h = ((h << 5) + h + chave.charCodeAt(i)) | 0;
  return h & 0x7fffffff;
}

function quando(dia: string, hora: string) {
  const d = parseYMD(dia);
  const [h = 0, m = 0] = hora.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

type Alarme = { id: number; at: Date; title: string; body: string };

/** Os alarmes dos próximos DIAS, com os mesmos textos das notificações do servidor. */
export function calcularAlarmes(todos: Dados[], pessoas: Pessoa[], agora = new Date()): Alarme[] {
  const nomes = new Map(pessoas.map((p) => [p.id, p.nome]));
  const de = (pessoaId: string) => (nomes.get(pessoaId) ? ` de ${nomes.get(pessoaId)}` : "");
  const hoje = hojeYMD();
  const out: Alarme[] = [];
  for (let i = 0; i < DIAS; i++) {
    const dia = somarDias(hoje, i);
    for (const { med, horario, hora, tipo } of lembretesDoDia(todos, dia)) {
      const remedio = [med.medicamento || "a medicação", med.dosagem].filter(Boolean).join(" ");
      const [title, body] =
        tipo === "insistir"
          ? [
              `⏰ Dose das ${horario} ainda não registrada`,
              `${remedio}${de(med.pessoaId)}. Toque para registrar.`,
            ]
          : [`💊 Hora do remédio${de(med.pessoaId)}`, `${horario} · ${remedio}`];
      out.push({
        id: idDe(`med-${med.id}-${dia}-${horario}-${tipo}`),
        at: quando(dia, hora),
        title,
        body,
      });
    }
    for (const { item, hora } of avisosDeVespera(todos, dia)) {
      const nome = nomes.get(item.pessoaId);
      const body = [item.hora ? `Às ${item.hora}` : "Amanhã", item.local, nome && `para ${nome}`]
        .filter(Boolean)
        .join(" · ");
      out.push({
        id: idDe(`vespera-${item.id}`),
        at: quando(dia, hora),
        title: `📅 Amanhã: ${tituloEvento(item, "proximo")}`,
        body,
      });
    }
  }
  return out
    .filter((a) => a.at > agora)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAXIMO);
}

let fila = Promise.resolve();

/** Substitui os alarmes agendados pelos calculados agora. Sem efeito fora do app. */
export function agendarAlarmes(todos: Dados[], pessoas: Pessoa[]) {
  if (!ehAppAndroid()) return Promise.resolve();
  // Uma reprogramação por vez: duas em paralelo poderiam cancelar o que a outra agendou.
  fila = fila
    .then(async () => {
      const alarmes = calcularAlarmes(todos, pessoas);
      const novos = new Set(alarmes.map((a) => a.id));
      const { notifications: pendentes } = await LocalNotifications.getPending();
      const velhos = pendentes.filter((p) => !novos.has(p.id));
      if (velhos.length)
        await LocalNotifications.cancel({ notifications: velhos.map((p) => ({ id: p.id })) });
      if (!alarmes.length) return;
      // Sem a permissão, o plugin abriria a tela de configurações a cada reagendamento.
      const exato =
        (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === "granted";
      await LocalNotifications.schedule({
        notifications: alarmes.map((a) => ({
          ...a,
          channelId: CANAL,
          smallIcon: "ic_stat_lembrete",
          schedule: { at: a.at, allowWhileIdle: true },
          isExactNotification: exato,
        })),
      });
    })
    .catch((e) => console.error("Erro ao agendar alarmes:", e));
  return fila;
}

/** Cancela tudo (ao sair da conta). */
export async function limparAlarmes() {
  if (!ehAppAndroid()) return;
  const { notifications } = await LocalNotifications.getPending();
  if (notifications.length)
    await LocalNotifications.cancel({ notifications: notifications.map((p) => ({ id: p.id })) });
}

export type Confiabilidade = {
  notificacoes: boolean;
  alarmeExato: boolean;
  bateria: boolean;
};

export async function verificarConfiabilidade(): Promise<Confiabilidade> {
  const [notif, exato, { bateriaLiberada }] = await Promise.all([
    LocalNotifications.checkPermissions(),
    LocalNotifications.checkExactNotificationSetting(),
    Confiabilidade.status(),
  ]);
  return {
    notificacoes: notif.display === "granted",
    alarmeExato: exato.exact_alarm === "granted",
    bateria: bateriaLiberada,
  };
}

/** Pede a permissão; se já foi negada de vez, o Android só deixa mudar nas configurações. */
export async function corrigirNotificacoes() {
  const { display } = await LocalNotifications.requestPermissions();
  if (display !== "granted") await Confiabilidade.abrirConfiguracoes();
}

export const corrigirAlarmeExato = () => LocalNotifications.changeExactNotificationSetting();
export const corrigirBateria = () => Confiabilidade.abrirBateria();

/** Toca de novo daqui a `minutos` (botão "Adiar"); a dose continua pendente. */
export async function adiarAlarme(titulo: string, texto: string, minutos: number) {
  await LocalNotifications.schedule({
    notifications: [
      {
        id: idDe(`adiado-${Date.now()}`),
        title: titulo,
        body: texto,
        channelId: CANAL,
        smallIcon: "ic_stat_lembrete",
        schedule: { at: new Date(Date.now() + minutos * 60_000), allowWhileIdle: true },
        isExactNotification:
          (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === "granted",
      },
    ],
  });
}

/** Dispara um alarme de teste daqui a 5 segundos. */
export async function testarAlarme() {
  await LocalNotifications.schedule({
    notifications: [
      {
        id: idDe(`teste-${Date.now()}`),
        title: "🔔 Teste do Rotina Azul",
        body: "Está tudo certo! Os lembretes vão tocar assim.",
        channelId: CANAL,
        smallIcon: "ic_stat_lembrete",
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
        isExactNotification: false,
      },
    ],
  });
}
