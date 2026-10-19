import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import OneSignal from "react-onesignal";
import { supabase } from "./supabase";
import { nowLocalISO, resolverSituacoes, uid, type Dados, type Item, type Pessoa } from "./cuidados";

interface Ctx {
  user: User;
  pessoas: Pessoa[];
  ativa: Pessoa | null;
  setAtivaId: (id: string) => void;
  itens: Item[];
  logs: Dados[];
  carregando: boolean;
  recarregar: () => Promise<void>;
  salvarRegistros: (lista: Dados[], tipo?: string) => Promise<boolean>;
  assinaturaAtiva: boolean | null;
}

const AppCtx = createContext<Ctx | null>(null);
const KEY = "rotina-azul:ativa";

export function AppProvider({ user, children }: { user: User; children: ReactNode }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [ativaId, setAtivaIdState] = useState<string | null>(null);
  const [registros, setRegistros] = useState<(Dados & { tipo?: string })[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [assinaturaAtiva, setAssinaturaAtiva] = useState<boolean | null>(null);

  // ✅ 1. CRÍTICO: Conecta o dispositivo ao ID do Supabase
  useEffect(() => {
    if (user?.id) {
      OneSignal.login(user.id).catch((err) =>
        console.error("Erro ao logar no OneSignal:", err)
      );
    }
  }, [user.id]);

  // ✅ VERIFICAÇÃO DE ASSINATURA
  useEffect(() => {
    async function checarAssinatura() {
      if (!user?.email) {
        setAssinaturaAtiva(false);
        return;
      }
      const { data, error } = await supabase
        .from("rotina_assinaturas")
        .select("ativa_ate")
        .eq("email", user.email)
        .maybeSingle();

      if (error) {
        console.error("Erro ao checar assinatura:", error);
        setAssinaturaAtiva(false);
        return;
      }
      setAssinaturaAtiva(data && data.ativa_ate ? new Date(data.ativa_ate) > new Date() : false);
    }
    checarAssinatura();
  }, [user.email]);

  const recarregar = useCallback(async () => {
    const { data: ps, error } = await supabase
      .from("pedacinho_pessoas")
      .select("*")
      .eq("user_id", user.id)
      .order("criado_em", { ascending: true });
    if (error) {
      toast.error("Não foi possível carregar seus Tesouros.");
      setCarregando(false);
      return;
    }
    let lista = (ps ?? []) as Pessoa[];
    if (lista.length === 0) {
      const agora = nowLocalISO();
      const nova = { id: uid(), user_id: user.id, nome: "Meu Tesouro", emoji: "🌸", tema: "azul", criado_em: agora, atualizado_em: agora };
      const { error: e2 } = await supabase.from("pedacinho_pessoas").insert(nova);
      if (e2) toast.error("Não foi possível criar o perfil inicial.");
      else lista = [nova as unknown as Pessoa];
    }
    setPessoas(lista);
    const salvo = localStorage.getItem(KEY);
    setAtivaIdState((cur) => {
      const c = cur ?? salvo;
      return c && lista.some((p) => p.id === c) ? c : lista[0]?.id ?? null;
    });

    const { data: rs } = await supabase
      .from("pedacinho_registros")
      .select("dados, tipo")
      .eq("user_id", user.id);

    setRegistros(((rs ?? []) as { dados: Dados; tipo: string }[]).map(r => ({ ...r.dados, tipo: r.tipo })));
    setCarregando(false);
  }, [user.id]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const setAtivaId = (id: string) => {
    localStorage.setItem(KEY, id);
    setAtivaIdState(id);
  };

  const salvarRegistros = async (lista: Dados[], tipo: string = "acontecimentos") => {
    const agora = nowLocalISO();
    const rows = lista.map((d) => ({
      id: d.id,
      user_id: user.id,
      pessoa_id: d.pessoaId,
      tipo,
      dados: d,
      criado_em: agora,
      atualizado_em: agora,
    }));
    const { error } = await supabase.from("pedacinho_registros").insert(rows);
    
    if (error) {
      toast.error("Não foi possível salvar. Tente novamente.");
      return false;
    }
    setRegistros((r) => [...r, ...lista.map(d => ({ ...d, tipo }))]);

    // ✅ AGENDAMENTO NO ONESIGNAL
    if (lista.some((d) => d.cuidado === "Medicação")) {
      for (const d of lista) {
        if (d.cuidado !== "Medicação") continue;

        let horariosLimpos: string[] = [];
        if (d.horarios && d.horarios.length > 0) {
          horariosLimpos = d.horarios;
        } else if (d.frequencia) {
          horariosLimpos = d.frequencia
            .split(/[,\s]+e\s+|[,\s]+/)
            .filter(Boolean)
            .map((h) => {
              const num = h.replace(/[^\d]/g, "");
              if (num.length <= 2) return `${num.padStart(2, "0")}:00`;
              return `${num.slice(0, 2).padStart(2, "0")}:${num.slice(2, 4)}`;
            });
        }

        if (horariosLimpos.length > 0) {
          supabase.functions.invoke("agendar-lembretes", {
            body: {
              userId: user.id,
              medicamento: d.medicamento || "Medicação",
              horarios: horariosLimpos,
            },
          }).catch((err) => console.error("Erro ao agendar no OneSignal:", err));
        }
      }
    }

    return true;
  };

  const ativa = pessoas.find((p) => p.id === ativaId) ?? null;
  
  const itens = useMemo(
    () => resolverSituacoes(registros.filter((d) => d.pessoaId === ativaId && d.cuidado && d.tipo !== "medicacao_logs")),
    [registros, ativaId],
  );

  const logs = useMemo(
    () => registros.filter((d) => d.pessoaId === ativaId && d.tipo === "medicacao_logs"),
    [registros, ativaId],
  );

  return (
    <AppCtx.Provider value={{ user, pessoas, ativa, setAtivaId, itens, logs, carregando, recarregar, salvarRegistros, assinaturaAtiva }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp fora do AppProvider");
  return c;
}