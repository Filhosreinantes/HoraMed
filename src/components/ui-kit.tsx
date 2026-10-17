import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { SITUACAO_LABEL, type Situacao } from "@/lib/cuidados";
import { cn } from "@/lib/utils";

export function Divisor() {
  return (
    <div className="my-5 flex items-center gap-3 text-gold">
      <span className="h-px flex-1 bg-gold/40" />
      <span className="text-lg">❦</span>
      <span className="h-px flex-1 bg-gold/40" />
    </div>
  );
}

export function SeletorTesouro({
  prefixo = "Cuidando de",
  somenteLeitura = false,
}: {
  prefixo?: string;
  /** Quando true, o bloco vira apenas display: sem chevron, sem dropdown, sem clique. */
  somenteLeitura?: boolean;
}) {
  const { pessoas, ativa, setAtivaId } = useApp();
  const [aberto, setAberto] = useState(false);

  if (!ativa) return null;

  const interativo = !somenteLeitura && pessoas.length > 1;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => interativo && setAberto((v) => !v)}
        disabled={!interativo}
        className="flex w-full items-center justify-between rounded-2xl border p-3 text-left shadow-sm transition disabled:cursor-default"
        style={{
          backgroundColor: "var(--tema-claro, #E8F1F9)",
          borderColor: "var(--tema, #5B92C7)",
        }}
      >
        <div className="flex min-w-0 flex-col">
          <span
            className="text-[0.65rem] font-bold uppercase tracking-wider"
            style={{ color: "var(--tema-escuro, #2C4A6B)" }}
          >
            {prefixo}
          </span>
          <span
            className="truncate font-display text-lg font-bold"
            style={{ color: "var(--tema-escuro, #2C4A6B)" }}
          >
            {ativa.nome}
          </span>
        </div>
        {interativo && (
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 transition-transform motion-reduce:transition-none",
              aberto && "rotate-180",
            )}
            style={{ color: "var(--tema-escuro, #2C4A6B)" }}
          />
        )}
      </button>

      {interativo && aberto && (
        <>
          {/* Overlay para fechar ao clicar fora */}
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} aria-hidden="true" />
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border bg-card shadow-soft"
            style={{ borderColor: "var(--tema, #5B92C7)" }}
          >
            {pessoas.map((p) => {
              const selecionado = p.id === ativa.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selecionado}
                    onClick={() => {
                      setAtivaId(p.id);
                      setAberto(false);
                    }}
                    className={cn(
                      "block w-full px-4 py-2.5 text-left text-sm font-semibold transition hover:bg-muted",
                      selecionado && "bg-muted",
                    )}
                    style={{ color: "var(--tema-escuro, #2C4A6B)" }}
                  >
                    {p.nome}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

const SELO: Record<Situacao, string> = {
  proximo: "bg-sky text-primary",
  feito: "bg-success/15 text-success",
  faltou: "bg-warning/20 text-foreground",
  cancelado: "bg-destructive/10 text-destructive",
};

export function Selo({ s }: { s?: Situacao | undefined }) {
  const k = s ?? "proximo";
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", SELO[k])}>{SITUACAO_LABEL[k]}</span>;
}

export function Pill({ ativo, children, onClick }: { ativo: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-semibold transition",
        ativo ? "bg-primary text-primary-foreground shadow-soft" : "border border-border bg-card text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

export function Botao({
  variant = "primary",
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "outline" }) {
  const v = {
    primary: "bg-primary text-primary-foreground shadow-soft",
    ghost: "text-accent underline-offset-4 hover:underline",
    danger: "bg-destructive text-destructive-foreground",
    outline: "border border-gold/50 bg-card text-foreground",
  }[variant];
  return (
    <button
      {...p}
      className={cn("rounded-2xl px-5 py-3 font-semibold transition active:scale-[0.98] disabled:opacity-60", v, className)}
    />
  );
}