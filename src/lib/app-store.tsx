import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { App as AppNativo } from "@capacitor/app";
import { agendarAlarmes, confirmarDosesGravadas, dosesTomadasNoAlarme, ehAppAndroid } from "./alarmes";
import { conectarUsuaria } from "./notificacoes";
import { supabase } from "./supabase";
import { doseRegistrada, nowLocalISO, resolverSituacoes, uid, type Dados, type Item, type Pessoa } from "./cuidados";

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
  assinaturaAtiva: boolean | null | "erro";
  assinaturaAte: string | null;
  checarAssinatura: () => Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);
// ✅ Chave do localStorage atualizada para o horaMed
const KEY = "horamed:ativa"; 

export function AppProvider({ user, children }: { user: User; children: ReactNode }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [ativaId, setAtivaIdState] = useState<string | null>(null);
  const [registros, setRegistros] = useState<(Dados & { tipo?: string })[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [assinaturaAtiva, setAssinaturaAtiva] = useState<boolean | null | "erro">(null);
  const [assinaturaAte, setAssinaturaAte] = useState<string | null>(null);

  // ✅ 1. CRÍTICO: Conecta o dispositivo ao ID do Supabase
  useEffect(() => {
    if (user?.id) {
      conectarUsuaria(user.id);
    }
  }, [user.id]);

  // Fuso do aparelho: o servidor envia os lembretes no horário local da usuária.
  useEffect(() => {
    const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!fuso) return;
    supabase
      .from("rotina_preferencias")
      .upsert({ user_id: user.id, fuso, atualizado_em: new Date().toISOString() })
      .then(({ error }) => error && console.error("Erro ao salvar fuso:", error));
  }, [user.id]);

  // ✅ VERIFICAÇÃO DE ASSINATURA
  const checarAssinatura = useCallback(async () => {
    if (!user?.email) {
      setAssinaturaAtiva(false);
      return;
    }
    setAssinaturaAtiva(null);
    const { data, error } = await supabase
      .from("rotina_assinaturas")
      .select("ativa_ate")
      .eq("email", user.email.toLowerCase())
      .maybeSingle();
    if (error) {
      console.error("Erro ao checar assinatura:", error);
      setAssinaturaAtiva("erro");
      return;
    }
    setAssinaturaAte(data?.ativa_ate ?? null);
    setAssinaturaAtiva(data?.ativa_ate ? new Date(data.ativa_ate) > new Date() : false);
  }, [user.email]);

  useEffect(() => {
    checarAssinatura();
  }, [checarAssinatura]);

  const recarregar = useCallback(async () => {
    const { data: ps, error } = await supabase
      .from("pedacinho_pessoas")
      .select("*")
      .eq("user_id", user.id)
      .order("criado_em", { ascending: true });
      
    if (error) {
      toast.error("Não foi possível carregar seus perfis.");
      setCarregando(false);
      return;
    }
    
    let lista = (ps ?? []) as Pessoa[];
    if (lista.length === 0) {
      const agora = nowLocalISO();
      // ✅ Nome inicial mudado para "Meu Perfil"
      const nova = { id: `inicial-${user.id}`, user_id: user.id, nome: "Meu Perfil", emoji: "🧑", tema: "azul", criado_em: agora, atualizado_em: agora };
      const { error: e2 } = await supabase
        .from("pedacinho_pessoas")
        .upsert(nova, { onConflict: "id", ignoreDuplicates: true });
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

  // No app Android, os lembretes são alarmes do próprio celular: reagenda a cada mudança.
  useEffect(() => {
    if (!carregando) agendarAlarmes(registros, pessoas);
  }, [carregando, registros, pessoas]);

  // Ao voltar para o app, busca o que mudou em outros aparelhos (e reagenda os alarmes).
  useEffect(() => {
    if (!ehAppAndroid()) return;
    const ouvinte = AppNativo.addListener("resume", () => recarregar());
    return () => {
      ouvinte.then((o) => o.remove());
    };
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

  // Doses marcadas como "Já tomei" na tela de alarme
  const salvarRef = useRef(salvarRegistros);
  salvarRef.current = salvarRegistros;
  const sincronizandoDoses = useRef(false);
  
  useEffect(() => {
    if (carregando || !ehAppAndroid() || sincronizandoDoses.current) return;
    sincronizandoDoses.current = true;
    (async () => {
      const doses = await dosesTomadasNoAlarme();
      if (!doses.length) return;
      const meds = resolverSituacoes(
        registros.filter((d) => d.cuidado && d.tipo !== "medicacao_logs"),
      );
      const logsAtuais = registros.filter((d) => d.tipo === "medicacao_logs");
      const estoque = new Map<string, number>();
      const gravadas: string[] = [];
      for (const dose of doses) {
        if (doseRegistrada(logsAtuais, dose.medId, dose.data, dose.horario)) {
          gravadas.push(dose.chave);
          continue;
        }
        const med = meds.find((m) => m.id === dose.medId);
        const nome = dose.medicamento || med?.medicamento || "";
        let ok = await salvarRef.current(
          [
            {
              id: uid(),
              pessoaId: dose.pessoaId,
              criadoEm: nowLocalISO(),
              titulo: `Tomou: ${nome} (${dose.horario})`,
              cuidado: "Medicação_Log" as unknown as Dados["cuidado"],
              evento: true,
              parentId: dose.medId,
              data: dose.data,
              horario: dose.horario,
            },
          ],
          "medicacao_logs",
        );
        if (ok && med && med.estoqueAtual !== undefined && med.dosagemUnidade !== "ml") {
          const atual = estoque.get(med.id) ?? med.estoqueAtual;
          const novo = Math.max(0, atual - Number(med.dosagemValor || 1));
          estoque.set(med.id, novo);
          ok = await salvarRef.current(
            [
              {
                id: uid(),
                pessoaId: med.pessoaId,
                criadoEm: nowLocalISO(),
                titulo: "Atualização de estoque",
                cuidado: med.cuidado,
                evento: true,
                parentId: med.id,
                acao: "editar",
                alteracoes: { estoqueAtual: novo },
              },
            ],
            "acontecimentos",
          );
        }
        if (ok) gravadas.push(dose.chave);
      }
      if (gravadas.length) await confirmarDosesGravadas(gravadas);
    })()
      .catch((e) => console.error("Erro ao gravar doses do alarme:", e))
      .finally(() => {
        sincronizandoDoses.current = false;
      });
  }, [carregando, registros]);

  const ativa = pessoas.find((p) => p.id === ativaId) ?? null;
  
  const itens = useMemo(
    () => resolverSituacoes(registros.filter((d) => d.pessoaId === ativaId && d.cuidado && d.tipo !== "medicacao_logs")),
    [registros, ativaId],
  );

  const logs = useMemo(() => {
    const daPessoa = registros.filter((d) => d.pessoaId === ativaId && d.tipo === "medicacao_logs");
    const excluidos = new Set(daPessoa.filter((d) => d.acao === "excluir" && d.parentId).map((d) => d.parentId));
    return daPessoa.filter((d) => !d.acao && !excluidos.has(d.id));
  }, [registros, ativaId]);

  return (
    <AppCtx.Provider value={{ user, pessoas, ativa, setAtivaId, itens, logs, carregando, recarregar, salvarRegistros, assinaturaAtiva, assinaturaAte, checarAssinatura }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp fora do AppProvider");
  return c;
}