import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { LineChart, ShoppingCart, PlayCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import UserHeader from "@/components/UserHeader";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Query for total market assets count
  const { data: marketAssetsCount = 0, isLoading: isLoadingMarket } = useQuery({
    queryKey: ["market-assets-count"],
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("assets")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching market assets count:", error);
        return 0;
      }
      return count || 0;
    }
  });

  // Query for user's wallet assets count (from favorites)
  const { data: walletAssetsCount = 0, isLoading: isLoadingWallet } = useQuery({
    queryKey: ["wallet-assets-count", user?.id],
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("asset_favorites")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);

      if (error) {
        console.error("Error fetching wallet assets count:", error);
        return 0;
      }
      return count || 0;
    }
  });

  // Query for exclusive videos count
  const { data: videosCount = 0, isLoading: isLoadingVideos } = useQuery({
    queryKey: ["exclusive-videos-count"],
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("exclusive_videos")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching videos count:", error);
        return 0;
      }
      return count || 0;
    }
  });

  // Real-time subscription for favorites changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('favorites-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asset_favorites'
        },
        () => {
          // Invalidate wallet count query on any favorites change
          queryClient.invalidateQueries({ queryKey: ["wallet-assets-count", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        <UserHeader />
        
        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-primary/20 hover:border-primary/40"
            onClick={() => navigate('/app/mercado')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">Mercado</CardTitle>
              <LineChart className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Explore ativos e análises especializadas
              </p>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1">
                  <span className="text-xs text-muted-foreground">Ativos disponíveis:</span>
                  {isLoadingMarket ? (
                    <Skeleton className="inline-block h-4 w-8" />
                  ) : (
                    <span className="text-sm font-bold text-primary">{marketAssetsCount}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-primary/20 hover:border-primary/40"
            onClick={() => navigate('/app/carteira')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">Carteira</CardTitle>
              <ShoppingCart className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Gerencie seus investimentos e simulações
              </p>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1">
                  <span className="text-xs text-muted-foreground">Ativos na sua carteira:</span>
                  {isLoadingWallet ? (
                    <Skeleton className="inline-block h-4 w-8" />
                  ) : (
                    <span className="text-sm font-bold text-primary">{walletAssetsCount}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-primary/20 hover:border-primary/40"
            onClick={() => navigate('/app/conteudos')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">Conteúdos</CardTitle>
              <PlayCircle className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Assista às vídeo aulas exclusivas
              </p>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1">
                  <span className="text-xs text-muted-foreground">Vídeos disponíveis:</span>
                  {isLoadingVideos ? (
                    <Skeleton className="inline-block h-4 w-8" />
                  ) : (
                    <span className="text-sm font-bold text-primary">{videosCount}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
