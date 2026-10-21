import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { PLANOS, reais, type PlanoId } from "@/lib/planos";

type Pix = { id: string; status: string; qrText: string; qrPng: string | null; expiraEm: string };
type Etapa =
  | { tipo: "dados" }
  | { tipo: "pix"; pix: Pix }
  | { tipo: "pago" }
  | { tipo: "expirado" }
  | { tipo: "link" };

// Plano B enquanto o PIX por API estiver indisponível: link de pagamento estático.
const LINK_PAGAMENTO = "https://pag.ae/82f-9CE1a";

class ErroCheckout extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function chamar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("rotina-azul-checkout", { body });
  if (error) {
    const msg = await error.context
      ?.json?.()
      .then((j: { error?: string }) => j.error)
      .catch(() => null);
    throw new ErroCheckout(
      msg || "Não foi possível falar com o pagamento. Tente novamente.",
      error.context?.status,
    );
  }
  return data as T;
}

function mascaraCpf(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function CheckoutPix({
  emailInicial,
  plano = "mensal",
  onFechar,
  onPago,
}: {
  emailInicial: string;
  /** Plano a cobrar; o preço e o prazo valem os do servidor. */
  plano?: PlanoId;
  onFechar: () => void;
  /** Chamado ao continuar depois do pagamento confirmado (ex.: rechecar a assinatura). */
  onPago?: () => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "dados" });
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState(emailInicial);
  const [cpf, setCpf] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const pixId = etapa.tipo === "pix" ? etapa.pix.id : null;

  // Enquanto o QR está na tela, pergunta ao servidor se o pagamento já caiu.
  useEffect(() => {
    if (!pixId) return;
    let ativo = true;
    const timer = setInterval(async () => {
      try {
        const { status } = await chamar<{ status: string }>({ acao: "status", id: pixId });
        if (!ativo) return;
        if (status === "pago") setEtapa({ tipo: "pago" });
        else if (status === "expirado" || status === "falhou") setEtapa({ tipo: "expirado" });
      } catch {
        // tenta de novo no próximo ciclo
      }
    }, 5000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [pixId]);

  const gerar = async () => {
    if (!nome.trim() || !email.trim() || cpf.replace(/\D/g, "").length !== 11) {
      toast.error("Preencha nome, e-mail e CPF.");
      return;
    }
    setOcupado(true);
    try {
      const pix = await chamar<Pix>({
        acao: "criar",
        nome,
        email,
        cpf,
        plano,
        ref: localStorage.getItem("afiliado_ref"),
      });
      setEtapa({ tipo: "pix", pix });
    } catch (e) {
      // Dados inválidos (4xx) são corrigíveis; falha do servidor ou do PagBank cai no link.
      const status = e instanceof ErroCheckout ? e.status : undefined;
      if (status && status < 500) toast.error((e as Error).message);
      else setEtapa({ tipo: "link" });
    } finally {
      setOcupado(false);
    }
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Código PIX copiado!");
    } catch {
      toast.error("Não foi possível copiar. Selecione o código manualmente.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[95vh] w-full max-w-sm space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-foreground">Assinar Rotina Azul</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {PLANOS[plano].nome} · {reais(PLANOS[plano].centavos)} no PIX
          </p>
        </div>

        {etapa.tipo === "dados" && (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Nome completo</label>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Seu nome"
                  className="field mt-1 w-full"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground">E-mail</label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className="field mt-1 w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="mt-1 text-[0.65rem] text-muted-foreground">
                  Use este e-mail para entrar no app.
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground">CPF</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  className="field mt-1 w-full"
                  value={cpf}
                  onChange={(e) => setCpf(mascaraCpf(e.target.value))}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={onFechar}
                className="flex-1 rounded-full border border-gray-300 py-2.5 text-sm font-bold text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={gerar}
                disabled={ocupado}
                className="flex-1 rounded-full bg-[#00B87C] py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-60"
              >
                {ocupado ? "Gerando PIX..." : "Gerar PIX"}
              </button>
            </div>
          </>
        )}

        {etapa.tipo === "pix" && (
          <div className="space-y-3 text-center">
            {etapa.pix.qrPng && (
              <img src={etapa.pix.qrPng} alt="QR Code PIX" className="mx-auto h-52 w-52" />
            )}
            <p className="text-xs text-muted-foreground">
              Escaneie o QR Code ou use o PIX copia e cola:
            </p>
            <textarea
              readOnly
              value={etapa.pix.qrText}
              className="field h-20 w-full resize-none text-[0.65rem]"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={() => copiar(etapa.pix.qrText)}
              className="w-full rounded-full bg-[#00B87C] py-2.5 text-sm font-bold text-white shadow-md"
            >
              Copiar código PIX
            </button>
            <p className="animate-pulse text-xs font-semibold text-muted-foreground">
              Aguardando pagamento…
            </p>
            <p className="text-[0.65rem] text-muted-foreground">
              Válido até{" "}
              {new Date(etapa.pix.expiraEm).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              . Esta tela atualiza sozinha.
            </p>
            <button onClick={onFechar} className="w-full py-1 text-xs font-bold text-gray-500">
              Fechar
            </button>
          </div>
        )}

        {etapa.tipo === "pago" && (
          <div className="space-y-3 text-center">
            <p className="text-4xl">✅</p>
            <p className="font-bold text-foreground">Pagamento confirmado!</p>
            <p className="text-sm text-muted-foreground">
              Seu acesso foi liberado para <strong>{email.trim().toLowerCase()}</strong>. Entre ou
              crie sua conta com esse e-mail.
            </p>
            <button
              onClick={() => {
                onFechar();
                onPago?.();
              }}
              className="w-full rounded-full bg-[#00B87C] py-2.5 text-sm font-bold text-white shadow-md"
            >
              Continuar
            </button>
          </div>
        )}

        {etapa.tipo === "link" && (
          <div className="space-y-3 text-center">
            <p className="font-bold text-foreground">Pague pelo link do PagBank</p>
            <p className="text-sm text-muted-foreground">
              O PIX automático está indisponível no momento. Você pode pagar pelo link seguro do
              PagBank; use o e-mail <strong>{email.trim().toLowerCase()}</strong> no pagamento.
            </p>
            <a
              href={LINK_PAGAMENTO}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onFechar}
              className="block w-full rounded-full bg-[#00B87C] py-2.5 text-sm font-bold text-white shadow-md"
            >
              Ir para o Pagamento
            </a>
            <button onClick={onFechar} className="w-full py-1 text-xs font-bold text-gray-500">
              Cancelar
            </button>
          </div>
        )}

        {etapa.tipo === "expirado" && (
          <div className="space-y-3 text-center">
            <p className="font-bold text-foreground">Este PIX expirou.</p>
            <p className="text-sm text-muted-foreground">
              Se você já pagou, aguarde alguns minutos e entre com seu e-mail. Senão, gere um novo
              PIX.
            </p>
            <button
              onClick={() => setEtapa({ tipo: "dados" })}
              className="w-full rounded-full bg-[#00B87C] py-2.5 text-sm font-bold text-white shadow-md"
            >
              Gerar novo PIX
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
