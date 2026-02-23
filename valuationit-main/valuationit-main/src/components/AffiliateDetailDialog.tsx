import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
  UserPlus,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";

interface Affiliate {
  id: string;
  user_id: string;
  affiliate_code: string;
  commission_rate: number;
  status: string;
  total_referrals: number;
  total_earnings: number;
  created_at: string;
  last_revenue_at: string | null;
  last_inactivity_notification: string | null;
  profile?: {
    name: string | null;
    email: string | null;
  };
}

interface AffiliateDetailDialogProps {
  affiliate: Affiliate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Referral {
  id: string;
  referred_user_id: string;
  status: string;
  created_at: string;
  converted_at: string | null;
  profile?: {
    name: string | null;
    email: string | null;
  };
}

interface Commission {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  stripe_payment_id: string | null;
}

interface TimelineEvent {
  id: string;
  type: "referral" | "commission" | "status_change" | "creation";
  date: string;
  title: string;
  description: string;
  status: "success" | "pending" | "error" | "info";
}

export function AffiliateDetailDialog({
  affiliate,
  open,
  onOpenChange,
}: AffiliateDetailDialogProps) {
  // Fetch referrals for this affiliate
  const { data: referrals = [], isLoading: isLoadingReferrals } = useQuery({
    queryKey: ["affiliate-referrals", affiliate?.id],
    enabled: !!affiliate?.id && open,
    queryFn: async () => {
      const { data: referralsData, error } = await supabase
        .from("referrals")
        .select("*")
        .eq("affiliate_id", affiliate!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for referred users
      const userIds = referralsData?.map((r) => r.referred_user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      return (referralsData || []).map((referral) => ({
        ...referral,
        profile: profiles?.find((p) => p.id === referral.referred_user_id) || null,
      })) as Referral[];
    },
  });

  // Fetch commissions for this affiliate
  const { data: commissions = [], isLoading: isLoadingCommissions } = useQuery({
    queryKey: ["affiliate-commissions", affiliate?.id],
    enabled: !!affiliate?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commissions")
        .select("*")
        .eq("affiliate_id", affiliate!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Commission[];
    },
  });

  // Build timeline from referrals and commissions
  const timeline: TimelineEvent[] = [];

  // Add creation event
  if (affiliate) {
    timeline.push({
      id: `creation-${affiliate.id}`,
      type: "creation",
      date: affiliate.created_at,
      title: "Afiliado criado",
      description: `Código: ${affiliate.affiliate_code}`,
      status: "info",
    });
  }

  // Add referral events
  referrals.forEach((referral) => {
    timeline.push({
      id: `referral-${referral.id}`,
      type: "referral",
      date: referral.created_at,
      title: "Nova indicação",
      description: referral.profile?.name || referral.profile?.email || "Usuário indicado",
      status: referral.status === "converted" ? "success" : "pending",
    });

    if (referral.converted_at) {
      timeline.push({
        id: `conversion-${referral.id}`,
        type: "referral",
        date: referral.converted_at,
        title: "Conversão realizada",
        description: `${referral.profile?.name || "Usuário"} converteu`,
        status: "success",
      });
    }
  });

  // Add commission events
  commissions.forEach((commission) => {
    timeline.push({
      id: `commission-${commission.id}`,
      type: "commission",
      date: commission.created_at,
      title: "Comissão gerada",
      description: formatCurrency(Number(commission.amount)),
      status: commission.status === "paid" ? "success" : commission.status === "pending" ? "pending" : "info",
    });

    if (commission.paid_at) {
      timeline.push({
        id: `payment-${commission.id}`,
        type: "commission",
        date: commission.paid_at,
        title: "Comissão paga",
        description: formatCurrency(Number(commission.amount)),
        status: "success",
      });
    }
  });

  // Sort timeline by date descending
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Ativo</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pendente</Badge>;
      case "suspended":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">Suspenso</Badge>;
      case "inactive":
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/30">Inativo</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getCommissionStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pendente</Badge>;
      case "approved":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">Aprovada</Badge>;
      case "paid":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Paga</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getReferralStatusBadge(status: string) {
    switch (status) {
      case "registered":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">Registrado</Badge>;
      case "converted":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Convertido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getTimelineIcon(event: TimelineEvent) {
    switch (event.type) {
      case "referral":
        return event.status === "success" ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <UserPlus className="h-4 w-4 text-blue-500" />
        );
      case "commission":
        return event.status === "success" ? (
          <DollarSign className="h-4 w-4 text-green-500" />
        ) : (
          <Clock className="h-4 w-4 text-yellow-500" />
        );
      case "creation":
        return <Calendar className="h-4 w-4 text-primary" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  }

  const pendingCommissions = commissions.filter((c) => c.status === "pending" || c.status === "approved");
  const paidCommissions = commissions.filter((c) => c.status === "paid");
  const convertedReferrals = referrals.filter((r) => r.status === "converted");

  if (!affiliate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{affiliate.profile?.name || "Afiliado"}</span>
            {getStatusBadge(affiliate.status)}
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{affiliate.profile?.email}</span>
            <span>•</span>
            <code className="bg-muted px-2 py-0.5 rounded text-xs">{affiliate.affiliate_code}</code>
            <span>•</span>
            <span>Taxa: {affiliate.commission_rate}%</span>
          </div>
        </DialogHeader>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
          <Card className="border-primary/20">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Indicações
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-2xl font-bold">{referrals.length}</div>
              <p className="text-xs text-muted-foreground">
                {convertedReferrals.length} convertidos
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-500/20">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Total Ganho
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(affiliate.total_earnings || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {paidCommissions.length} pagamentos
              </p>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Pendente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(pendingCommissions.reduce((sum, c) => sum + Number(c.amount), 0))}
              </div>
              <p className="text-xs text-muted-foreground">
                {pendingCommissions.length} comissões
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Conversão
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-2xl font-bold text-blue-600">
                {referrals.length > 0
                  ? Math.round((convertedReferrals.length / referrals.length) * 100)
                  : 0}%
              </div>
              <p className="text-xs text-muted-foreground">taxa de conversão</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="timeline" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="referrals">Indicações ({referrals.length})</TabsTrigger>
            <TabsTrigger value="commissions">Comissões ({commissions.length})</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Timeline Tab */}
            <TabsContent value="timeline" className="mt-0">
              {isLoadingReferrals || isLoadingCommissions ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : timeline.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma atividade registrada.</p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-4">
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                  {timeline.slice(0, 20).map((event) => (
                    <div key={event.id} className="relative flex gap-4">
                      <div className="absolute -left-4 w-6 h-6 rounded-full bg-background border flex items-center justify-center">
                        {getTimelineIcon(event)}
                      </div>
                      <div className="flex-1 ml-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{event.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(event.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      </div>
                    </div>
                  ))}
                  {timeline.length > 20 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      +{timeline.length - 20} eventos anteriores
                    </p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Referrals Tab */}
            <TabsContent value="referrals" className="mt-0">
              {isLoadingReferrals ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : referrals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma indicação realizada.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Indicação</TableHead>
                        <TableHead>Data Conversão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referrals.map((referral) => (
                        <TableRow key={referral.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{referral.profile?.name || "N/A"}</p>
                              <p className="text-xs text-muted-foreground">
                                {referral.profile?.email || "-"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{getReferralStatusBadge(referral.status)}</TableCell>
                          <TableCell>
                            {format(new Date(referral.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {referral.converted_at
                              ? format(new Date(referral.converted_at), "dd/MM/yyyy", { locale: ptBR })
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Commissions Tab */}
            <TabsContent value="commissions" className="mt-0">
              {isLoadingCommissions ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : commissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma comissão gerada.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Criação</TableHead>
                        <TableHead>Data Pagamento</TableHead>
                        <TableHead>ID Stripe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissions.map((commission) => (
                        <TableRow key={commission.id}>
                          <TableCell className="font-medium">
                            {formatCurrency(Number(commission.amount))}
                          </TableCell>
                          <TableCell>{getCommissionStatusBadge(commission.status)}</TableCell>
                          <TableCell>
                            {format(new Date(commission.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {commission.paid_at
                              ? format(new Date(commission.paid_at), "dd/MM/yyyy", { locale: ptBR })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {commission.stripe_payment_id ? (
                              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                                {commission.stripe_payment_id.slice(0, 12)}...
                              </code>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
