import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";

// Cloudflare Turnstile site key - must match Cloudflare dashboard
const TURNSTILE_SITE_KEY = "0x4AAAAAACAm_YrVBrm_O96c";

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
}

// Use a more flexible type for the Turnstile API
interface TurnstileAPI {
  reset: (widgetId?: string) => void;
  render: (element: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  theme?: "light" | "dark" | "auto";
}

type TurnstileStatus = "loading" | "ready" | "verified" | "error" | "expired";

// Helper to get turnstile from window with proper typing
const getTurnstile = (): TurnstileAPI | undefined => {
  return (window as unknown as { turnstile?: TurnstileAPI }).turnstile;
};

const TurnstileWidget = ({ onVerify, onError, theme = "light" }: TurnstileWidgetProps) => {
  const [status, setStatus] = useState<TurnstileStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const renderWidget = useCallback(() => {
    const turnstile = getTurnstile();
    if (!containerRef.current || !turnstile || widgetIdRef.current) {
      return;
    }

    try {
      setStatus("loading");
      setErrorMessage("");

      const widgetId = turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => {
          if (mountedRef.current) {
            setStatus("verified");
            onVerify(token);
          }
        },
        "error-callback": () => {
          if (mountedRef.current) {
            setStatus("error");
            setErrorMessage("Falha na verificação. Tente novamente.");
            onError?.();
          }
        },
        "expired-callback": () => {
          if (mountedRef.current) {
            setStatus("expired");
            setErrorMessage("Verificação expirada. Clique para renovar.");
            onVerify("");
          }
        },
        theme,
      });

      widgetIdRef.current = widgetId;
      setStatus("ready");
    } catch (error) {
      console.error("[Turnstile] Error rendering widget:", error);
      if (mountedRef.current) {
        setStatus("error");
        setErrorMessage("Não foi possível carregar a verificação.");
      }
    }
  }, [onVerify, onError, theme]);

  const handleRetry = useCallback(() => {
    const turnstile = getTurnstile();
    // Remove existing widget if any
    if (widgetIdRef.current && turnstile) {
      try {
        turnstile.remove(widgetIdRef.current);
      } catch (e) {
        // Widget may already be removed
      }
      widgetIdRef.current = null;
    }

    // Clear container
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    // Re-render
    setStatus("loading");
    setErrorMessage("");
    
    // Small delay to ensure cleanup is complete
    setTimeout(() => {
      if (mountedRef.current) {
        renderWidget();
      }
    }, 100);
  }, [renderWidget]);

  // Load script and render widget
  useEffect(() => {
    mountedRef.current = true;

    // Load script if not already loaded
    if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // Wait for script to load and render
    const checkAndRender = () => {
      const turnstile = getTurnstile();
      if (turnstile) {
        renderWidget();
      }
    };

    const turnstile = getTurnstile();
    if (turnstile) {
      checkAndRender();
    } else {
      const interval = setInterval(() => {
        const t = getTurnstile();
        if (t) {
          clearInterval(interval);
          checkAndRender();
        }
      }, 100);

      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (mountedRef.current && !getTurnstile()) {
          setStatus("error");
          setErrorMessage("Tempo esgotado ao carregar verificação.");
        }
      }, 10000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }

    return () => {
      mountedRef.current = false;
      const t = getTurnstile();
      if (widgetIdRef.current && t) {
        try {
          t.remove(widgetIdRef.current);
        } catch (e) {
          // Widget may already be removed
        }
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Widget container */}
      <div ref={containerRef} className="min-h-[65px]" />

      {/* Status indicators */}
      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Carregando verificação...</span>
        </div>
      )}

      {status === "verified" && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span>Verificação concluída</span>
        </div>
      )}

      {(status === "error" || status === "expired") && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{errorMessage}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );
};

export default TurnstileWidget;
