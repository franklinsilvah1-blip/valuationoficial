import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, User, LayoutDashboard, TrendingUp, Briefcase, Settings, Receipt } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import logo from "@/assets/logo.webp";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const AppNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userPlan, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");

  // Query para contar favoritos
  const { data: favoritesCount = 0 } = useQuery({
    queryKey: ["favorites-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from("asset_favorites")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const loadUserData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();

        if (profile) {
          setUserName(profile.name || user.email || "Usuário");
        }
      }
    };

    loadUserData();
  }, []);

  // All authenticated users go to /app/mercado
  const mercadoLink = "/app/mercado";

  // Admin sees only Admin and Mercado links
  // Clients see Dashboard, Mercado, Carteira, Perfil
  const navLinks = isAdmin 
    ? [
        { to: "/app/admin", label: "Admin", icon: <Settings className="h-4 w-4" /> },
        { to: mercadoLink, label: "Mercado", icon: <TrendingUp className="h-4 w-4" /> },
      ]
    : [
        { to: "/app/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
        { to: mercadoLink, label: "Mercado", icon: <TrendingUp className="h-4 w-4" /> },
        { 
          to: "/app/carteira", 
          label: "Minha Carteira", 
          icon: <Briefcase className="h-4 w-4" />,
          badge: favoritesCount > 0 ? favoritesCount : undefined
        },
      ];

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
      navigate("/");
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to={isAdmin ? "/app/admin" : "/app/dashboard"} className="flex items-center gap-3">
          <img src={logo} alt="VALUATION Invest tech" className="h-10 md:h-14 w-auto" />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary relative ${
                isActive(link.to) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.icon}
              {link.label}
              {link.badge && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {link.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Show simplified header when outside app area */}
          {!location.pathname.startsWith("/app/") && (
            <div className="hidden md:flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{userName}</span>
              <span className="text-muted-foreground">|</span>
              <Link 
                to="/app/dashboard" 
                className="text-primary hover:underline font-medium"
              >
                Ir para o Dashboard
              </Link>
            </div>
          )}

          {/* Show dropdown when inside app area */}
          {location.pathname.startsWith("/app/") && (
            <div 
              className="hidden md:block relative group"
              onMouseEnter={(e) => {
                const content = e.currentTarget.querySelector('[data-dropdown-content]');
                if (content) {
                  (content as HTMLElement).style.display = 'block';
                }
              }}
              onMouseLeave={(e) => {
                const content = e.currentTarget.querySelector('[data-dropdown-content]');
                if (content) {
                  (content as HTMLElement).style.display = 'none';
                }
              }}
            >
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                Olá, {userName}
              </Button>
              <div 
                data-dropdown-content
                className="hidden absolute right-0 w-56 rounded-md border bg-popover text-popover-foreground shadow-md z-50"
              >
                <div className="p-1 pt-2">
                  <div className="px-2 py-1.5 text-sm font-semibold">Minha Conta</div>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={() => navigate("/app/perfil", { state: { tab: "personal" } })}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  <User className="mr-2 h-4 w-4" />
                  Editar Perfil
                </button>
                <button
                  onClick={() => navigate("/app/perfil", { state: { tab: "subscription" } })}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  Assinaturas
                </button>
                <button
                  onClick={() => navigate("/app/perfil", { state: { tab: "security" } })}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Trocar Senha
                </button>
                {!isAdmin && (
                  <button
                    onClick={() => navigate("/app/historico")}
                    className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <Receipt className="mr-2 h-4 w-4" />
                    Histórico de Pagamentos
                  </button>
                )}
                <div className="h-px bg-border my-1" />
                <button
                  onClick={handleSignOut}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </button>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <div className="flex flex-col gap-4 mt-8">
                <div className="pb-4 border-b">
                  <p className="text-sm font-medium">Olá, {userName}</p>
                </div>
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 text-base font-medium transition-colors hover:text-primary relative ${
                      isActive(link.to) ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {link.icon}
                    {link.label}
                    {link.badge && (
                      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                ))}
                <div className="border-t pt-4 mt-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 px-2">PERFIL</p>
                  <Link
                    to="/app/perfil"
                    state={{ tab: "personal" }}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 text-base font-medium transition-colors hover:text-primary mb-3 ${
                      isActive("/app/perfil") ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <User className="h-4 w-4" />
                    Editar Perfil
                  </Link>
                  <Link
                    to="/app/perfil"
                    state={{ tab: "subscription" }}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 text-base font-medium transition-colors hover:text-primary mb-3 ${
                      isActive("/app/perfil") ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <Receipt className="h-4 w-4" />
                    Assinaturas
                  </Link>
                  <Link
                    to="/app/perfil"
                    state={{ tab: "security" }}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 text-base font-medium transition-colors hover:text-primary mb-3 ${
                      isActive("/app/perfil") ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    Trocar Senha
                  </Link>
                </div>
                {!isAdmin && (
                  <Link
                    to="/app/historico"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 text-base font-medium transition-colors hover:text-primary ${
                      isActive("/app/historico") ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <Receipt className="h-4 w-4" />
                    Histórico
                  </Link>
                )}
                <div className="mt-4 pt-4 border-t">
                  <Button variant="outline" className="w-full" onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default AppNavbar;
