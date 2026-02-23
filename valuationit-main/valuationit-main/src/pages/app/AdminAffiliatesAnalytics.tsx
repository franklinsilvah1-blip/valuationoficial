import { AppLayout } from "@/components/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { AffiliateAnalyticsDashboard } from "@/components/AffiliateAnalyticsDashboard";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function AdminAffiliatesAnalytics() {
  const { isAdmin, loading: adminLoading } = useAdminCheck();

  const { data: affiliates = [], isLoading: isLoadingAffiliates } = useQuery({
    queryKey: ["admin-affiliates"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: affiliatesData, error } = await supabase
        .from("affiliates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userIds = affiliatesData?.map(a => a.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      return (affiliatesData || []).map(affiliate => ({
        ...affiliate,
        profile: profiles?.find(p => p.id === affiliate.user_id) || null,
      }));
    },
  });

  const { data: referrals = [], isLoading: isLoadingReferrals } = useQuery({
    queryKey: ["admin-referrals"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: commissions = [], isLoading: isLoadingCommissions } = useQuery({
    queryKey: ["admin-commissions"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clicks = [], isLoading: isLoadingClicks } = useQuery({
    queryKey: ["admin-affiliate-clicks"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_clicks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (adminLoading || !isAdmin) {
    return null;
  }

  return (
    <AppLayout title="Analytics de Afiliados">
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/app/admin">Admin</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/app/admin/affiliates">Afiliados</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Analytics</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <AffiliateAnalyticsDashboard
          affiliates={affiliates}
          referrals={referrals}
          commissions={commissions}
          clicks={clicks}
          isLoading={isLoadingReferrals || isLoadingCommissions || isLoadingAffiliates || isLoadingClicks}
        />
      </div>
    </AppLayout>
  );
}
