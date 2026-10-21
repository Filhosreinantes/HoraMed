import { useState } from "react";
import { Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import { adiarAlarme, ehAppAndroid } from "@/lib/alarmes";
import { doseRegistrada, hojeYMD, nowLocalISO, uid, type Dados, type Item } from "@/lib/cuidados";

const ADIAR_MIN = 10;

/**
 * Horário da dose que está sendo registrada: o do card (doses de hoje) ou, no card
 * da medicação, a dose pendente mais recente já vencida, senão a próxima.
 */
function horarioDaDose(item: Item, logs: Dados[], hoje: string) {
  const horarios = [...(item.horarios ?? [])].sort();
  if (item.hora && horarios.includes(item.hora)) return item.hora;
  const agora = nowLocalISO().slice(11, 16);
  const pendentes = horarios.filter((h) => !doseRegistrada(logs, item.id, hoje, h));
  return pendentes.filter((h) => h <= agora).at(-1) ?? pendentes[0];
}

export function AlarmeModal({ item, fechar }: { item: Item, fechar: () => void }) {
  const { salvarRegistros, logs } = useApp();
  const [salvando, setSalvando] = useState(false);
  const hoje = hojeYMD();
  const horario = horarioDaDose(item, logs, hoje);

  const registrarTomada = async () => {
    setSalvando(true);
    // Com o horário, a dose conta como registrada e o segundo aviso (15 min) não toca.
    const dados: Dados = {
      id: uid(),
      pessoaId: item.pessoaId,
      criadoEm: nowLocalISO(),
      titulo: horario ? `Tomou: ${item.medicamento} (${horario})` : `Tomou: ${item.medicamento}`,
      cuidado: "Medicação_Log" as any,
      evento: true,
      parentId: item.id,
      data: hoje,
      horario,
    };

    let ok = await salvarRegistros([dados], "medicacao_logs");

    // Desconto de estoque (se existir e não for ml): vai em "acontecimentos",
    // porque o app-store só aplica edições vindas dessa tabela.
    if (ok && item.estoqueAtual !== undefined && item.dosagemUnidade !== "ml") {
      const qtdTomada = Number(item.dosagemValor || 1);
      const novoEstoque = Math.max(0, item.estoqueAtual - qtdTomada);
      ok = await salvarRegistros([{
        id: uid(),
        pessoaId: item.pessoaId,
        criadoEm: nowLocalISO(),
        titulo: "Atualização de estoque",
        cuidado: item.cuidado,
        evento: true,
        parentId: item.id,
        acao: "editar",
        alteracoes: { estoqueAtual: novoEstoque },
      }], "acontecimentos");
    }
    setSalvando(false);

    if (ok) {
      toast.success("Boa! Remédio registrado.");
      fechar();
    }
  };

  // Adiar não registra nada: a dose segue pendente e o alarme toca de novo.
  const adiar = async () => {
    try {
      await adiarAlarme(
        `💊 Hora do remédio${horario ? ` das ${horario}` : ""}`,
        [item.medicamento, item.dosagem].filter(Boolean).join(" "),
        ADIAR_MIN,
      );
      toast.success(`O alarme toca de novo em ${ADIAR_MIN} minutos.`);
      fechar();
    } catch (e) {
      console.error("Erro ao adiar:", e);
      toast.error("Não foi possível adiar o alarme.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm space-y-6 rounded-3xl bg-white p-6 shadow-2xl text-center">
        
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600 animate-pulse">
          <Clock className="h-10 w-10" />
        </div>

        <div>
          <p className="text-sm font-bold text-red-500 uppercase tracking-widest">Alarme Tocando</p>
          <h2 className="mt-1 font-display text-3xl font-bold text-foreground">{item.medicamento}</h2>
          <p className="mt-1 text-muted-foreground">{item.dosagem || "Dose padrão"}</p>
        </div>

        {(item.fotoUrl || item.fotoPilula) && (
          <div className="flex justify-center gap-2">
            {item.fotoUrl && <img src={item.fotoUrl} className="h-24 w-24 rounded-xl object-cover border" />}
            {item.fotoPilula && <img src={item.fotoPilula} className="h-24 w-24 rounded-xl object-cover border" />}
          </div>
        )}

        <div className="space-y-3 pt-4">
          <button
            onClick={registrarTomada}
            disabled={salvando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-lg font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-50"
          >
            <Check className="h-6 w-6" /> Já Tomei
          </button>
          
          {ehAppAndroid() && (
          <button
            onClick={adiar}
            disabled={salvando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-orange-200 bg-orange-50 py-3 text-sm font-bold text-orange-600 transition hover:bg-orange-100 disabled:opacity-50"
          >
            <Clock className="h-4 w-4" /> Adiar {ADIAR_MIN} minutos
          </button>
          )}

          <button onClick={fechar} className="text-xs text-muted-foreground underline mt-2">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}