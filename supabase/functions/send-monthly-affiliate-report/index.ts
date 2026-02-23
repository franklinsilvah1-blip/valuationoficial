import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, getSenderConfig } from "../_shared/email.ts";
import { secureLog, maskId } from "../_shared/logger.ts";

const LOGO_URL = "https://valuationit.com.br/logo.webp";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface AffiliateReport {
  affiliateId: string;
  userId: string;
  email: string;
  name: string;
  affiliateCode: string;
  newReferrals: number;
  totalCommissions: number;
}

interface ReportStats {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ affiliateId: string; error: string }>;
}

function getMotivationalPhrase(referrals: number, commissions: number): string {
  if (referrals === 0 && commissions === 0) {
    return "O próximo mês pode ser seu! Continue divulgando seu link e compartilhando as oportunidades.";
  } else if (referrals >= 1 && referrals <= 3) {
    return "Bom trabalho! Você está no caminho certo. Continue assim!";
  } else if (referrals >= 4 && referrals <= 7) {
    return "Excelente! Você está indo muito bem! Seu esforço está dando resultados.";
  } else if (referrals >= 8 && referrals <= 15) {
    return "🌟 Incrível! Você é um top afiliado! Seu desempenho é inspirador.";
  } else if (referrals > 15) {
    return "🏆 Extraordinário! Você é uma referência no programa de afiliados! Parabéns pelo resultado excepcional!";
  } else if (commissions > 0) {
    return "Ótimo progresso! Suas comissões estão crescendo. Mantenha o ritmo!";
  }
  return "Continue divulgando! Cada indicação conta para o seu sucesso.";
}

function getMonthName(month: number): string {
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return months[month];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function generateReportEmail(report: AffiliateReport, monthName: string, year: number): string {
  const motivationalPhrase = getMotivationalPhrase(report.newReferrals, report.totalCommissions);
  const panelUrl = "https://valuationit.com.br/app/afiliado";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seu Relatório Mensal de Afiliado</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f9;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">
          
          <!-- Header com Gradiente -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); padding: 40px 30px; text-align: center;">
              <img src="${LOGO_URL}" alt="VALUATION Invest Tech" style="max-width: 180px; height: auto; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                📊 Relatório Mensal
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 18px;">
                ${monthName} de ${year}
              </p>
            </td>
          </tr>

          <!-- Saudação -->
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <p style="margin: 0; font-size: 16px; color: #374151; line-height: 1.6;">
                Olá, <strong style="color: #6366f1;">${report.name || 'Afiliado'}</strong>! 👋
              </p>
              <p style="margin: 15px 0 0 0; font-size: 16px; color: #6b7280; line-height: 1.6;">
                Confira seu desempenho como afiliado no mês de ${monthName}:
              </p>
            </td>
          </tr>

          <!-- Cards de Métricas -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <!-- Card Indicações -->
                  <td style="width: 48%; padding: 0 5px 0 0;">
                    <div style="background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border-radius: 12px; padding: 25px; text-align: center;">
                      <div style="font-size: 36px; margin-bottom: 10px;">👥</div>
                      <div style="font-size: 32px; font-weight: 700; color: #6366f1; margin-bottom: 5px;">
                        ${report.newReferrals}
                      </div>
                      <div style="font-size: 14px; color: #7c3aed; font-weight: 500;">
                        Nova${report.newReferrals !== 1 ? 's' : ''} Indicaç${report.newReferrals !== 1 ? 'ões' : 'ão'}
                      </div>
                    </div>
                  </td>
                  <!-- Card Comissões -->
                  <td style="width: 48%; padding: 0 0 0 5px;">
                    <div style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); border-radius: 12px; padding: 25px; text-align: center;">
                      <div style="font-size: 36px; margin-bottom: 10px;">💰</div>
                      <div style="font-size: 32px; font-weight: 700; color: #16a34a; margin-bottom: 5px;">
                        ${formatCurrency(report.totalCommissions)}
                      </div>
                      <div style="font-size: 14px; color: #15803d; font-weight: 500;">
                        Comissões Geradas
                      </div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Frase Motivacional -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; text-align: center; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; font-size: 16px; color: #92400e; font-style: italic; line-height: 1.5;">
                  "${motivationalPhrase}"
                </p>
              </div>
            </td>
          </tr>

          <!-- Código de Afiliado -->
          <tr>
            <td style="padding: 0 30px 30px 30px; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
                Seu código de afiliado:
              </p>
              <div style="display: inline-block; background-color: #f3f4f6; padding: 10px 25px; border-radius: 8px; border: 2px dashed #d1d5db;">
                <code style="font-size: 18px; font-weight: 700; color: #374151; letter-spacing: 2px;">
                  ${report.affiliateCode}
                </code>
              </div>
            </td>
          </tr>

          <!-- Botão CTA -->
          <tr>
            <td style="padding: 0 30px 40px 30px; text-align: center;">
              <a href="${panelUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);">
                Acessar Painel Completo →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <img src="${LOGO_URL}" alt="VALUATION" style="max-width: 100px; height: auto; opacity: 0.7; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
                Continue indicando e aumente seus ganhos!
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Este é um e-mail automático enviado no primeiro dia de cada mês.
              </p>
              <p style="margin: 15px 0 0 0; font-size: 12px; color: #9ca3af;">
                © ${year} VALUATION Invest Tech. Todos os direitos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stats: ReportStats = {
    total: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Verificação de segurança via CRON_SECRET
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = Deno.env.get("CRON_SECRET");

    if (!cronSecret || cronSecret !== expectedSecret) {
      console.error("Unauthorized: Invalid or missing CRON_SECRET");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("=== MONTHLY AFFILIATE REPORT STARTED ===");

    // Calcular período do mês anterior
    const today = new Date();
    const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
    
    const monthName = getMonthName(firstDayLastMonth.getMonth());
    const year = firstDayLastMonth.getFullYear();

    console.log(`Report period: ${monthName}/${year}`);
    console.log(`Date range: ${firstDayLastMonth.toISOString()} to ${lastDayLastMonth.toISOString()}`);

    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get sender config
    const senderConfig = await getSenderConfig(supabase);

    // Buscar todos afiliados ativos
    const { data: affiliates, error: affiliatesError } = await supabase
      .from("affiliates")
      .select("id, user_id, affiliate_code")
      .eq("status", "active");

    if (affiliatesError) {
      console.error("Error fetching affiliates:", affiliatesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch affiliates", stats }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!affiliates || affiliates.length === 0) {
      console.log("No active affiliates found");
      return new Response(
        JSON.stringify({ message: "No active affiliates to process", stats }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    stats.total = affiliates.length;
    console.log(`Found ${stats.total} active affiliates to process`);

    // Processar cada afiliado
    for (const affiliate of affiliates) {
      try {
        secureLog.info("Processing affiliate", { affiliateId: affiliate.id });

        // Buscar dados do profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", affiliate.user_id)
          .single();

        if (profileError || !profile?.email) {
          console.warn(`Skipping affiliate ${maskId(affiliate.id)}: No email found`);
          stats.skipped++;
          continue;
        }

        // Contar referrals do mês anterior
        const { count: referralsCount, error: referralsError } = await supabase
          .from("referrals")
          .select("*", { count: "exact", head: true })
          .eq("affiliate_id", affiliate.id)
          .gte("created_at", firstDayLastMonth.toISOString())
          .lte("created_at", lastDayLastMonth.toISOString());

        if (referralsError) {
          console.warn(`Error counting referrals for affiliate ${maskId(affiliate.id)}:`, referralsError);
        }

        // Somar comissões do mês anterior
        const { data: commissionsData, error: commissionsError } = await supabase
          .from("commissions")
          .select("amount")
          .eq("affiliate_id", affiliate.id)
          .gte("created_at", firstDayLastMonth.toISOString())
          .lte("created_at", lastDayLastMonth.toISOString());

        if (commissionsError) {
          console.warn(`Error fetching commissions for affiliate ${maskId(affiliate.id)}:`, commissionsError);
        }

        const totalCommissions = commissionsData?.reduce((sum, c) => sum + Number(c.amount || 0), 0) || 0;

        const report: AffiliateReport = {
          affiliateId: affiliate.id,
          userId: affiliate.user_id,
          email: profile.email,
          name: profile.name || "Afiliado",
          affiliateCode: affiliate.affiliate_code,
          newReferrals: referralsCount || 0,
          totalCommissions,
        };

        secureLog.info("Report data compiled", {
          affiliateId: affiliate.id,
          referrals: report.newReferrals,
          commissions: report.totalCommissions,
        });

        // Gerar e-mail
        const emailHtml = generateReportEmail(report, monthName, year);
        const subject = `📊 Seu desempenho como afiliado em ${monthName}/${year}`;

        // Enviar e-mail via Resend API
        const emailResult = await sendEmail({
          to: profile.email,
          subject,
          html: emailHtml,
          from: senderConfig ? {
            name: senderConfig.name,
            email: senderConfig.email,
          } : undefined,
        });

        if (!emailResult.success) {
          throw new Error(emailResult.error || "Failed to send email");
        }

        stats.sent++;
        secureLog.info("Email sent successfully", { 
          affiliateId: affiliate.id, 
          email: profile.email 
        });

      } catch (error) {
        stats.failed++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        stats.errors.push({ affiliateId: affiliate.id, error: errorMessage });
        
        secureLog.error("Failed to send report", error, { 
          affiliateId: affiliate.id 
        });
      }
    }

    // Log final
    console.log("=== MONTHLY AFFILIATE REPORT COMPLETED ===");
    console.log(`Total: ${stats.total}, Sent: ${stats.sent}, Failed: ${stats.failed}, Skipped: ${stats.skipped}`);

    if (stats.errors.length > 0) {
      console.log("Errors:", JSON.stringify(stats.errors.map(e => ({
        affiliateId: maskId(e.affiliateId),
        error: e.error,
      }))));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Monthly report completed for ${monthName}/${year}`,
        stats: {
          total: stats.total,
          sent: stats.sent,
          failed: stats.failed,
          skipped: stats.skipped,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("=== MONTHLY REPORT CRITICAL ERROR ===", error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        stats,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
