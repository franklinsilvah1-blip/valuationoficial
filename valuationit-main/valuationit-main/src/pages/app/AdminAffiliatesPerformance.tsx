import { AppLayout } from "@/components/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { AffiliatePerformanceCharts } from "@/components/AffiliatePerformanceCharts";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function AdminAffiliatesPerformance() {
  const { isAdmin, loading: adminLoading } = useAdminCheck();

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

  if (adminLoading || !isAdmin) {
    return null;
  }

  return (
    <AppLayout title="Histórico de Performance">
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
              <BreadcrumbPage>Histórico</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <AffiliatePerformanceCharts
          referrals={referrals}
          commissions={commissions}
          isLoading={isLoadingReferrals || isLoadingCommissions}
        />
      </div>
    </AppLayout>
  );
}
