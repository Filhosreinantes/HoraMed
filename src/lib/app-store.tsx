import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { nowLocalISO, resolverSituacoes, uid, type Dados, type Item, type Pessoa } from "./cuidados";

interface Ctx {
  user: User;
  pessoas: Pessoa[];
  ativa: Pessoa | null;
  setAtivaId: (id: string) => void;
  itens: Item[];
  logs: Dados[]; // <-- NOVO AQUI
  carregando: boolean;
  recarregar: () => Promise<void>;
  salvarRegistros: (lista: Dados[], tipo?: string) => Promise<boolean>;
}

const AppCtx = createContext<Ctx | null>(null);
const KEY = "rotina-azul:ativa";

export function AppProvider({ user, children }: { user: User; children: ReactNode }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [ativaId, setAtivaIdState] = useState<string | null>(null);
  const [registros, setRegistros] = useState<(Dados & { tipo?: string })[]>([]);
  const [carregando, setCarregando] = useState(true);

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
    return true;
  };

  const ativa = pessoas.find((p) => p.id === ativaId) ?? null;
  
  const itens = useMemo(
    () => resolverSituacoes(registros.filter((d) => d.pessoaId === ativaId && d.cuidado && d.tipo !== "medicacao_logs")),
    [registros, ativaId],
  );

  // AQUI: Separando os logs de medicação
  const logs = useMemo(
    () => registros.filter((d) => d.pessoaId === ativaId && d.tipo === "medicacao_logs"),
    [registros, ativaId],
  );

  return (
    <AppCtx.Provider value={{ user, pessoas, ativa, setAtivaId, itens, logs, carregando, recarregar, salvarRegistros }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp fora do AppProvider");
  return c;
}