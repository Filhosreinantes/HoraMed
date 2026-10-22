/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

export function VozInput({ 
  value, 
  onChange, 
  placeholder, 
  className 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  placeholder: string; 
  className?: string;
}) {
  const [ouvindo, setOuvindo] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'pt-BR';

      recognitionRef.current.onresult = (event: any) => {
        let textoFinal = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            textoFinal += event.results[i][0].transcript;
          }
        }
        if (textoFinal) {
          onChange(value + (value ? " " : "") + textoFinal);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Erro de voz:", event.error);
        setOuvindo(false);
        if (event.error === 'not-allowed') {
          toast.error("Permissão do microfone negada. Verifique as configurações do seu navegador.");
        }
      };

      recognitionRef.current.onend = () => {
        setOuvindo(false);
      };
    }
  }, [value, onChange]);

  const toggleGravacao = () => {
    if (ouvindo) {
      recognitionRef.current?.stop();
      setOuvindo(false);
    } else {
      if (!recognitionRef.current) {
        toast.error("Seu navegador não suporta gravação de voz.");
        return;
      }
      recognitionRef.current.start();
      setOuvindo(true);
      toast.info("Ouvindo... Fale agora.");
    }
  };

  return (
    <div className="relative w-full">
      <textarea
        className={`${className} pr-12 w-full`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={toggleGravacao}
        className={`absolute right-2 top-2 p-2 rounded-full transition ${
          ouvindo ? "bg-red-100 text-red-600 animate-pulse" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
        }`}
        title={ouvindo ? "Parar gravação" : "Gravar por voz"}
      >
        {ouvindo ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>
    </div>
  );
}