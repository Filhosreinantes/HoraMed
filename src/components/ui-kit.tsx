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
  return (
    <div className="flex items-center gap-3 rounded-full border border-gold/40 bg-card px-4 py-2 shadow-soft">
      <span className="text-2xl">{ativa.emoji || "🌸"}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{prefixo}</p>
        {pessoas.length > 1 ? (
          <div className="relative">
            <select
              aria-label="Escolher Tesouro"
              value={ativa.id}
              onChange={(e) => setAtivaId(e.target.value)}
              className="w-full appearance-none bg-transparent pr-6 font-display text-lg font-semibold italic outline-none"
            >
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.nome}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-0 top-1.5 h-4 w-4 text-accent" />
          </div>
        ) : (
          <p className="truncate font-display text-lg font-semibold italic">{ativa.nome}</p>
        )}
      </div>
    </div>
  );
}

const SELO: Record<Situacao, string> = {
  proximo: "bg-sky text-primary",
  feito: "bg-success/15 text-success",
  faltou: "bg-warning/20 text-foreground",
  cancelado: "bg-destructive/10 text-destructive",
};

export function Selo({ s }: { s?: Situacao }) {
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
