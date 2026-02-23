import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

interface SyncNotificationRequest {
  syncLogId: string;
  status: 'success' | 'partial' | 'failed';
  stats: {
    totalProcessed: number;
    completed: number;
    failed: number;
    totalRows: number;
  };
  startTime: string;
  endTime: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-NOTIFICATION] ${step}${detailsStr}`);
};

const createEmailHTML = (
  status: 'success' | 'partial' | 'failed',
  stats: { totalProcessed: number; completed: number; failed: number; totalRows: number },
  executionTimeMinutes: number,
  dashboardUrl: string
) => {
  const statusConfig = {
    success: {
      emoji: '✅',
      title: 'Sincronização Concluída com Sucesso!',
      color: '#22c55e',
      message: 'Todos os registros foram processados com sucesso.',
    },
    partial: {
      emoji: '⚠️',
      title: 'Sincronização Concluída com Avisos',
      color: '#f59e0b',
      message: 'A sincronização foi concluída, mas alguns registros falharam.',
    },
    failed: {
      emoji: '❌',
      title: 'Sincronização Falhou',
      color: '#ef4444',
      message: 'A sincronização encontrou erros críticos.',
    },
  };

  const config = statusConfig[status];

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; background-color: #f6f9fc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); margin-top: 40px; margin-bottom: 40px;">
          
          <h1 style="color: ${config.color}; font-size: 28px; font-weight: bold; margin: 40px 40px 20px; line-height: 1.4;">
            ${config.emoji} ${config.title}
          </h1>
          
          <p style="color: #333; font-size: 16px; line-height: 26px; margin: 16px 40px;">
            ${config.message}
          </p>

          <div style="margin: 32px 40px; padding: 24px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px; text-align: center;">
                  <p style="font-size: 14px; color: #64748b; margin: 0 0 8px 0; font-weight: 500;">Total de Registros</p>
                  <p style="font-size: 32px; font-weight: bold; color: #1e293b; margin: 0;">${stats.totalRows}</p>
                </td>
                <td style="padding: 12px; text-align: center;">
                  <p style="font-size: 14px; color: #64748b; margin: 0 0 8px 0; font-weight: 500;">Processados</p>
                  <p style="font-size: 32px; font-weight: bold; color: #3b82f6; margin: 0;">${stats.totalProcessed}</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px; text-align: center;">
                  <p style="font-size: 14px; color: #64748b; margin: 0 0 8px 0; font-weight: 500;">Completos</p>
                  <p style="font-size: 32px; font-weight: bold; color: #22c55e; margin: 0;">${stats.completed}</p>
                </td>
                <td style="padding: 12px; text-align: center;">
                  <p style="font-size: 14px; color: #64748b; margin: 0 0 8px 0; font-weight: 500;">Falharam</p>
                  <p style="font-size: 32px; font-weight: bold; color: #ef4444; margin: 0;">${stats.failed}</p>
                </td>
              </tr>
            </table>
          </div>

          <hr style="border: none; border-top: 1px solid #e6ebf1; margin: 32px 40px;">

          <p style="color: #333; font-size: 16px; line-height: 26px; margin: 16px 40px;">
            <strong>Tempo de execução:</strong> ${executionTimeMinutes} minutos
          </p>

          <a href="${dashboardUrl}" target="_blank" style="background-color: #3b82f6; border-radius: 6px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; text-align: center; display: block; padding: 14px 20px; margin: 32px 40px;">
            Ver Detalhes no Dashboard
          </a>

          <p style="color: #8898aa; font-size: 12px; line-height: 16px; margin: 32px 40px 40px; text-align: center;">
            Esta é uma notificação automática do sistema de sincronização Google Sheets.<br>
            Para mais informações, acesse o painel administrativo.
          </p>
        </div>
      </body>
    </html>
  `;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  // Security: Validate cron secret or service role authorization
  const authHeader = req.headers.get('Authorization');
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const isValidCronSecret = cronSecret && expectedSecret && cronSecret === expectedSecret;
  const isServiceRole = authHeader && serviceRoleKey && authHeader.includes(serviceRoleKey);

  if (!isValidCronSecret && !isServiceRole) {
    logStep("Unauthorized request - missing valid cron secret or service role");
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    logStep("Notification request received (authorized)");

    const { syncLogId, status, stats, startTime, endTime }: SyncNotificationRequest = await req.json();

    // Calculate execution time in minutes
    const executionTimeMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    const executionTimeMinutes = Math.round(executionTimeMs / 60000);

    logStep("Processing notification", { syncLogId, status, stats });

    // Get admin emails from Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: adminUsers, error: adminError } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (adminError) {
      logStep("Error fetching admin users", { error: adminError.message });
      throw adminError;
    }

    if (!adminUsers || adminUsers.length === 0) {
      logStep("No admin users found to notify");
      return new Response(
        JSON.stringify({ message: 'No admin users to notify' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get admin emails from profiles
    const { data: profiles, error: profileError } = await supabaseClient
      .from('profiles')
      .select('email')
      .in('id', adminUsers.map(u => u.user_id));

    if (profileError) {
      logStep("Error fetching admin profiles", { error: profileError.message });
      throw profileError;
    }

    const adminEmails = profiles
      ?.map(p => p.email)
      .filter((email): email is string => email !== null) || [];

    if (adminEmails.length === 0) {
      logStep("No admin emails found");
      return new Response(
        JSON.stringify({ message: 'No admin emails to notify' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    logStep("Admin emails found", { count: adminEmails.length });

    // Get app URL from environment or construct it
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
    const dashboardUrl = `https://${projectRef}.lovable.app/app/admin/sync`;

    // Create email HTML
    const html = createEmailHTML(
      status,
      stats,
      executionTimeMinutes,
      dashboardUrl
    );

    logStep("Email template created");

    // Send emails to all admins
    const emailPromises = adminEmails.map(email =>
      resend.emails.send({
        from: 'Sistema de Sincronização <onboarding@resend.dev>',
        to: [email],
        subject: status === 'success' 
          ? '✅ Sincronização Google Sheets Concluída' 
          : status === 'partial'
          ? '⚠️ Sincronização Google Sheets Concluída com Avisos'
          : '❌ Sincronização Google Sheets Falhou',
        html,
      })
    );

    const results = await Promise.allSettled(emailPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logStep("Emails sent", { successful, failed, total: adminEmails.length });

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent: successful,
        emailsFailed: failed,
        recipients: adminEmails.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    logStep("Error sending notification", { error: error.message });
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
