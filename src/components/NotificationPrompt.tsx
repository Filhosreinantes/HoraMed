import { useEffect, useState } from "react";
import OneSignal from "react-onesignal";
import { toast } from "sonner";

export function NotificationPrompt() {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    // Verifica se o usuário já foi perguntado ou já está inscrito
    const jaPerguntado = localStorage.getItem("rotina-azul:notificacao-perguntada");
    
    // Espera um pouquinho o OneSignal carregar e verifica se já tem permissão
    setTimeout(() => {
      const temPermissao = OneSignal.Notifications?.permission;
      
      // Se não tem permissão e não foi perguntado ainda, mostra o modal
      if (!temPermissao && !jaPerguntado) {
        setAberto(true);
      }
    }, 2000); // 2 segundos após entrar no app
  }, []);

  const ativarNotificacoes = async () => {
    setCarregando(true);
    try {
      // Isso abre aquele aviso nativo do navegador
      await OneSignal.Notifications.requestPermission();
      
      // Salva no navegador que ele já foi perguntado
      localStorage.setItem("rotina-azul:notificacao-perguntada", "sim");
      setAberto(false);
      
      // Opcional: Se ele aceitou, mostra um toast de sucesso
      if (OneSignal.Notifications.permission) {
        toast.success("Lembretes ativados com sucesso! 💙");
      }
    } catch (error) {
      console.error("Erro ao pedir permissão", error);
    } finally {
      setCarregando(false);
    }
  };

  const fechar = () => {
    // Se ele clicar em "Agora não", não mostramos mais hoje
    localStorage.setItem("rotina-azul:notificacao-perguntada", "sim");
    setAberto(false);
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-xl text-center">
        
        {/* Ícone fofo */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky text-3xl shadow-sm">
          🔔
        </div>

        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Ative os Lembretes
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Para te avisar na hora exata dos remédios, o navegador vai pedir sua permissão.
            <br /><br />
            <strong className="text-primary">Clique em "Permitir"</strong> para não perder nenhum horário. Prometemos não enviar spam! 💙
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={ativarNotificacoes}
            disabled={carregando}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
          >
            {carregando ? "Ativando..." : "Quero receber lembretes"}
          </button>
          
          <button
            onClick={fechar}
            disabled={carregando}
            className="w-full rounded-2xl border border-gray-300 py-3 text-sm font-bold text-gray-500"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}