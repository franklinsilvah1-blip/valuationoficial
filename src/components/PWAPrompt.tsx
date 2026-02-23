import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Download, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServiceWorker } from '@/hooks/useServiceWorker';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAPrompt = () => {
  const location = useLocation();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const { isUpdateAvailable, isOffline, updateServiceWorker } = useServiceWorker();

  // Hide on LP and thank-you pages
  const hiddenPaths = ['/lp', '/lp/obrigado', '/cadastro/obrigado'];
  const isHiddenPage = hiddenPaths.includes(location.pathname);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      
      // Show install banner after 30 seconds
      const timer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 30000);
      
      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    setShowOfflineBanner(isOffline);
  }, [isOffline]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setShowInstallBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
  };

  if (isHiddenPage) return null;

  // Offline banner
  if (showOfflineBanner) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-destructive/90 backdrop-blur-sm text-destructive-foreground rounded-lg p-4 shadow-lg flex items-center gap-3">
          <WifiOff className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Você está offline</p>
            <p className="text-xs opacity-90">Algumas funcionalidades podem estar limitadas</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive-foreground hover:bg-destructive-foreground/10"
            onClick={() => setShowOfflineBanner(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Update available banner
  if (isUpdateAvailable) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-primary/90 backdrop-blur-sm text-primary-foreground rounded-lg p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <Wifi className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Nova versão disponível</p>
              <p className="text-xs opacity-90 mb-3">Atualize para obter as últimas melhorias</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={updateServiceWorker}
                className="w-full"
              >
                Atualizar agora
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => {}}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Install prompt banner
  if (showInstallBanner && installPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 flex-shrink-0 mt-0.5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Instalar VALUATION App</p>
              <p className="text-xs text-muted-foreground mb-3">Baixe o app para uma experiência otimizada no celular</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleInstall}
                  className="flex-1"
                >
                  Instalar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDismiss}
                >
                  Agora não
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PWAPrompt;
