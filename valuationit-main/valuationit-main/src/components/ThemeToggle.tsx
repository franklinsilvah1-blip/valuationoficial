import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  collapsed?: boolean;
  compact?: boolean;
}

export function ThemeToggle({ collapsed, compact }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      onClick={toggleTheme}
      className={cn(
        "justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
        compact ? "flex-1" : "w-full",
        collapsed && "lg:justify-center lg:px-3"
      )}
      title={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
    >
      {theme === "light" ? (
        <Moon className="w-5 h-5 flex-shrink-0" />
      ) : (
        <Sun className="w-5 h-5 flex-shrink-0" />
      )}
      {!collapsed && !compact && (
        <span>{theme === "light" ? "Tema Escuro" : "Tema Claro"}</span>
      )}
    </Button>
  );
}
