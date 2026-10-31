import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Lista, tudoCerto, useConfiabilidade } from "@/components/confiabilidade";
import { ehAppAndroid } from "@/lib/alarmes";

export const Route = createFileRoute("/_app/confiabilidade")({
  head: () => ({ meta: [{ title: "Confiabilidade do alarme · horaMed" }] }),
  component: Confiabilidade,
});

function Confiabilidade() {
  const { estado, verificar } = useConfiabilidade();

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          to="/configuracoes"
          aria-label="Voltar"
          className="rounded-full bg-muted p-2.5 text-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-2xl font-semibold italic">Confiabilidade do alarme</h1>
      </header>

      {!ehAppAndroid() ? (
        <p className="notebook p-4 text-sm text-muted-foreground">
          Estas permissões existem apenas no aplicativo Android do horaMed.
        </p>
      ) : !estado ? null : (
        <>
          <p className="text-sm text-muted-foreground">
            {tudoCerto(estado)
              ? "✅ Tudo certo: os alarmes dos seus medicamentos vão tocar no horário."
              : "Libere o que está marcado com ❗ para o alarme tocar no horário."}
          </p>
          <Lista estado={estado} verificar={verificar} />
          <button
            onClick={() => {
              verificar();
              toast.success("Permissões verificadas.");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gold/50 bg-card py-3 text-sm font-bold text-foreground"
          >
            <RefreshCw className="h-4 w-4" /> Verificar se está tudo certo
          </button>
        </>
      )}
    </div>
  );
}