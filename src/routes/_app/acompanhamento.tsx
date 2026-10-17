import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Calendar, Check, ChevronDown, ChevronRight, Clock,
  ArrowLeft, UserX, X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Textarea } from "@/components/ui/textarea";
import { useStore, formatarData, situacaoDe, uid, type Acontecimento } from "@/lib/store";

export const Route = createFileRoute("/acompanhamento")({
  head: () => ({ meta: [{ title: "Acompanhamento — Rotina Azul" }] }),
  component: Acompanhamento,
});

const ROTULOS_CUIDADO: Record<string, { emoji: string; cor: string; fundo: string }> = {
  Consulta: { emoji: "🩺", cor: "#3D6E9E", fundo: "#E8F1F9" },
  Terapia: { emoji: "🌿", cor: "#3D8064", fundo: "#DCF0E7" },
  Exame: { emoji: "📄", cor: "#8B6F1F", fundo: "#F5EBD0" },
  Medicação: { emoji: "💊", cor: "#A85875", fundo: "#FBE5EC" },
  Escola: { emoji: "🏫", cor: "#4A6B8A", fundo: "#F0F3F7" },
  Igreja: { emoji: "⛪", cor: "#6B5EA0", fundo: "#EDE7F5" },
  Lazer: { emoji: "🎈", cor: "#A85875", fundo: "#FBE5EC" },
  Alimentação: { emoji: "🍽️", cor: "#8B6F1F", fundo: "#F5EBD0" },
  Sono: { emoji: "🌙", cor: "#6B5EA0", fundo: "#EDE7F5" },
  Evacuação: { emoji: "💩", cor: "#3D8064", fundo: "#E3EDE5" },
  Humor: { emoji: "💛", cor: "#A85875", fundo: "#FBE5EC" },
};

function hoje() { return new Date().toISOString().slice(0, 10); }

function ehCompromisso(cuidado?: string | null): boolean {
  return cuidado != null && ["Consulta", "Terapia", "Exame", "Medicação"].includes(cuidado);
}

function rotuloCompromisso(a: Acontecimento): string {
  const t = (a.titulo || "").trim();
  if (t && t !== "Um acontecimento" && t !== "Consulta ·" && t !== "Terapia ·") return t;

  if (a.cuidado === "Consulta") {
    const profissional = a.profissional?.trim();
    const especialidade = a.especialidade?.trim();
    if (profissional && especialidade) return `Consulta com ${profissional} (${especialidade})`;
    if (profissional) return `Consulta com ${profissional}`;
    if (especialidade) return `Consulta de ${especialidade}`;
    return "Consulta";
  }
  if (a.cuidado === "Terapia") return a.tipoTerapia ? `Terapia: ${a.tipoTerapia}` : "Terapia";
  if (a.cuidado === "Exame") return a.tipoExame ? `Exame: ${a.tipoExame}` : "Exame";
  if (a.cuidado === "Medicação") return a.medicamento ? a.medicamento : "Medicação";
  return "Compromisso";
}

function Acompanhamento() {
  const { estado, addItem } = useStore();
  const [filtro, setFiltro] = useState<"mes" | "ano" | "tudo">("mes");
  const [drillDown, setDrillDown] = useState<{ tipo: string; filtro: string } | null>(null);
  const [obsModal, setObsModal] = useState<{ id: string; obs: string; sit: any } | null>(null);

  const agenda = useMemo(() => {
    return (estado.acontecimentos || []).filter((a) =>
      (a.acompanhar || a.compromisso || a.cuidado) && !a.programa && !a.evento
    );
  }, [estado.acontecimentos]);

  const hj = hoje();
  const dentroPeriodo = (a: Acontecimento) => {
    if (filtro === "tudo") return true;
    if (filtro === "mes") return a.data.startsWith(hj.slice(0, 7));
    return a.data.startsWith(hj.slice(0, 4));
  };

  const filtrados = agenda.filter(dentroPeriodo);

  const contarPor = (tipo: string) => {
    const doTipo = filtrados.filter((a) => a.cuidado === tipo);
    return {
      total: doTipo.length,
      compareceu: doTipo.filter((a) => situacaoDe(a, estado.acontecimentos) === "feito").length,
      cancelado: doTipo.filter((a) => situacaoDe(a, estado.acontecimentos) === "cancelado").length,
      faltou: doTipo.filter((a) => situacaoDe(a, estado.acontecimentos) === "faltou").length,
      proximo: doTipo.filter((a) => situacaoDe(a, estado.acontecimentos) === "proximo").length,
    };
  };

  const getListaDrill = () => {
    if (!drillDown) return [];
    let lista = filtrados.filter((a) => a.cuidado === drillDown.tipo);
    if (drillDown.filtro !== "total") {
      lista = lista.filter((a) => situacaoDe(a, estado.acontecimentos) === drillDown.filtro);
    }
    return lista.sort((a, b) => `${a.data} ${a.hora || "00:00"}`.localeCompare(`${b.data} ${b.hora || "00:00"}`));
  };

  const proximosGerais = filtrados
    .filter((a) => situacaoDe(a, estado.acontecimentos) === "proximo")
    .sort((a, b) => `${a.data} ${a.hora || "00:00"}`.localeCompare(`${b.data} ${b.hora || "00:00"}`));

  const salvarSituacao = (item: Acontecimento, novaSit: any, obs: string) => {
    const agora = new Date();
    const dataHoje = agora.toISOString().slice(0, 10);
    const horaAgora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
    const tituloEvento = `${novaSit === 'feito' ? 'Compareceu' : novaSit === 'faltou' ? 'Faltou' : 'Cancelou'}: ${rotuloCompromisso(item)}`;
    
    addItem("acontecimentos", {
      id: uid(), pessoaId: item.pessoaId, parentId: item.id, evento: true, cuidado: "Evento",
      titulo: tituloEvento, detalhes: obs || undefined, data: dataHoje, hora: horaAgora,
      compromisso: false, acompanhar: false, situacao: novaSit, concluido: novaSit === "feito",
      criadoEm: `${dataHoje} ${horaAgora}`,
    });
    setObsModal(null);
  };

  const CardContagem = ({ tipo }: { tipo: string }) => {
    const info = ROTULOS_CUIDADO[tipo]!;
    const c = contarPor(tipo);
    const Btn = ({ chave, rotulo, emoji, qtd }: any) => (
      <button onClick={() => setDrillDown({ tipo, filtro: chave })} className="flex items-center gap-1.5 rounded-lg bg-[#F8FAFC] px-2 py-1 text-[0.68rem] hover:bg-gray-100">
        <span>{emoji}</span> <span className="flex-1 text-left text-[#7A8A9A]">{rotulo}</span> <span className="font-bold">{qtd}</span>
      </button>
    );
    return (
      <div className="rounded-2xl border border-[rgba(91,146,199,0.12)] p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[0.95rem]">{info.emoji}</span>
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider" style={{ color: info.cor }}>{tipo}</p>
          <span className="ml-auto font-bold text-[#2C4A6B]">{c.total}</span>
        </div>
        <div className="space-y-1">
          <Btn chave="proximo" rotulo="Próximos" emoji="⏰" qtd={c.proximo} />
          <Btn chave="feito" rotulo="Compareceu" emoji="✓" qtd={c.compareceu} />
          <Btn chave="faltou" rotulo="Faltou" emoji="—" qtd={c.faltou} />
          <Btn chave="cancelado" rotulo="Cancelou" emoji="✗" qtd={c.cancelado} />
        </div>
      </div>
    );
  };

  return (
    <AppShell titulo="Acompanhamento" subtitulo="Sua agenda de cuidados">
      <section className="bloco-tema">
        <div className="flex gap-2">
          {["mes", "ano", "tudo"].map((f: any) => (
            <button key={f} onClick={() => { setFiltro(f); setDrillDown(null); }} className={`flex-1 rounded-full border-2 px-3 py-1.5 text-[0.72rem] font-semibold ${filtro === f ? "bg-[#5B92C7] text-white border-[#5B92C7]" : "bg-white text-[#7A8A9A] border-[rgba(91,146,199,0.15)]"}`}>
              {f === "mes" ? "Este mês" : f === "ano" ? "Este ano" : "Tudo"}
            </button>
          ))}
        </div>
      </section>

      <section className="bloco-tema">
        <p className="mb-2 text-[0.65rem] font-bold tracking-widest uppercase text-[#7A8A9A]">🩺 Cuidados médicos</p>
        <div className="grid grid-cols-2 gap-2">
          <CardContagem tipo="Consulta" />
          <CardContagem tipo="Terapia" />
          <CardContagem tipo="Exame" />
        </div>
      </section>

      {drillDown && (
        <section className="bloco-tema">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-[1.1rem] font-bold text-[#2C4A6B]">{drillDown.tipo} · {drillDown.filtro}</h2>
            <button onClick={() => setDrillDown(null)} className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Fechar</button>
          </div>
          <ul className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {getListaDrill().map((a) => (
              <ItemExpandivel key={a.id} item={a} onClickAcao={(sit) => setObsModal({ id: a.id, obs: "", sit })} />
            ))}
          </ul>
        </section>
      )}

      {!drillDown && proximosGerais.length > 0 && (
        <section className="bloco-tema">
          <h2 className="text-[1.15rem] font-semibold italic text-[#2C4A6B] mb-3">Próximos compromissos</h2>
          <ul className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {proximosGerais.map((a) => (
              <ItemExpandivel key={a.id} item={a} onClickAcao={(sit) => setObsModal({ id: a.id, obs: "", sit })} />
            ))}
          </ul>
        </section>
      )}

      {obsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm space-y-4">
            <h3 className="font-display text-lg font-bold text-[#2C4A6B]">Anotação</h3>
            <Textarea placeholder="Quer anotar algo?" value={obsModal.obs} onChange={(e) => setObsModal({ ...obsModal, obs: e.target.value })} />
            <div className="flex gap-2">
              <button onClick={() => setObsModal(null)} className="flex-1 py-2 rounded-full border">Cancelar</button>
              <button onClick={() => {
                const item = agenda.find((a) => a.id === obsModal.id);
                if (item) salvarSituacao(item, obsModal.sit, obsModal.obs);
              }} className="flex-1 py-2 rounded-full bg-[#5B92C7] text-white font-bold">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ItemExpandivel({ item, onClickAcao }: { item: Acontecimento; onClickAcao: (sit: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const { estado } = useStore();
  const s = situacaoDe(item, estado.acontecimentos);
  const info = ROTULOS_CUIDADO[item.cuidado || ""] || { emoji: "📌", fundo: "#eee" };

  return (
    <li className="rounded-2xl border border-[rgba(91,146,199,0.12)] bg-[#F8FAFC] overflow-hidden">
      <button onClick={() => setAberto(!aberto)} className="w-full flex items-center gap-3 p-3 text-left">
        <span className="size-8 rounded-full flex items-center justify-center" style={{ backgroundColor: info.fundo }}>{info.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[0.88rem] font-bold text-[#2C4A6B] truncate">{rotuloCompromisso(item)}</p>
          <p className="text-[0.7rem] text-[#7A8A9A]">{formatarData(item.data, item.hora)}</p>
        </div>
        {aberto ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
      </button>

      {aberto && (
        <div className="px-3 pb-3 border-t border-gray-200 mt-1 pt-2 bg-white">
          {item.local && <p className="text-[0.75rem] text-gray-600">📍 {item.local}</p>}
          {item.profissional && <p className="text-[0.75rem] text-gray-600">👤 {item.profissional}</p>}
          {item.especialidade && <p className="text-[0.75rem] text-gray-600">🩺 {item.especialidade}</p>}
          {item.dosagem && <p className="text-[0.75rem] text-gray-600">💊 {item.dosagem} · {item.frequencia}</p>}
          
          {s === "proximo" && ehCompromisso(item.cuidado) && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => onClickAcao("feito")} className="flex-1 bg-green-100 text-green-700 py-1.5 rounded-lg text-xs font-bold">Compareceu</button>
              <button onClick={() => onClickAcao("faltou")} className="flex-1 bg-red-100 text-red-700 py-1.5 rounded-lg text-xs font-bold">Faltou</button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}