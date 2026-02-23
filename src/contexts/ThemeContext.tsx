import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme") as Theme;
    return saved || "light";
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load theme from backend when user logs in
  useEffect(() => {
    if (user && !isLoaded) {
      const loadThemePreference = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("theme_preference")
          .eq("id", user.id)
          .single();
        
        if (data?.theme_preference) {
          setTheme(data.theme_preference as Theme);
          localStorage.setItem("theme", data.theme_preference);
        }
        setIsLoaded(true);
      };
      
      loadThemePreference();
    }
  }, [user, isLoaded]);

  // Apply theme to DOM
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    
    // Save to backend if user is logged in
    if (user) {
      setTimeout(() => {
        supabase
          .from("profiles")
          .update({ theme_preference: newTheme })
          .eq("id", user.id)
          .then();
      }, 0);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
