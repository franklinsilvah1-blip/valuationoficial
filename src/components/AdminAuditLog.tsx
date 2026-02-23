import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, History, User, Calendar, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: string;
  user_id: string;
  granted_by: string | null;
  action: string;
  old_plan: string | null;
  new_plan: string | null;
  created_at: string;
  metadata: any;
  user_email?: string;
  admin_email?: string;
}

const PLAN_LABELS = {
  FREE: "Plano Grátis",
  START: "Plano Start",
  PRO: "Plano Pro",
  SPECIALIST: "Plano Especialista",
};

const ACTION_LABELS: Record<string, string> = {
  admin_plan_change: "Alteração Administrativa",
  stripe_plan_update: "Atualização Stripe",
  admin_role_granted_auto_specialist: "Função Admin Concedida",
};

export function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      // Fetch audit logs with user information
      const { data: logsData, error: logsError } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (logsError) throw logsError;

      // Get unique user IDs
      const userIds = new Set<string>();
      logsData?.forEach((log) => {
        userIds.add(log.user_id);
        if (log.granted_by) userIds.add(log.granted_by);
      });

      // Fetch user emails
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, name")
        .in("id", Array.from(userIds));

      const emailMap = new Map(
        profiles?.map((p) => [p.id, p.email || p.name || "Usuário"]) || []
      );

      const enrichedLogs = logsData?.map((log) => ({
        ...log,
        user_email: emailMap.get(log.user_id),
        admin_email: log.granted_by ? emailMap.get(log.granted_by) : null,
      })) || [];

      setLogs(enrichedLogs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeTypeBadge = (metadata: any) => {
    const changeType = metadata?.change_type;
    if (changeType === "administrative") {
      return <Badge variant="secondary">Sem Cobrança</Badge>;
    } else if (changeType === "stripe") {
      return <Badge variant="default">Com Cobrança</Badge>;
    }
    return null;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Alterações
          </CardTitle>
          <CardDescription>
            Rastreamento de todas as alterações de plano
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Alterações
        </CardTitle>
        <CardDescription>
          Rastreamento de todas as alterações de plano realizadas por administradores
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma alteração registrada ainda
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 space-y-2 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                        {getChangeTypeBadge(log.metadata)}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{log.user_email}</span>
                      </div>

                      {log.old_plan && log.new_plan && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>
                            {PLAN_LABELS[log.old_plan as keyof typeof PLAN_LABELS] || log.old_plan}
                          </span>
                          <ArrowRight className="h-4 w-4" />
                          <span className="font-medium text-foreground">
                            {PLAN_LABELS[log.new_plan as keyof typeof PLAN_LABELS] || log.new_plan}
                          </span>
                        </div>
                      )}

                      {log.admin_email && (
                        <div className="text-xs text-muted-foreground">
                          Alterado por: {log.admin_email}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(log.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
