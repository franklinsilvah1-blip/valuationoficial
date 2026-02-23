import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, User, PlayCircle, X, Pencil, ArrowRight, Crown, Sparkles, Star } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import InvestorProfileBanner from "./InvestorProfileBanner";
import InvestorProfileModal from "./InvestorProfileModal";
import { getPlanDisplayName } from "@/utils/planHelpers";
import { cn } from "@/lib/utils";

const UserHeader = () => {
  const { user, userPlan, subscriptionData, lastSyncTime, isRefreshing } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  // Query for investor profile with caching
  const { data: investorProfileData } = useQuery({
    queryKey: ["investor-profile", user?.id],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("investor_profile, last_reclassification_at")
        .eq("id", user!.id)
        .single();

      if (!profile) return { profile: null, showBanner: false, isReclassification: false };

      let showBanner = false;
      let isReclassification = false;

      if (!profile.investor_profile) {
        showBanner = true;
        isReclassification = false;
      } else if (profile.last_reclassification_at) {
        const daysSince = differenceInDays(
          new Date(),
          new Date(profile.last_reclassification_at)
        );
        if (daysSince >= 90) {
          showBanner = true;
          isReclassification = true;
        }
      }

      return {
        profile: profile.investor_profile,
        showBanner,
        isReclassification
      };
    }
  });

  // Query for admin check with caching
  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.id],
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();

      return !!roles;
    }
  });

  // Query for community status with caching
  const { data: showCommunityCard = false } = useQuery({
    queryKey: ["community-status", user?.id, userPlan],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    enabled: !!user?.id && !isAdmin && userPlan !== "FREE",
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("hide_community_message")
        .eq("id", user!.id)
        .single();

      return !profile?.hide_community_message;
    }
  });

  // Query for community link with caching
  const { data: communityLink = "" } = useQuery({
    queryKey: ["community-link"],
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "community_whatsapp_link")
        .maybeSingle();

      return data?.value || "";
    }
  });

  const handleOpenCommunity = () => {
    if (!communityLink) {
      console.error("Link da comunidade não configurado");
      return;
    }
    window.open(communityLink, '_blank', 'noopener,noreferrer');
  };

  const handleCloseCommunity = async () => {
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ hide_community_message: true })
      .eq("id", user.id);

    // Invalidate community status cache
    queryClient.invalidateQueries({ queryKey: ["community-status", user.id] });
  };

  const handleStartQuestionnaire = () => {
    setShowModal(true);
  };

  const handleCompleteQuestionnaire = () => {
    // Invalidate investor profile cache to refetch
    queryClient.invalidateQueries({ queryKey: ["investor-profile", user?.id] });
  };

  const getProfileColor = (profile: string | null) => {
    switch (profile) {
      case "START":
        return "bg-green-500";
      case "PRO":
        return "bg-blue-500";
      case "SPECIALIST":
        return "bg-purple-500";
      default:
        return "bg-muted";
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "START":
        return "bg-green-500";
      case "PRO":
        return "bg-blue-500";
      case "SPECIALIST":
        return "bg-purple-500";
      default:
        return "bg-muted";
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "SPECIALIST":
        return {
          label: "Premium",
          variant: "default" as const,
          icon: Crown,
          className: "bg-purple-500 hover:bg-purple-600 text-white"
        };
      case "PRO":
        return {
          label: "Ativo",
          variant: "default" as const,
          icon: Sparkles,
          className: "bg-blue-500 hover:bg-blue-600 text-white"
        };
      case "START":
        return {
          label: "Ativo",
          variant: "default" as const,
          icon: Star,
          className: "bg-green-500 hover:bg-green-600 text-white"
        };
      default:
        return {
          label: "Gratuito",
          variant: "secondary" as const,
          icon: null,
          className: "bg-muted text-muted-foreground"
        };
    }
  };

  const getExpirationInfo = () => {
    if (userPlan === "FREE") return { text: "Plano gratuito", isExpiring: false };
    if (userPlan === "SPECIALIST") return { text: "Não expira", isExpiring: false };
    
    if (subscriptionData?.subscription_end) {
      const endDate = new Date(subscriptionData.subscription_end);
      const daysUntilExpiry = differenceInDays(endDate, new Date());
      const isExpiring = daysUntilExpiry <= 7 && daysUntilExpiry > 0;
      
      return {
        text: format(endDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
        isExpiring
      };
    }
    
    return null;
  };

  const investorProfile = investorProfileData?.profile || null;
  const showBanner = investorProfileData?.showBanner || false;
  const isReclassification = investorProfileData?.isReclassification || false;
  const expirationInfo = getExpirationInfo();
  const planBadge = getPlanBadge(userPlan);

  // Determine grid columns based on community card visibility
  const gridCols = showCommunityCard ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <div className="space-y-4">
      {showBanner && (
        <InvestorProfileBanner
          onStartQuestionnaire={handleStartQuestionnaire}
          isReclassification={isReclassification}
        />
      )}

      {lastSyncTime && (() => {
        const minutesSinceSync = Math.floor((Date.now() - lastSyncTime.getTime()) / 60000);
        
        if (isRefreshing) {
          return (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              Atualizando dados da assinatura...
            </div>
          );
        } else if (minutesSinceSync > 10) {
          return (
            <div className="text-xs text-muted-foreground">
              Última atualização: {minutesSinceSync} min atrás
            </div>
          );
        }
        return null;
      })()}

      <div className={cn("grid grid-cols-1 gap-4", gridCols)}>
        {/* Card 1 - Perfil Investidor */}
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-lg", getProfileColor(investorProfile))}>
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Perfil Investidor</p>
                  <h3 className="text-lg font-bold text-foreground">
                    {investorProfile || "Não definido"}
                  </h3>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleStartQuestionnaire}
                className="gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar Perfil
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2 - Plano Atual */}
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-lg", getPlanColor(userPlan))}>
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Plano Atual</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">
                      {getPlanDisplayName(userPlan)}
                    </h3>
                    <Badge className={cn("text-xs gap-1 w-fit", planBadge.className)}>
                      {planBadge.icon && <planBadge.icon className="h-3 w-3" />}
                      {planBadge.label}
                    </Badge>
                  </div>
                  {expirationInfo && (
                    <p className={cn(
                      "text-xs",
                      expirationInfo.isExpiring ? "text-red-600" : "text-muted-foreground"
                    )}>
                      {expirationInfo.text}
                    </p>
                  )}
                </div>
              </div>
              <Button 
                size="sm"
                onClick={() => navigate('/assinatura')}
                className="gap-1.5 w-full sm:w-auto"
              >
                {userPlan === "FREE" || userPlan === "START" || userPlan === "PRO" ? "Fazer Upgrade" : "Trocar Plano"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 3 - Conteúdo Exclusivo (only for paid users) */}
        {showCommunityCard && (
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-primary">
                    <PlayCircle className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Conteúdo Exclusivo</p>
                    <h3 className="text-lg font-bold text-foreground">Vídeos Exclusivos</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => navigate('/app/conteudos')}
                    size="sm"
                  >
                    Assistir
                  </Button>
                  <Button
                    onClick={handleCloseCommunity}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <InvestorProfileModal
        open={showModal}
        onOpenChange={setShowModal}
        onComplete={handleCompleteQuestionnaire}
      />
    </div>
  );
};

export default UserHeader;
