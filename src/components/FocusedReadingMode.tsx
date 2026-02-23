import { useState, useEffect } from "react";
import { Eye, X, ZoomIn, ZoomOut, Sun, Moon, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FocusedTheme = "light" | "dark" | "system";

export const FocusedReadingToggle = ({ onClick }: { onClick: () => void }) => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="gap-2"
      title="Modo Leitura Focada"
    >
      <Eye className="h-4 w-4" />
      <span className="hidden sm:inline">Modo Focado</span>
    </Button>
  );
};

export const FocusedReadingOverlay = ({ 
  isActive, 
  onClose,
  children 
}: { 
  isActive: boolean; 
  onClose: () => void;
  children: React.ReactNode;
}) => {
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem("focused-reading-font-size");
    return saved ? parseInt(saved, 10) : 100;
  });
  
  const [focusedTheme, setFocusedTheme] = useState<FocusedTheme>(() => {
    const saved = localStorage.getItem("focused-reading-theme");
    return (saved as FocusedTheme) || "system";
  });

  // Determine the actual theme to apply
  const getResolvedTheme = (): "light" | "dark" => {
    if (focusedTheme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return focusedTheme;
  };

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(getResolvedTheme);

  // Update resolved theme when focusedTheme changes or system preference changes
  useEffect(() => {
    const updateResolvedTheme = () => {
      setResolvedTheme(getResolvedTheme());
    };

    updateResolvedTheme();

    if (focusedTheme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", updateResolvedTheme);
      return () => mediaQuery.removeEventListener("change", updateResolvedTheme);
    }
  }, [focusedTheme]);

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem("focused-reading-font-size", fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("focused-reading-theme", focusedTheme);
  }, [focusedTheme]);

  // Handle escape key to exit focused mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isActive) {
        onClose();
      }
    };

    if (isActive) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isActive, onClose]);

  const increaseFontSize = () => {
    setFontSize((prev) => Math.min(prev + 10, 150));
  };

  const decreaseFontSize = () => {
    setFontSize((prev) => Math.max(prev - 10, 80));
  };

  const cycleTheme = () => {
    setFocusedTheme((prev) => {
      if (prev === "system") return "light";
      if (prev === "light") return "dark";
      return "system";
    });
  };

  const getThemeIcon = () => {
    switch (focusedTheme) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
      default:
        return <MonitorSmartphone className="h-4 w-4" />;
    }
  };

  const getThemeLabel = () => {
    switch (focusedTheme) {
      case "light":
        return "Claro";
      case "dark":
        return "Escuro";
      default:
        return "Sistema";
    }
  };

  if (!isActive) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 animate-fade-in",
        isDark ? "bg-zinc-950 text-zinc-100" : "bg-amber-50 text-zinc-900"
      )}
    >
      {/* Top bar with controls */}
      <div className={cn(
        "fixed top-0 left-0 right-0 z-50 backdrop-blur-sm border-b",
        isDark 
          ? "bg-zinc-950/95 border-zinc-800" 
          : "bg-amber-50/95 border-amber-200"
      )}>
        <div className="container max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className={cn("h-5 w-5", isDark ? "text-amber-400" : "text-amber-600")} />
            <span className="font-medium text-sm">Modo Leitura Focada</span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={cycleTheme}
              className={cn(
                "gap-2",
                isDark 
                  ? "hover:bg-zinc-800 text-zinc-300" 
                  : "hover:bg-amber-100 text-zinc-700"
              )}
              title={`Tema: ${getThemeLabel()}`}
            >
              {getThemeIcon()}
              <span className="hidden sm:inline text-xs">{getThemeLabel()}</span>
            </Button>

            {/* Separator */}
            <div className={cn(
              "h-6 w-px mx-1",
              isDark ? "bg-zinc-700" : "bg-amber-300"
            )} />

            {/* Font size controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={decreaseFontSize}
                disabled={fontSize <= 80}
                className={cn(
                  "h-8 w-8",
                  isDark 
                    ? "hover:bg-zinc-800 text-zinc-300 disabled:text-zinc-600" 
                    : "hover:bg-amber-100 text-zinc-700 disabled:text-zinc-400"
                )}
                title="Diminuir fonte"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className={cn(
                "text-sm font-medium w-12 text-center",
                isDark ? "text-zinc-400" : "text-zinc-600"
              )}>
                {fontSize}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={increaseFontSize}
                disabled={fontSize >= 150}
                className={cn(
                  "h-8 w-8",
                  isDark 
                    ? "hover:bg-zinc-800 text-zinc-300 disabled:text-zinc-600" 
                    : "hover:bg-amber-100 text-zinc-700 disabled:text-zinc-400"
                )}
                title="Aumentar fonte"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* Separator */}
            <div className={cn(
              "h-6 w-px mx-1",
              isDark ? "bg-zinc-700" : "bg-amber-300"
            )} />

            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className={cn(
                "gap-2",
                isDark 
                  ? "hover:bg-zinc-800 text-zinc-300" 
                  : "hover:bg-amber-100 text-zinc-700"
              )}
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
              <kbd className={cn(
                "hidden sm:inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium",
                isDark 
                  ? "bg-zinc-800 border-zinc-700 text-zinc-400" 
                  : "bg-amber-100 border-amber-300 text-zinc-500"
              )}>
                ESC
              </kbd>
            </Button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div 
        className="h-full overflow-y-auto pt-16 pb-12"
        style={{ fontSize: `${fontSize}%` }}
      >
        <div className={cn(
          "container max-w-3xl mx-auto px-6 py-8",
          isDark ? "focused-reading-dark" : "focused-reading-light"
        )}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default FocusedReadingOverlay;
