import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SubscriptionPlan {
  id: string;
  plan_code: string;
  display_name: string;
  description: string | null;
  price_quarterly: number;
  price_note: string | null;
  stripe_price_id: string | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const useSubscriptionPlans = () => {
  return useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        features: Array.isArray(item.features) 
          ? item.features as string[]
          : typeof item.features === 'string' 
            ? JSON.parse(item.features) 
            : [],
      })) as SubscriptionPlan[];
    },
  });
};

export const useUpdateSubscriptionPlan = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (plan: Partial<SubscriptionPlan> & { id: string }) => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .update({
          display_name: plan.display_name,
          description: plan.description,
          price_quarterly: plan.price_quarterly,
          price_note: plan.price_note,
          stripe_price_id: plan.stripe_price_id,
          features: JSON.stringify(plan.features) as any,
          is_active: plan.is_active,
          sort_order: plan.sort_order,
        })
        .eq("id", plan.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      toast({
        title: "Plano atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    },
  });
};

export const getPlanByCode = (plans: SubscriptionPlan[] | undefined, code: string) => {
  return plans?.find((p) => p.plan_code === code);
};

export const formatPlanPrice = (priceQuarterly: number) => {
  const monthlyPrice = priceQuarterly / 3;
  return `R$ ${monthlyPrice.toFixed(0).replace(".", ",")}`;
};
