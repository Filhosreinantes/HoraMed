import type { ReactNode } from "react";
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

export function SeletorTesouro({ prefixo = "Cuidando de" }: { prefixo?: string }) {
  const { pessoas, ativa, setAtivaId } = useApp();
  if (!ativa) return null;

  const multi = pessoas.length > 1;

  return (
    <div className="relative flex items-center justify-between gap-3 rounded-2xl border border-gold/30 bg-card p-3 shadow-sm">
      <div className="flex min-w-0 flex-col">
        <span className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
          {prefixo}
        </span>
        <span className="truncate font-display text-lg font-bold text-foreground">
          {ativa.nome}
        </span>
      </div>
      {multi && <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />}
      {/* Overlay invisível: clicar em qualquer ponto abre o seletor nativo (só quando há mais de 1) */}
      {multi && (
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Escolher Tesouro"
          value={ativa.id}
          onChange={(e) => setAtivaId(e.target.value)}
        >
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
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