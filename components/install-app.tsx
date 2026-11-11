"use client";
import { useEffect, useState } from "react";
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null),
    [help, setHelp] = useState(false),
    [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const before = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  async function install() {
    if (!prompt) {
      setHelp(true);
      return;
    }
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setHelp(true);
    }
    setPrompt(null);
  }
  return (
    <div className="install-connect">
      <button
        type="button"
        disabled={installed}
        onClick={() => void install()}
        data-connect-event="button_click"
        data-connect-target="install_app"
      >
        {installed
          ? "CONNECT está instalado"
          : "Instalar CONNECT en mi dispositivo"}
      </button>
      {help && (
        <div role="status">
          <p>
            En Android o escritorio, abre el menú del navegador y elige Instalar
            aplicación. En iPhone, usa Compartir → Agregar a inicio. La opción
            depende del navegador.
          </p>
          <button
            type="button"
            onClick={() => setHelp(false)}
            data-connect-event="button_click"
            data-connect-target="install_close"
          >
            Cerrar instrucciones
          </button>
        </div>
      )}
    </div>
  );
}
