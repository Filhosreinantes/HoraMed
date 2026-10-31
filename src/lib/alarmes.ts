// Lembretes no app Android: o app calcula os alarmes (mesmas regras do servidor:
// lembretesDoDia / avisosDeVespera) e entrega ao código nativo, que toca a tela de
// alarme no horário, com som em loop, mesmo sem internet. Não depende do OneSignal.
import { registerPlugin } from "@capacitor/core";
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

/** Dias à frente: os alarmes continuam tocando mesmo sem abrir o app nesse período. */
const DIAS = 14;
/** Folga para o limite de alarmes guardados no celular. */
const MAXIMO = 400;

/** Um alarme como o código nativo guarda (AlarmeStore.java). */
export type AlarmeNativo = {
  id: number;
  /** Quando toca, em milissegundos. */
  at: number;
  /** "dose" e "insistir" tocam a tela de alarme; "vespera" é um aviso comum; "adiado" vem do botão Adiar. */
  kind: "dose" | "insistir" | "adiado" | "vespera";
  title: string;
  body: string;
  medId?: string;
  pessoaId?: string;
  /** Horário e data da dose (para registrá-la como tomada). */
  horario?: string;
  data?: string;
  medicamento?: string;
  dosagem?: string;
  pessoa?: string;
};

/** Dose marcada como tomada na tela de alarme, esperando ser gravada no servidor. */
export type DoseTomada = {
  chave: string;
  medId: string;
  pessoaId: string;
  horario: string;
  data: string;
  medicamento?: string;
};

interface ConfiabilidadePlugin {
  agendar(opcoes: { alarmes: AlarmeNativo[] }): Promise<void>;
  limpar(): Promise<void>;
  adiar(opcoes: { alarme: AlarmeNativo; minutos: number }): Promise<void>;
  consumirDoses(): Promise<{ doses: DoseTomada[] }>;
  confirmarDoses(opcoes: { chaves: string[] }): Promise<void>;
  status(): Promise<Confiabilidade>;
  pedirNotificacoes(): Promise<void>;
  abrirTelaCheia(): Promise<void>;
  abrirBateria(): Promise<void>;
  abrirConfiguracoes(): Promise<void>;
}
const Confiabilidade = registerPlugin<ConfiabilidadePlugin>("Confiabilidade");

/** Id numérico estável (o Android usa int de 32 bits) a partir de uma chave. */
function idDe(chave: string) {
  let h = 5381;
  for (let i = 0; i < chave.length; i++) h = ((h << 5) + h + chave.charCodeAt(i)) | 0;
  return h & 0x7fffffff;
}

function quando(dia: string, hora: string) {
  const d = parseYMD(dia);
  const [h = 0, m = 0] = hora.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** Os alarmes dos próximos DIAS, com os mesmos textos das notificações do servidor. */
export function calcularAlarmes(
  todos: Dados[],
  pessoas: Pessoa[],
  agora = Date.now(),
): AlarmeNativo[] {
  const nomes = new Map(pessoas.map((p) => [p.id, p.nome]));
  const hoje = hojeYMD();
  const out: AlarmeNativo[] = [];
  for (let i = 0; i < DIAS; i++) {
    const dia = somarDias(hoje, i);
    for (const { med, horario, hora, tipo } of lembretesDoDia(todos, dia)) {
      const medFormatada = [med.medicamento || "a medicação", med.dosagem].filter(Boolean).join(" ");
      const pessoa = nomes.get(med.pessoaId);
      const de = pessoa ? ` de ${pessoa}` : "";
      
      // Textos das notificações adaptados para o horaMed
      const [title, body] =
        tipo === "insistir"
          ? [
              `⏰ Dose das ${horario} ainda não registrada`,
              `${medFormatada}${de}. Toque para registrar.`,
            ]
          : [`💊 Hora da medicação${de}`, `${horario} · ${medFormatada}`];
          
      out.push({
        id: idDe(`med-${med.id}-${dia}-${horario}-${tipo}`),
        at: quando(dia, hora),
        kind: tipo === "insistir" ? "insistir" : "dose",
        title,
        body,
        medId: med.id,
        pessoaId: med.pessoaId,
        horario,
        data: dia,
        ...(med.medicamento && { medicamento: med.medicamento }),
        ...(med.dosagem && { dosagem: med.dosagem }),
        ...(pessoa && { pessoa }),
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
        kind: "vespera",
        title: `📅 Amanhã: ${tituloEvento(item, "proximo")}`,
        body,
      });
    }
  }
  return out
    .filter((a) => a.at > agora)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAXIMO);
}

let fila = Promise.resolve();

/** Substitui os alarmes agendados pelos calculados agora. Sem efeito fora do app. */
export function agendarAlarmes(todos: Dados[], pessoas: Pessoa[]) {
  if (!ehAppAndroid()) return Promise.resolve();
  // Uma reprogramação por vez, na ordem em que foram pedidas.
  fila = fila
    .then(() => Confiabilidade.agendar({ alarmes: calcularAlarmes(todos, pessoas) }))
    .catch((e) => console.error("Erro ao agendar alarmes:", e));
  return fila;
}

/** Cancela tudo (ao sair da conta). */
export async function limparAlarmes() {
  if (ehAppAndroid()) await Confiabilidade.limpar();
}

/** "Adiar" dentro do app: o alarme toca de novo; a dose continua pendente. */
export function adiarAlarme(alarme: Omit<AlarmeNativo, "id" | "at" | "kind">, minutos: number) {
  return Confiabilidade.adiar({
    alarme: { ...alarme, id: 0, at: 0, kind: "adiado" },
    minutos,
  });
}

/** Doses que o usuário marcou como tomadas na tela de alarme e o app ainda não gravou. */
export async function dosesTomadasNoAlarme() {
  if (!ehAppAndroid()) return [];
  return (await Confiabilidade.consumirDoses()).doses;
}

export const confirmarDosesGravadas = (chaves: string[]) =>
  Confiabilidade.confirmarDoses({ chaves });

export type Confiabilidade = {
  notificacoes: boolean;
  telaCheia: boolean;
  bateria: boolean;
};

export const verificarConfiabilidade = () => Confiabilidade.status();
export const corrigirNotificacoes = () => Confiabilidade.pedirNotificacoes();
export const corrigirTelaCheia = () => Confiabilidade.abrirTelaCheia();
export const corrigirBateria = () => Confiabilidade.abrirBateria();