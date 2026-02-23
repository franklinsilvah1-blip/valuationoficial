import { useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { Button } from "./ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.webp";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // On mobile, start closed by default
    const isMobile = window.innerWidth < 1024;
    if (isMobile) return false;
    
    const saved = localStorage.getItem("sidebarOpen");
    return saved !== null ? saved === "true" : true;
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load sidebar state from backend when user logs in
  useEffect(() => {
    if (user && !isLoaded) {
      const loadSidebarPreference = async () => {
        const isMobile = window.innerWidth < 1024;
        
        if (isMobile) {
          // On mobile we always start with sidebar closed
          setSidebarOpen(false);
          localStorage.setItem("sidebarOpen", "false");
          setIsLoaded(true);
          return;
        }

        const { data } = await supabase
          .from("profiles")
          .select("sidebar_collapsed")
          .eq("id", user.id)
          .single();
        
        if (data !== null && data.sidebar_collapsed !== null) {
          const open = !data.sidebar_collapsed;
          setSidebarOpen(open);
          localStorage.setItem("sidebarOpen", String(open));
        }
        setIsLoaded(true);
      };
      
      loadSidebarPreference();
    }
  }, [user, isLoaded]);

  const handleToggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem("sidebarOpen", String(newState));
    
    // Save to backend if user is logged in
    if (user) {
      setTimeout(() => {
        supabase
          .from("profiles")
          .update({ sidebar_collapsed: !newState })
          .eq("id", user.id)
          .then();
      }, 0);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-gray-50">
      <AppSidebar isOpen={sidebarOpen} onToggle={handleToggleSidebar} />
      
      <main className={cn(
        "flex-1 flex flex-col w-full overflow-x-hidden transition-all duration-300",
        sidebarOpen ? "lg:ml-0" : "lg:ml-0"
      )}>
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-[10px] lg:py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <img 
              src={logo} 
              alt="Logo" 
              className="h-full max-h-[40px] object-contain lg:hidden"
            />
            <h1 className="text-xl font-semibold text-gray-800">
              {title || "Dashboard"}
            </h1>
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleToggleSidebar}
            className="border-border"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </header>

        {/* Content */}
        <div className="flex-1 p-3 sm:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
