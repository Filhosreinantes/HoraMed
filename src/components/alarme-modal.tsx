import { useState } from "react";
import { Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-store";
import { nowLocalISO, uid, type Item } from "@/lib/cuidados";

export function AlarmeModal({ item, fechar }: { item: Item, fechar: () => void }) {
  const { salvarRegistros } = useApp();
  const [salvando, setSalvando] = useState(false);

  const registrarTomada = async (adiar = false) => {
    setSalvando(true);
    const acao = adiar ? "Adiou 10 min" : "Tomou";
    const titulo = `${acao}: ${item.medicamento}`;
    
    const dados = {
      id: uid(), 
      pessoaId: item.pessoaId, 
      criadoEm: nowLocalISO(), 
      titulo,
      cuidado: "Medicação_Log" as any, 
      evento: true, 
      parentId: item.id, 
      data: nowLocalISO().slice(0, 10),
    };

    const ok = await salvarRegistros([dados], "medicacao_logs");
    setSalvando(false);

    if (ok) {
      toast.success(adiar ? "Alarme adiado por 10 minutos!" : "Boa! Remédio registrado.");
      fechar();
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
            onClick={() => registrarTomada(false)}
            disabled={salvando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 py-4 text-lg font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-50"
          >
            <Check className="h-6 w-6" /> Já Tomei
          </button>
          
          <button
            onClick={() => registrarTomada(true)}
            disabled={salvando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-orange-200 bg-orange-50 py-3 text-sm font-bold text-orange-600 transition hover:bg-orange-100 disabled:opacity-50"
          >
            <Clock className="h-4 w-4" /> Adiar 10 minutos
          </button>

          <button onClick={fechar} className="text-xs text-muted-foreground underline mt-2">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}