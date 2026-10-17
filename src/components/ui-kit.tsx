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

const TEMAS: Record<string, { cor: string; claro: string; escuro: string }> = {
  azul: { cor: "#5B92C7", claro: "#E8F1F9", escuro: "#2C4A6B" },
  rosa: { cor: "#D18CA0", claro: "#FBE5EC", escuro: "#8B3E58" },
  verde: { cor: "#6FB89A", claro: "#DCF0E7", escuro: "#3D8064" },
  "lilás": { cor: "#9B8FC7", claro: "#EDE7F5", escuro: "#524880" },
  lilas: { cor: "#9B8FC7", claro: "#EDE7F5", escuro: "#524880" },
};

export function SeletorTesouro({ prefixo = "Cuidando de" }: { prefixo?: string }) {
  const { pessoas, ativa, setAtivaId } = useApp();
  if (!ativa) return null;

  const temaAtual = TEMAS[ativa.tema || "azul"] ?? TEMAS.azul;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border p-3 shadow-sm transition"
      style={{ backgroundColor: temaAtual.claro, borderColor: temaAtual.cor }}
    >
      {/* Avatar: emoji do Tesouro ou foto fallback */}
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
        {ativa.emoji ? (
          ativa.emoji
        ) : (
          <img src="/icon-192.png" alt="Tesouro" className="h-8 w-8 rounded-full object-cover" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <span
          className="text-[0.65rem] font-bold uppercase tracking-wider"
          style={{ color: temaAtual.escuro }}
        >
          {prefixo}
        </span>
        {pessoas.length > 1 ? (
          <div className="relative">
            <select
              aria-label="Escolher Tesouro"
              value={ativa.id}
              onChange={(e) => setAtivaId(e.target.value)}
              className="w-full appearance-none bg-transparent pr-6 font-display text-lg font-bold outline-none"
              style={{ color: temaAtual.escuro }}
            >
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.nome}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-0 top-1.5 h-4 w-4"
              style={{ color: temaAtual.escuro }}
            />
          </div>
        ) : (
          <span
            className="block truncate font-display text-lg font-bold"
            style={{ color: temaAtual.escuro }}
          >
            {ativa.nome}
          </span>
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