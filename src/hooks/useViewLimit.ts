import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useViewLimit = () => {
  const { userPlan } = useAuth();
  const [viewsToday, setViewsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  
  const FREE_PLAN_LIMIT = 3;

  useEffect(() => {
    console.log("[VIEW-LIMIT] User plan:", userPlan);
    if (userPlan !== "FREE") {
      console.log("[VIEW-LIMIT] User is not FREE, skipping view limit");
      setLoading(false);
      setLimitReached(false);
      setViewsToday(0);
      return;
    }
    
    if (userPlan === "FREE") {
      loadViewsCount();
    }
  }, [userPlan]);

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
      setLimitReached((count || 0) >= FREE_PLAN_LIMIT);
    } catch (error) {
      console.error("Erro ao carregar contagem:", error);
    } finally {
      setLoading(false);
    }
  };

  const recordView = async (assetId: string): Promise<boolean> => {
    console.log("[VIEW-LIMIT] Recording view for asset:", assetId, "User plan:", userPlan);
    if (userPlan !== "FREE") {
      console.log("[VIEW-LIMIT] User is not FREE, view allowed without recording");
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

  const remainingViews = Math.max(0, FREE_PLAN_LIMIT - viewsToday);

  return {
    viewsToday,
    remainingViews,
    limitReached,
    loading,
    recordView,
    isFreeUser: userPlan === "FREE",
  };
};
