import React, { useState, useEffect } from "react";
import { 
  Home, Wallet, TrendingUp, History, User, LogOut, FileText, Menu, Shield, Users, 
  FileBarChart, Mail, Bug, Activity, Newspaper, RefreshCw, Code, Bell, LayoutDashboard, 
  MessageSquareOff, Gift, Settings, Database, BarChart3, HardDrive,
  MessageCircle, Megaphone, PenTool, DollarSign, CreditCard, PlayCircle, Receipt
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/logo.webp";

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface MenuItem {
  icon: any;
  label: string;
  path: string;
}

interface MenuSection {
  icon: any;
  label: string;
  items: MenuItem[];
  permission?: string;
}

// Role badge configuration
const ROLE_BADGE_CONFIG = {
  admin: { label: "Admin", variant: "default" as const, className: "bg-red-500/90 hover:bg-red-500 text-white" },
  editor: { label: "Editor", variant: "default" as const, className: "bg-blue-500/90 hover:bg-blue-500 text-white" },
  moderator: { label: "Moderador", variant: "default" as const, className: "bg-amber-500/90 hover:bg-amber-500 text-white" },
};

export function AppSidebar({ isOpen, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, userRole, hasPermission } = useAuth();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (user) {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        setProfile(data);
      }
    };
    loadProfile();
  }, [user]);

  const menuItems = [
    { icon: Home, label: "Dashboard", path: "/app/dashboard" },
    { icon: TrendingUp, label: "Mercado", path: "/app/mercado" },
    { icon: Wallet, label: "Carteira", path: "/app/carteira" },
    { icon: Receipt, label: "Registros", path: "/app/rmc" },
    { icon: PlayCircle, label: "Conteúdos", path: "/app/conteudos" },
  ];

  const myAccountItems = [
    { icon: History, label: "Histórico", path: "/app/historico" },
    { icon: FileText, label: "Minha Conta", path: "/app/perfil" },
    { icon: Gift, label: "Afiliado", path: "/app/afiliado" },
  ];

  // Get admin sections based on user role permissions
  const getAdminSections = (): MenuSection[] => {
    const allSections: MenuSection[] = [
      {
        icon: Megaphone,
        label: "Conteúdo & Marketing",
        permission: 'blog',
        items: [
          { icon: Newspaper, label: "Blog", path: "/app/admin/blog" },
          { icon: Bell, label: "Notificações", path: "/app/admin/notifications" },
          { icon: Mail, label: "Emails", path: "/app/admin/emails" },
          { icon: PlayCircle, label: "Vídeos", path: "/app/admin/videos" },
          { icon: MessageCircle, label: "Comunidade", path: "/app/admin#comunidade" },
        ],
      },
      {
        icon: Users,
        label: "Gestão de Pessoas",
        permission: 'users',
        items: [
          { icon: Shield, label: "Equipe", path: "/app/admin/users" },
          { icon: Users, label: "Clientes", path: "/app/admin/clients" },
        ],
      },
      {
        icon: CreditCard,
        label: "Assinaturas",
        permission: 'reports',
        items: [
          { icon: LayoutDashboard, label: "Painel", path: "/app/admin/subscriptions" },
          { icon: Users, label: "Assinantes", path: "/app/admin/subscribers" },
          { icon: MessageSquareOff, label: "Cancelamentos", path: "/app/admin/cancellations" },
          { icon: FileBarChart, label: "Relatórios", path: "/app/admin/reports" },
          { icon: Settings, label: "Gerenciar Planos", path: "/app/admin/plans" },
        ],
      },
      {
        icon: Gift,
        label: "Programa de Afiliados",
        permission: 'affiliates',
        items: [
          { icon: LayoutDashboard, label: "Painel", path: "/app/admin/affiliates/panel" },
          { icon: Users, label: "Afiliados", path: "/app/admin/affiliates" },
          { icon: TrendingUp, label: "Analytics", path: "/app/admin/affiliates/analytics" },
          { icon: DollarSign, label: "Comissões", path: "/app/admin/affiliates/commissions" },
          { icon: BarChart3, label: "Histórico", path: "/app/admin/affiliates/performance" },
        ],
      },
      {
        icon: Settings,
        label: "Sistema & Integrações",
        permission: 'system',
        items: [
          { icon: RefreshCw, label: "Sincronização", path: "/app/admin/sync" },
          { icon: HardDrive, label: "Backups", path: "/app/admin/backups" },
          { icon: Mail, label: "SMTP", path: "/app/admin/smtp" },
          { icon: Code, label: "Tracking", path: "/app/admin/tracking" },
          { icon: Bug, label: "Debug", path: "/app/admin/debug" },
        ],
      },
    ];

    // Filter sections based on permissions
    return allSections.filter(section => 
      hasPermission(section.permission as any)
    );
  };

  const adminSections = getAdminSections();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) {
      onToggle();
    }
  };

  const renderMenuItem = (item: MenuItem) => (
    <Link
      key={item.path}
      to={item.path}
      onClick={handleLinkClick}
      className={cn(
        "flex items-center gap-3 px-6 py-2.5 transition-all duration-200 relative",
        isActive(item.path)
          ? "bg-sidebar-accent border-l-4 border-primary text-primary font-semibold"
          : "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-4 border-transparent hover:border-primary/50",
        !isOpen && "lg:justify-center lg:px-3"
      )}
    >
      <item.icon className="w-5 h-5 flex-shrink-0" />
      {isOpen && <span className="font-medium text-sm">{item.label}</span>}
    </Link>
  );

  const renderAdminMenuItem = (item: MenuItem) => (
    <Link
      key={item.path}
      to={item.path}
      onClick={handleLinkClick}
      className={cn(
        "flex items-center gap-3 px-6 py-2 transition-all duration-200 relative text-sm",
        isActive(item.path)
          ? "bg-sidebar-accent border-l-4 border-primary text-primary font-medium"
          : "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-4 border-transparent hover:border-primary/50 text-muted-foreground",
        !isOpen && "lg:justify-center lg:px-3"
      )}
    >
      <item.icon className="w-4 h-4 flex-shrink-0" />
      {isOpen && <span>{item.label}</span>}
    </Link>
  );

  const renderAdminSection = (section: MenuSection) => (
    <div key={section.label} className="mb-3">
      {/* Section title - only visible when sidebar is open */}
      {isOpen && (
        <div className="px-6 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {section.label}
        </div>
      )}
      {/* Section items */}
      {section.items.map(renderAdminMenuItem)}
    </div>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden animate-fade-in"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground shadow-lg",
          "transition-[width,transform,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "overflow-hidden",
          "fixed left-0 top-0 h-dvh z-40 lg:z-auto",
          "lg:sticky lg:top-0 lg:h-screen lg:shrink-0",
          isOpen 
            ? "w-64 translate-x-0 opacity-100" 
            : "w-0 -translate-x-full opacity-0 lg:w-20 lg:translate-x-0 lg:opacity-100"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo section */}
          <div className={cn(
            "shrink-0 flex flex-col border-b border-sidebar-border transition-all duration-300 ease-out",
            isOpen ? "p-4" : "p-2 items-center"
          )}>
            <img 
              src={logo} 
              alt="Valuation Invest Tech" 
              className={cn(
                "object-contain transition-all duration-300 ease-out cursor-pointer hover:opacity-80",
                isOpen ? "h-10" : "h-8 w-8"
              )}
              onClick={() => navigate('/app/mercado')}
            />
            {isOpen && (
              <div className="mt-2 px-3 py-1.5 bg-primary/10 rounded-lg">
                <p className="text-sm font-medium text-foreground">
                  Olá, <span className="text-primary">{profile?.name?.split(' ')[0] || user?.email?.split('@')[0] || "Cliente"}</span>!
                </p>
              </div>
            )}
          </div>

          {/* Navigation menu - scrollable */}
          <nav className="flex-1 min-h-0 py-4 overflow-y-auto">
            {/* Menu Admin - Visível para usuários com qualquer role */}
            {userRole && (
              <div className="mb-4">
                {/* Role Badge and Dashboard Link */}
                <div className="mb-2">
                  {isOpen && (
                    <div className="px-6 py-2 flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {userRole === 'admin' ? 'Administração' : userRole === 'editor' ? 'Editor' : 'Moderador'}
                      </span>
                      <Badge 
                        variant={ROLE_BADGE_CONFIG[userRole]?.variant || "default"}
                        className={cn("text-[10px] px-1.5 py-0", ROLE_BADGE_CONFIG[userRole]?.className)}
                      >
                        {ROLE_BADGE_CONFIG[userRole]?.label || userRole}
                      </Badge>
                    </div>
                  )}
                  {/* Dashboard Link - Admin sees Painel Admin, Editor sees Editor Dashboard */}
                  {userRole === 'admin' && (
                    <Link
                      to="/app/admin"
                      onClick={handleLinkClick}
                      className={cn(
                        "flex items-center gap-3 px-6 py-2.5 transition-all duration-200 relative",
                        isActive("/app/admin")
                          ? "bg-sidebar-accent border-l-4 border-primary text-primary font-semibold"
                          : "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-4 border-transparent hover:border-primary/50",
                        !isOpen && "lg:justify-center lg:px-3"
                      )}
                    >
                      <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                      {isOpen && <span className="font-medium text-sm">Painel Admin</span>}
                    </Link>
                  )}
                  {userRole === 'editor' && (
                    <Link
                      to="/app/editor"
                      onClick={handleLinkClick}
                      className={cn(
                        "flex items-center gap-3 px-6 py-2.5 transition-all duration-200 relative",
                        isActive("/app/editor")
                          ? "bg-sidebar-accent border-l-4 border-primary text-primary font-semibold"
                          : "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-4 border-transparent hover:border-primary/50",
                        !isOpen && "lg:justify-center lg:px-3"
                      )}
                    >
                      <PenTool className="w-5 h-5 flex-shrink-0" />
                      {isOpen && <span className="font-medium text-sm">Painel Editor</span>}
                    </Link>
                  )}
                  {userRole === 'moderator' && (
                    <Link
                      to="/app/moderator"
                      onClick={handleLinkClick}
                      className={cn(
                        "flex items-center gap-3 px-6 py-2.5 transition-all duration-200 relative",
                        isActive("/app/moderator")
                          ? "bg-sidebar-accent border-l-4 border-primary text-primary font-semibold"
                          : "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-4 border-transparent hover:border-primary/50",
                        !isOpen && "lg:justify-center lg:px-3"
                      )}
                    >
                      <FileBarChart className="w-5 h-5 flex-shrink-0" />
                      {isOpen && <span className="font-medium text-sm">Painel Moderador</span>}
                    </Link>
                  )}
                </div>

                {/* Admin Sections - all items visible */}
                {adminSections.map(renderAdminSection)}
              </div>
            )}

            {/* Menu Principal - Sempre visível */}
            <div className="mb-4">
              {isOpen && (
                <div className="px-6 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Principal
                </div>
              )}
              {menuItems.map(renderMenuItem)}
            </div>

            {/* Minha Conta */}
            <div className="mb-4">
              {isOpen && (
                <div className="px-6 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Minha Conta
                </div>
              )}
              {myAccountItems.map(renderMenuItem)}
            </div>
          </nav>

          {/* Footer - 3 ícones na mesma linha */}
          <div className="shrink-0 border-t border-sidebar-border">
            <div className={cn(
              "flex items-center px-3 py-3",
              isOpen ? "justify-between" : "justify-center gap-2"
            )}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="text-sidebar-foreground hover:bg-sidebar-accent h-9 w-9"
                title="Recolher"
              >
                <Menu className="w-5 h-5" />
              </Button>
              
              <ThemeToggle collapsed={!isOpen} compact={true} />
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive/20 hover:text-destructive h-9 w-9"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
