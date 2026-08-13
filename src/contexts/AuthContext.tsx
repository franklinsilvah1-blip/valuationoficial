import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionData {
  subscribed: boolean;
  product_id: string | null;
  subscription_end: string | null;
}

export type UserRole = 'admin' | 'editor' | 'moderator' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userPlan: string | null;
  loading: boolean;
  subscriptionData: SubscriptionData | null;
  refreshSubscription: () => Promise<boolean>;
  lastSyncTime: Date | null;
  isRefreshing: boolean;
  isAdmin: boolean;
  userRole: UserRole;
  hasPermission: (permission: 'blog' | 'reports' | 'users' | 'system' | 'affiliates' | 'all') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const { toast } = useToast();

  // Permission mapping for each role
  const hasPermission = (permission: 'blog' | 'reports' | 'users' | 'system' | 'affiliates' | 'all'): boolean => {
    if (!userRole) return false;
    
    // Admin has all permissions
    if (userRole === 'admin') return true;
    
    // Editor only has blog access
    if (userRole === 'editor') {
      return permission === 'blog';
    }
    
    // Moderator has reports and community access
    if (userRole === 'moderator') {
      return permission === 'reports';
    }
    
    return false;
  };

  // Buscar plano direto do Supabase (sem chamadas ao Stripe)
  const refreshSubscription = async (): Promise<boolean> => {
    if (isRefreshing) {
      console.log("[AuthContext] Refresh already in progress, skipping");
      return false;
    }

    setIsRefreshing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("[AuthContext] No authenticated user");
        setIsRefreshing(false);
        return false;
      }
      
      console.log("[AuthContext] Fetching plan from database for:", user.email);
      
      // Verificar role do usuário (pegar a role com maior privilégio)
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (roles && roles.length > 0) {
        // Priority: admin > editor > moderator
        const roleOrder: UserRole[] = ['admin', 'editor', 'moderator'];
        const userRoles = roles.map(r => r.role as UserRole);
        const highestRole = roleOrder.find(r => r && userRoles.includes(r)) || null;
        
        setUserRole(highestRole);
        setIsAdmin(highestRole === 'admin');
        
        if (highestRole === 'admin') {
          console.log("[AuthContext] User is admin, setting SPECIALIST plan");
          setUserPlan("SPECIALIST");
          setSubscriptionData({
            subscribed: true,
            product_id: null,
            subscription_end: null
          });
          setLastSyncTime(new Date());
          setIsRefreshing(false);
          setLoading(false);
          return true;
        }
      } else {
        setUserRole(null);
        setIsAdmin(false);
      }

      // Buscar plano direto do profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, plan_end_at")
        .eq("id", user.id)
        .single();
      
      if (profile) {
        console.log("[AuthContext] Profile data from database:", profile);
        
        let effectivePlan = profile.plan || "START";

        // Assinatura paga (nunca START/FREE, que não expiram) com
        // plan_end_at vencido volta ao nível gratuito de entrada — sempre
        // START, nunca o valor legado FREE (ver RELATORIO_IMPLEMENTACAO_PLANOS.md).
        if (effectivePlan !== "FREE" && effectivePlan !== "START" && profile.plan_end_at) {
          const endDate = new Date(profile.plan_end_at);
          if (endDate < new Date()) {
            console.warn("[AuthContext] Plan expired on", profile.plan_end_at, "- forcing START");
            effectivePlan = "START";

            // Update database silently (non-blocking)
            supabase
              .from("profiles")
              .update({ plan: "START", plan_end_at: null, plan_start_at: null })
              .eq("id", user.id)
              .then(({ error }) => {
                if (error) console.error("[AuthContext] Failed to reset expired plan:", error);
                else console.log("[AuthContext] Expired plan reset to START in database");
              });
          }
        }

        setUserPlan(effectivePlan);
        setSubscriptionData({
          subscribed: effectivePlan !== "FREE" && effectivePlan !== "START",
          product_id: null,
          subscription_end: profile.plan_end_at
        });
        setLastSyncTime(new Date());
        setLoading(false);
        setIsRefreshing(false);
        return true;
      }
      
      setIsRefreshing(false);
      setLoading(false);
      return false;
    } catch (error) {
      console.error("[AuthContext] Error fetching plan:", error);
      setIsRefreshing(false);
      setLoading(false);
      return false;
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AuthContext] Auth state changed:", event);
      setSession(session);
      setUser(session?.user ?? null);

      // Detectar evento de recuperação de senha e redirecionar
      if (event === "PASSWORD_RECOVERY") {
        console.log("[AuthContext] PASSWORD_RECOVERY event detected, redirecting to reset-password");
        window.location.href = "/reset-password";
        return;
      }

      // Buscar plano quando user faz login
      if (session?.user) {
        refreshSubscription();
      } else {
        setUserPlan("START");
        setIsAdmin(false);
        setUserRole(null);
        setLoading(false);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        refreshSubscription();
      } else {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      userPlan, 
      loading, 
      subscriptionData, 
      refreshSubscription, 
      lastSyncTime, 
      isRefreshing, 
      isAdmin,
      userRole,
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
