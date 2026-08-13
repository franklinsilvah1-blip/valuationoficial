import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDailyViewLimit } from "@/utils/planHelpers";

export const useViewLimit = () => {
  const { userPlan } = useAuth();
  const [viewsToday, setViewsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);

  // Nenhum dos 4 planos comerciais atuais (START/PRO/SPECIALIST/WEALTH) tem
  // limite diário de visualizações — START já dá acesso à lista completa de
  // ativos, apenas com campos premium bloqueados (ver fieldVisibility.ts).
  // getDailyViewLimit normaliza códigos legados (ex.: "FREE") e sempre retorna
  // null hoje; a estrutura fica pronta caso um limite volte a ser necessário
  // para algum plano no futuro.
  const dailyLimit = getDailyViewLimit(userPlan);
  const hasLimit = dailyLimit !== null;

  useEffect(() => {
    if (!hasLimit) {
      setLoading(false);
      setLimitReached(false);
      setViewsToday(0);
      return;
    }

    loadViewsCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPlan, hasLimit]);

  const loadViewsCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];

      const { count } = await supabase
        .from("asset_views")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("view_date", today);

      setViewsToday(count || 0);
      setLimitReached(dailyLimit !== null && (count || 0) >= dailyLimit);
    } catch (error) {
      console.error("Erro ao carregar contagem:", error);
    } finally {
      setLoading(false);
    }
  };

  const recordView = async (assetId: string): Promise<boolean> => {
    if (!hasLimit) {
      return true;
    }
    
    if (limitReached) {
      console.log("[VIEW-LIMIT] Limit already reached");
      return false;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("asset_views")
        .insert({
          user_id: user.id,
          asset_id: assetId,
          view_date: new Date().toISOString().split('T')[0],
        });

      if (error) throw error;

      await loadViewsCount();
      return true;
    } catch (error) {
      console.error("Erro ao registrar visualização:", error);
      return false;
    }
  };

  const remainingViews = dailyLimit === null ? Infinity : Math.max(0, dailyLimit - viewsToday);

  return {
    viewsToday,
    remainingViews,
    limitReached,
    loading,
    recordView,
    isFreeUser: hasLimit,
  };
};
