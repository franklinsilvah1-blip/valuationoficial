import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-QUEUE] ${step}${detailsStr}`);
};

type PlanType = "START" | "PRO" | "SPECIALIST" | "FALE_C_ESPECIALISTA";
type AssetType = "FII" | "ACAO" | "BDR" | "CRIPTO" | "ETF" | "INDICE" | "RFIXA";
type TrendType = "ALTA" | "BAIXA" | "NEUTRO";

const normalizePlanType = (value: string): PlanType => {
  const normalized = value.toUpperCase().trim();
  
  // Reconhecer "Não Recomendado" → FALE_C_ESPECIALISTA
  if (normalized.includes("NÃO RECOMENDADO") || normalized.includes("NAO RECOMENDADO")) {
    return "FALE_C_ESPECIALISTA";
  }
  
  // Manter compatibilidade com valor antigo "Fale com Especialista"
  if (normalized.includes("FALE") && normalized.includes("ESPECIALISTA")) return "FALE_C_ESPECIALISTA";
  
  if (normalized.includes("SPECIALIST") || normalized === "SPECIALIST") return "SPECIALIST";
  if (normalized.includes("PRO") || normalized === "PRO") return "PRO";
  return "START";
};

const normalizeAssetType = (tipo: string): AssetType => {
  const normalized = tipo.toUpperCase().trim();
  if (normalized === "FII") return "FII";
  if (normalized === "ACAO" || normalized === "AÇÃO") return "ACAO";
  if (normalized === "BDR") return "BDR";
  if (normalized === "CRIPTO") return "CRIPTO";
  if (normalized === "ETF") return "ETF";
  if (normalized === "INDICE" || normalized === "ÍNDICE") return "INDICE";
  if (normalized === "RFIXA" || normalized === "RENDA FIXA") return "RFIXA";
  return "ACAO";
};

const normalizeRecommendation = (value: string | null): string | null => {
  if (!value) return null;
  
  const normalized = value.trim().toUpperCase();
  
  // Mapeamento de valores da planilha para valores aceitos
  const recommendationMap: Record<string, string> = {
    // Novos valores simplificados → manter como estão
    'COMPRA': 'COMPRA',
    'VENDA': 'VENDA',
    'NEUTRA': 'NEUTRA',
    'GANHOS': 'GANHOS',
    'MANTÉM': 'MANTÉM',
    'MANTEM': 'MANTÉM',
    // Valores antigos para compatibilidade
    'COMPRAR': 'COMPRA',
    'VENDER': 'VENDA',
    'MANTER': 'MANTÉM',
    // Valores legados do banco (para compatibilidade retroativa)
    'COMPRA (DY)': 'COMPRA (DY)',
    'COMPRA (RA)': 'COMPRA (RA)',
    'COMPRA (RB)': 'COMPRA (RB)',
    'COMPRA (RM)': 'COMPRA (RM)',
    'Ñ COMPRA (ATF)': 'Ñ COMPRA (ATF)',
    'NÃO COMPRA (ATF)': 'Ñ COMPRA (ATF)',
    'NEUTRA (AF)': 'NEUTRA (AF)',
    'NEUTRA (TF)': 'NEUTRA (TF)',
  };
  
  // Tentar match case-insensitive
  for (const [key, mappedValue] of Object.entries(recommendationMap)) {
    if (normalized === key.toUpperCase()) {
      return mappedValue;
    }
  }
  
  // Se não encontrou, retornar o valor original (para valores novos desconhecidos)
  logStep("Unknown recommendation value, keeping as-is", { value });
  return value.trim();
};

const normalizeTrend = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  
  // Normalizar para valores simplificados
  if (normalized.includes("ALTA")) return "ALTA";
  if (normalized.includes("NEUTRA")) return "NEUTRA";
  if (normalized.includes("BAIXA")) return "BAIXA";
  
  return value.trim();
};

// Helper function to limit small numeric values (for ROI fields - numeric(5,2))
const limitSmallNumericValue = (value: any): number | null => {
  if (value === null || value === undefined || value === "" || value === "-") {
    return null;
  }
  const num = Number(value);
  if (isNaN(num)) return null;
  // Limit for numeric(5,2) fields: roi columns max at 999.99
  return Math.max(-999.99, Math.min(999.99, num));
};

// Helper function to limit large numeric values (for valor, fator_mc - numeric(10,2))
const limitLargeNumericValue = (value: any): number | null => {
  if (value === null || value === undefined || value === "" || value === "-") {
    return null;
  }
  const num = Number(value);
  if (isNaN(num)) return null;
  // Limit for numeric(10,2) fields: valor, fator_mc can go up to 99,999,999.99
  return Math.max(-99999999, Math.min(99999999, num));
};

async function acquireSyncLock(supabaseClient: any): Promise<boolean> {
  const { data: lockData } = await supabaseClient
    .from("app_config")
    .select("value")
    .eq("key", "sync_lock")
    .maybeSingle();

  if (lockData?.value === "true") {
    logStep("❌ Sync lock already held by another instance");
    return false;
  }

  // Acquire lock
  const { error } = await supabaseClient
    .from("app_config")
    .update({ 
      value: "true",
      updated_at: new Date().toISOString()
    })
    .eq("key", "sync_lock");

  if (error) {
    logStep("❌ Failed to acquire lock", { error: error.message });
    return false;
  }

  logStep("✅ Sync lock acquired");
  return true;
}

async function releaseSyncLock(supabaseClient: any) {
  await supabaseClient
    .from("app_config")
    .update({ value: "false" })
    .eq("key", "sync_lock");
  
  logStep("✅ Sync lock released");
}

async function cleanupOrphanedItems(supabaseClient: any) {
  const ORPHAN_THRESHOLD_MINUTES = 5; // Consider orphaned after 5 minutes for faster recovery
  
  // Find old PROCESSING items
  const { data: orphanedItems } = await supabaseClient
    .from("sync_queue")
    .select("id, sync_log_id, created_at")
    .eq("status", "PROCESSING")
    .lt("created_at", new Date(Date.now() - ORPHAN_THRESHOLD_MINUTES * 60 * 1000).toISOString());

  if (orphanedItems && orphanedItems.length > 0) {
    logStep("⚠️ Found orphaned PROCESSING items", { 
      count: orphanedItems.length,
      threshold: `${ORPHAN_THRESHOLD_MINUTES} minutes`,
      syncLogIds: [...new Set(orphanedItems.map((i: any) => i.sync_log_id))]
    });

    // Revert to PENDING
    const { error: revertError } = await supabaseClient
      .from("sync_queue")
      .update({ 
        status: "PENDING",
        error_message: "Auto-recovered from orphaned state"
      })
      .in("id", orphanedItems.map((i: any) => i.id));

    if (revertError) {
      logStep("❌ Error reverting orphaned items", { error: revertError.message });
    } else {
      logStep("✅ Reverted orphaned items to PENDING", { count: orphanedItems.length });
    }

    // Mark orphaned sync_logs as FAILED so they can be restarted
    const orphanedSyncIds = [...new Set(orphanedItems.map((i: any) => i.sync_log_id))];
    for (const syncId of orphanedSyncIds) {
      const { data: syncLog } = await supabaseClient
        .from("sync_logs")
        .select("status")
        .eq("id", syncId)
        .maybeSingle();

      if (syncLog && syncLog.status === "IN_PROGRESS") {
        await supabaseClient
          .from("sync_logs")
          .update({ 
            status: "FAILED",
            completed_at: new Date().toISOString(),
            cancellation_requested: false
          })
          .eq("id", syncId);
        
        logStep("✅ Marked orphaned sync_log as FAILED", { syncId });
      }
    }

    return orphanedItems.length;
  }

  return 0;
}

async function processQueueBatch(
  supabaseClient: any,
  batchSize = 150,
  maxProcessingTimeMs = 50000 // 50 seconds to leave buffer
) {
  const startTime = Date.now();
  
  // Note: Cleanup is now done in main handler before this function is called
  
  // Get pending queue items (just first one to find the sync_log_id)
  const { data: firstQueueItem } = await supabaseClient
    .from("sync_queue")
    .select("sync_log_id")
    .eq("status", "PENDING")
    .limit(1)
    .maybeSingle();

  if (!firstQueueItem) {
    logStep("No pending items in queue");
    return { processed: 0, failed: 0, remaining: 0, syncLogId: null };
  }

  const syncLogId = firstQueueItem.sync_log_id;
  
  // ✅ CORRIGIDO: Verificar se sync_log está em estado válido (aceitar QUEUED e IN_PROGRESS)
  const { data: syncLogStatus } = await supabaseClient
    .from("sync_logs")
    .select("status")
    .eq("id", syncLogId)
    .maybeSingle();

  if (!syncLogStatus) {
    logStep("⚠️ Sync log not found, cleaning orphaned queue items", { syncLogId });
    await supabaseClient
      .from("sync_queue")
      .delete()
      .eq("sync_log_id", syncLogId);
    return { processed: 0, failed: 0, remaining: 0, syncLogId: null };
  }

  // ✅ Aceitar QUEUED (recém-enfileirado) e IN_PROGRESS (já em processamento)
  const validStatuses = ['QUEUED', 'IN_PROGRESS'];
  if (!validStatuses.includes(syncLogStatus.status)) {
    // Só limpar fila para estados terminais (SUCCESS, FAILED, TIMEOUT, PARTIAL)
    logStep("⚠️ Sync log in terminal state, cleaning queue items", { 
      syncLogId, 
      status: syncLogStatus.status 
    });
    await supabaseClient
      .from("sync_queue")
      .delete()
      .eq("sync_log_id", syncLogId);
    return { processed: 0, failed: 0, remaining: 0, syncLogId: null };
  }

  // ✅ Promover QUEUED -> IN_PROGRESS antes de processar o primeiro lote
  if (syncLogStatus.status === 'QUEUED') {
    logStep("📊 Promoting sync_log from QUEUED to IN_PROGRESS", { syncLogId });
    await supabaseClient
      .from("sync_logs")
      .update({ 
        status: 'IN_PROGRESS',
        started_at: new Date().toISOString()
      })
      .eq("id", syncLogId);
  }
  
  // Get all pending queue items for this sync
  const { data: queueItems, error: queueError } = await supabaseClient
    .from("sync_queue")
    .select("*")
    .eq("sync_log_id", syncLogId)
    .eq("status", "PENDING")
    .order("row_index", { ascending: true })
    .limit(batchSize);

  if (queueError) {
    logStep("Error fetching queue items", { error: queueError.message });
    throw queueError;
  }

  if (!queueItems || queueItems.length === 0) {
    logStep("No pending items in queue");
    return { processed: 0, failed: 0, remaining: 0, syncLogId };
  }

  // Atomically mark all items as PROCESSING before processing to prevent concurrent execution
  const itemIds = queueItems.map((item: any) => item.id);
  const { error: markError } = await supabaseClient
    .from("sync_queue")
    .update({ status: "PROCESSING" })
    .in("id", itemIds)
    .eq("status", "PENDING"); // Double-check still PENDING

  if (markError) {
    logStep("Error marking items as PROCESSING", { error: markError.message });
    throw markError;
  }

  logStep("Processing queue batch", { itemCount: queueItems.length });

  let processed = 0;
  let failed = 0;

  for (const item of queueItems) {
    // CHECK CANCELLATION FLAG
    const { data: syncLog } = await supabaseClient
      .from('sync_logs')
      .select('cancellation_requested')
      .eq('id', syncLogId)
      .single();
    
    if (syncLog?.cancellation_requested) {
      logStep("Cancellation detected, stopping batch processing", {
        processed,
        failed,
        remaining: queueItems.length - processed - failed
      });
      break; // Exit loop immediately
    }

    // Check timeout
    if (Date.now() - startTime > maxProcessingTimeMs) {
      logStep("Approaching timeout, stopping batch", {
        processed,
        failed,
        remaining: queueItems.length - processed - failed
      });
      break;
    }

    try {
      // Item already marked as PROCESSING at batch start
      const rowData = item.row_data;
      const tipo = normalizeAssetType(rowData.tipo);
      const carteira = normalizePlanType(rowData.carteira);
      const recomendacao = normalizeRecommendation(rowData.recomendacao);
      const tendencia = normalizeTrend(rowData.tendencia);

      // Check if asset already exists BEFORE upsert
      const { data: existingAsset } = await supabaseClient
        .from("assets")
        .select("id")
        .eq("codigo_b3", rowData.codigo_b3)
        .single();

      const wasUpdate = !!existingAsset;

      // Upsert asset
      const { data: asset, error: assetError } = await supabaseClient
        .from("assets")
        .upsert(
          {
            codigo_b3: rowData.codigo_b3,
            nome: rowData.nome,
            tipo,
            setor: rowData.setor || null,
            is_active: true, // ✅ Mark as active (exists in current spreadsheet)
            updated_at: new Date().toISOString(),
          },
          { onConflict: "codigo_b3" }
        )
        .select()
        .single();

      if (assetError) throw assetError;

      // Prepare analysis data with numeric validation
      const analysisData: any = {
        asset_id: asset.id,
        carteira,
        recomendacao,
        tendencia,
        nota_especialista: rowData.nota_especialista,
        perfil_investidor: rowData.perfil_investidor || null,
        resumo: rowData.resumo || null,
        taxa_semanal: limitSmallNumericValue(rowData.tax_week),
        roi2026: limitSmallNumericValue(rowData.roi_2026),
        roi2025: limitSmallNumericValue(rowData.roi_2025),
        roi2024: limitSmallNumericValue(rowData.roi_2024),
        roitrim: limitSmallNumericValue(rowData.roi_trim),
        roi2023a2025: limitSmallNumericValue(rowData.roi_2023a2025),
        dy2025: limitSmallNumericValue(rowData.dy_2025),
        valor: limitLargeNumericValue(rowData.valor),
        fator_mc: limitLargeNumericValue(rowData.mult_capital),
        updated_at: new Date().toISOString(),
      };

      // Upsert analysis (one per asset now)
      const { error: analysisError } = await supabaseClient
        .from("asset_analyses")
        .upsert(analysisData, {
          onConflict: "asset_id",
          ignoreDuplicates: false
        });

      if (analysisError) throw analysisError;

      // Mark as completed
      await supabaseClient
        .from("sync_queue")
        .update({ 
          status: "COMPLETED", 
          processed_at: new Date().toISOString()
        })
        .eq("id", item.id);

      processed++;
    } catch (error: any) {
      failed++;
      const errorMessage = error.message || String(error);
      
      logStep("Error processing queue item", { 
        itemId: item.id, 
        rowIndex: item.row_index,
        codigo: item.row_data?.codigo_b3,
        error: errorMessage
      });

      // Mark as failed
      await supabaseClient
        .from("sync_queue")
        .update({ 
          status: "FAILED",
          error_message: error.message,
          processed_at: new Date().toISOString()
        })
        .eq("id", item.id);
    }
  }

  // NOVO: Reverter itens PROCESSING não concluídos após timeout/cancelamento
  const totalAttempted = processed + failed;
  if (totalAttempted < queueItems.length) {
    const unprocessedIds = queueItems
      .slice(totalAttempted)
      .map((item: any) => item.id);
    
    if (unprocessedIds.length > 0) {
      logStep("Reverting unprocessed items to PENDING", { 
        count: unprocessedIds.length,
        reason: "Timeout or cancellation before processing"
      });
      
      await supabaseClient
        .from("sync_queue")
        .update({ 
          status: "PENDING",
          error_message: null
        })
        .in("id", unprocessedIds)
        .eq("status", "PROCESSING");
    }
  }

  // Check remaining items for this specific sync
  const { count: remainingCount } = await supabaseClient
    .from("sync_queue")
    .select("*", { count: "exact", head: true })
    .eq("sync_log_id", syncLogId)
    .eq("status", "PENDING");

  logStep("Batch processing complete", { processed, failed, remaining: remainingCount || 0, syncLogId });

  // ✅ NOVO: Atualizar contadores do sync_log DURANTE o processamento
  if (processed > 0 || failed > 0) {
    // Buscar contadores atuais do sync_log
    const { data: currentSyncLog } = await supabaseClient
      .from("sync_logs")
      .select("inserted, updated, failed")
      .eq("id", syncLogId)
      .maybeSingle();

    if (currentSyncLog) {
      // Usar contagem simples de processed já que metadata não existe
      const batchProcessed = processed;

      // Atualizar contadores incrementalmente
      await supabaseClient
        .from("sync_logs")
        .update({
          updated: (currentSyncLog.updated || 0) + batchProcessed,
          failed: (currentSyncLog.failed || 0) + failed,
        })
        .eq("id", syncLogId);

      logStep("✅ Updated sync_log counters", { 
        processed: batchProcessed, 
        failed 
      });
    }
  }

  return { processed, failed, remaining: remainingCount || 0, syncLogId };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: Validate cron secret to prevent unauthorized access
  // Note: This function can also be called by trigger_process_sync_queue with service role
  const authHeader = req.headers.get('Authorization');
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  // Allow if either valid cron secret OR service role token (for internal calls)
  const isValidCronSecret = cronSecret && expectedSecret && cronSecret === expectedSecret;
  const isServiceRole = authHeader && serviceRoleKey && authHeader.includes(serviceRoleKey);
  
  if (!isValidCronSecret && !isServiceRole) {
    logStep("SECURITY: Unauthorized access attempt - invalid credentials");
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      }
    );
  }

  logStep("Queue processor started");

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  // ✅ FIX: Aceitar skipLock do body (chamada interna do sync-google-sheets)
  let skipLock = false;
  try {
    const body = await req.clone().json();
    skipLock = body?.skipLock === true;
  } catch { /* no body = not skipping lock */ }

  logStep("Lock mode", { skipLock });

  try {
    // ✅ Diagnóstico
    const { data: diagnosticInfo } = await supabaseClient
      .from("sync_queue")
      .select("sync_log_id, status")
      .limit(1000);

    const syncLogIds = [...new Set(diagnosticInfo?.map((i: any) => i.sync_log_id) || [])];
    const statusBreakdown = diagnosticInfo?.reduce((acc: any, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    logStep("📊 Queue diagnostic", { 
      totalItems: diagnosticInfo?.length || 0,
      uniqueSyncLogs: syncLogIds.length,
      statusBreakdown,
      syncLogIds: syncLogIds.slice(0, 3)
    });

    // ✅ FIX: Só adquirir lock se NÃO for chamada interna
    if (!skipLock) {
      const lockAcquired = await acquireSyncLock(supabaseClient);
      if (!lockAcquired) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            skipped: true,
            message: "Sync already in progress by another instance" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    } else {
      logStep("⏩ Skipping lock acquisition (inherited from sync-google-sheets)");
    }

    // ✅ CRITICAL FIX: Clean up orphaned items FIRST (before checking PENDING)
    // This ensures that stuck PROCESSING items are reverted to PENDING and detected
    const orphanedCount = await cleanupOrphanedItems(supabaseClient);
    if (orphanedCount > 0) {
      logStep(`✅ Recovered ${orphanedCount} orphaned items`);
    }

    // Check for pending items (orphaned items are now PENDING)
    const { count: pendingCount } = await supabaseClient
      .from("sync_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDING");

    if (!pendingCount || pendingCount === 0) {
      logStep("No pending items in queue");
      
      // ✅ FIX: Verificar e finalizar sync_logs IN_PROGRESS ou QUEUED que foram completados
      const { data: inProgressSyncs } = await supabaseClient
        .from("sync_logs")
        .select("id, started_at, total_rows")
        .in("status", ["IN_PROGRESS", "QUEUED"]);

      if (inProgressSyncs && inProgressSyncs.length > 0) {
        logStep("🔍 Found active sync_logs to check", { count: inProgressSyncs.length });
        
        for (const sync of inProgressSyncs) {
          // Verificar se há itens pendentes ou em processamento para este sync
          const { count: pendingForSync } = await supabaseClient
            .from("sync_queue")
            .select("*", { count: "exact", head: true })
            .eq("sync_log_id", sync.id)
            .in("status", ["PENDING", "PROCESSING"]);

          if (!pendingForSync || pendingForSync === 0) {
            logStep("📊 Finalizing completed sync_log", { syncId: sync.id });
            
            // Buscar metadata original para preservar duplicatas detectadas
            const { data: originalSyncLog } = await supabaseClient
              .from("sync_logs")
              .select("metadata")
              .eq("id", sync.id)
              .single();
            
            const originalMetadata = originalSyncLog?.metadata || {};
            
            // Buscar estatísticas finais da fila
            const { data: queueStats } = await supabaseClient
              .from("sync_queue")
              .select("status")
              .eq("sync_log_id", sync.id);

            const completed = queueStats?.filter((i: any) => i.status === "COMPLETED").length || 0;
            const failed = queueStats?.filter((i: any) => i.status === "FAILED").length || 0;
            const totalProcessed = completed + failed;
            
            // Determinar status final
            const finalStatus = failed === 0 ? "SUCCESS" : failed < completed ? "PARTIAL" : "FAILED";

            // Finalizar sync_log preservando metadata original
            await supabaseClient
              .from("sync_logs")
              .update({
                status: finalStatus,
                completed_at: new Date().toISOString(),
                updated: completed,
                failed: failed,
                total_rows: sync.total_rows || totalProcessed,
                metadata: {
                  ...originalMetadata,
                  finalized_by: "auto_cleanup",
                  finalized_at: new Date().toISOString(),
                  execution_time_ms: Date.now() - new Date(sync.started_at).getTime(),
                  stats: {
                    total_processed: totalProcessed,
                    completed,
                    failed,
                    success_rate: totalProcessed > 0 ? ((completed / totalProcessed) * 100).toFixed(2) + '%' : '0%'
                  }
                }
              })
              .eq("id", sync.id);

            logStep("✅ Finalized sync_log", { 
              syncId: sync.id, 
              status: finalStatus,
              completed,
              failed 
            });

            // Limpar itens COMPLETED da fila
            await supabaseClient
              .from("sync_queue")
              .delete()
              .eq("sync_log_id", sync.id)
              .eq("status", "COMPLETED");

            // Enviar notificação
            try {
              await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sync-notification`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  syncLogId: sync.id,
                  status: finalStatus.toLowerCase(),
                  stats: { totalProcessed, completed, failed, totalRows: sync.total_rows || totalProcessed },
                  startTime: sync.started_at,
                  endTime: new Date().toISOString(),
                })
              });
            } catch (notifError: any) {
              logStep("⚠️ Failed to send notification", { error: notifError.message });
            }
          }
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No pending items in queue",
          orphanedSyncsChecked: inProgressSyncs?.length || 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // This function is called by cron or by other edge functions with service role
    // Authentication is handled by CRON_SECRET validation at the top of the function
    logStep("Processing queue batch");

    const result = await processQueueBatch(supabaseClient);

    // If there are remaining items, the cron will pick them up in the next run
    const status = result.remaining === 0 ? 'SUCCESS' : 'IN_PROGRESS';

    // If queue is complete, send notification email
    if (status === 'SUCCESS' && result.syncLogId) {
      logStep("Queue complete, sending notification", { syncLogId: result.syncLogId });
      
      try {
        // Get sync log details
        const { data: syncLog } = await supabaseClient
          .from("sync_logs")
          .select("*")
          .eq("id", result.syncLogId)
          .single();

        if (syncLog) {
          // Get queue stats WITH metadata
          const { data: queueStats } = await supabaseClient
            .from("sync_queue")
            .select("status, metadata")
            .eq("sync_log_id", result.syncLogId);

          if (queueStats) {
            const stats = {
              totalProcessed: queueStats.length,
              completed: queueStats.filter((i: any) => i.status === 'COMPLETED').length,
              failed: queueStats.filter((i: any) => i.status === 'FAILED').length,
              totalRows: syncLog.total_rows || queueStats.length,
            };

            // NOVO: Limpar itens PROCESSING órfãos antes de finalizar
            const { data: orphanedItems } = await supabaseClient
              .from('sync_queue')
              .select('id')
              .eq('sync_log_id', result.syncLogId)
              .eq('status', 'PROCESSING');

            if (orphanedItems && orphanedItems.length > 0) {
              logStep("Found orphaned PROCESSING items", { 
                count: orphanedItems.length,
                syncLogId: result.syncLogId 
              });
              
              await supabaseClient
                .from('sync_queue')
                .update({
                  status: 'FAILED',
                  error_message: 'Não processado - marcado como órfão ao finalizar sync',
                  processed_at: new Date().toISOString()
                })
                .eq('sync_log_id', result.syncLogId)
                .eq('status', 'PROCESSING');
              
              logStep("Marked orphaned items as FAILED", { count: orphanedItems.length });
              
              // Atualizar contadores no stats
              stats.failed += orphanedItems.length;
              stats.totalProcessed += orphanedItems.length;
            }

            const notificationStatus = stats.failed === 0 ? 'success' : stats.failed < stats.completed ? 'partial' : 'failed';

            // Update sync log status with complete information
            await supabaseClient
              .from("sync_logs")
              .update({ 
                status: notificationStatus.toUpperCase(),
                completed_at: new Date().toISOString(),
                updated: stats.completed,
                failed: stats.failed,
                total_rows: stats.totalRows,
                errors: stats.failed > 0 ? [{
                  error: `${stats.failed} itens falharam durante o processamento`,
                  timestamp: new Date().toISOString()
                }] : null,
                metadata: {
                  ...syncLog.metadata,
                  started_at: syncLog.started_at,
                  completed_at: new Date().toISOString(),
                  execution_time_ms: Date.now() - new Date(syncLog.started_at).getTime(),
                  final_status: notificationStatus,
                  queue_completed: true,
                  notification_sent: true,
                  stats: {
                    total_processed: stats.totalProcessed,
                    completed: stats.completed,
                    failed: stats.failed,
                    success_rate: ((stats.completed / stats.totalProcessed) * 100).toFixed(2) + '%'
                  }
                }
              })
              .eq("id", result.syncLogId);

            // Post-sync cleanup: Deactivate assets not in spreadsheet
            let orphanedAssetsInfo = { count: 0, assets: [] as Array<{ codigo: string; nome: string }> };
            
            if (notificationStatus === 'success') {
              logStep("🧹 Post-sync cleanup: Deactivating assets not in spreadsheet");
              
              // ✅ MÉTODO MELHORADO: Usar lista explícita de códigos B3 da planilha
              const sheetCodigosB3 = syncLog.metadata?.sheet_codigos_b3 || [];
              
              if (sheetCodigosB3.length > 0) {
                // Buscar ativos que estão ativos mas NÃO estão na planilha (buscar também o nome)
                const { data: assetsToDeactivate, error: deactivateCheckError } = await supabaseClient
                  .from("assets")
                  .select("id, codigo_b3, nome")
                  .eq("is_active", true)
                  .not("codigo_b3", "in", `(${sheetCodigosB3.join(',')})`);
                
                if (!deactivateCheckError && assetsToDeactivate && assetsToDeactivate.length > 0) {
                  logStep("Found assets to deactivate (not in sheet)", { 
                    count: assetsToDeactivate.length,
                    orphanAssets: assetsToDeactivate.map((a: any) => a.codigo_b3)
                  });
                  
                  // Armazenar informações dos ativos órfãos para o metadata
                  orphanedAssetsInfo = {
                    count: assetsToDeactivate.length,
                    assets: assetsToDeactivate.map((a: any) => ({ 
                      codigo: a.codigo_b3, 
                      nome: a.nome 
                    }))
                  };
                  
                  const orphanIds = assetsToDeactivate.map((a: any) => a.id);
                  const { error: deactivateError } = await supabaseClient
                    .from("assets")
                    .update({ 
                      is_active: false,
                      updated_at: new Date().toISOString()
                    })
                    .in("id", orphanIds);
                  
                  if (deactivateError) {
                    logStep("⚠️ Warning: Could not deactivate orphan assets", { 
                      error: deactivateError.message 
                    });
                  } else {
                    logStep("✅ Deactivated orphan assets", { 
                      count: assetsToDeactivate.length,
                      assets: assetsToDeactivate.map((a: any) => a.codigo_b3)
                    });
                  }
                } else if (assetsToDeactivate && assetsToDeactivate.length === 0) {
                  logStep("✅ No orphan assets to deactivate - all assets current");
                }
              } else {
                // Fallback: usar método antigo baseado em timestamp
                logStep("⚠️ No sheet_codigos_b3 in metadata, using timestamp fallback");
                const syncStartTime = syncLog.started_at || new Date().toISOString();
                
                const { data: assetsToDeactivate } = await supabaseClient
                  .from("assets")
                  .select("id, codigo_b3, nome, updated_at")
                  .lt("updated_at", syncStartTime)
                  .eq("is_active", true);
                
                if (assetsToDeactivate && assetsToDeactivate.length > 0) {
                  orphanedAssetsInfo = {
                    count: assetsToDeactivate.length,
                    assets: assetsToDeactivate.map((a: any) => ({ 
                      codigo: a.codigo_b3, 
                      nome: a.nome 
                    }))
                  };
                  
                  const orphanIds = assetsToDeactivate.map((a: any) => a.id);
                  await supabaseClient
                    .from("assets")
                    .update({ is_active: false })
                    .in("id", orphanIds);
                  
                  logStep("✅ Deactivated old assets (timestamp fallback)", { 
                    count: assetsToDeactivate.length 
                  });
                }
              }
              
              // Atualizar metadata do sync_log com informações dos ativos órfãos
              if (orphanedAssetsInfo.count > 0) {
                await supabaseClient
                  .from("sync_logs")
                  .update({
                    metadata: {
                      ...syncLog.metadata,
                      orphansDeactivated: orphanedAssetsInfo.count,
                      orphanedAssets: orphanedAssetsInfo.assets,
                    }
                  })
                  .eq("id", result.syncLogId);
                
                logStep("✅ Updated sync_log metadata with orphaned assets info", {
                  count: orphanedAssetsInfo.count
                });
              }
            }

            // Cleanup COMPLETED items from this sync
            const { error: cleanupError } = await supabaseClient
              .from('sync_queue')
              .delete()
              .eq('sync_log_id', result.syncLogId)
              .eq('status', 'COMPLETED');
            
            if (cleanupError) {
              logStep("Failed to cleanup completed items", { error: cleanupError.message });
            } else {
              logStep("Cleaned up COMPLETED items", { syncLogId: result.syncLogId });
            }

            // Send notification via edge function
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-sync-notification`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                syncLogId: result.syncLogId,
                status: notificationStatus,
                stats,
                startTime: syncLog.started_at,
                endTime: new Date().toISOString(),
              })
            }).catch(err => logStep("Error sending notification", { error: err.message }));

            logStep("Notification triggered");
          }
        }
      } catch (notificationError: any) {
        logStep("Error processing notification", { error: notificationError.message });
        // Don't fail the whole process if notification fails
      }
    }

    logStep("Queue processing completed", { status, ...result });

    // ✅ FIX: Auto-continuation - re-trigger self if remaining items
    if (result.remaining > 0) {
      logStep("🔄 Auto-continuing: triggering next batch", { remaining: result.remaining });
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-sync-queue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
          'x-cron-secret': Deno.env.get('CRON_SECRET') || '',
          'X-Trigger-Type': 'auto'
        },
        body: JSON.stringify({ skipLock: true })
      }).catch(err => logStep("Error triggering next batch", { error: err.message }));
    }

    return new Response(
      JSON.stringify({
        success: true,
        status,
        processed: result.processed,
        failed: result.failed,
        remaining: result.remaining
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error: any) {
    logStep("❌ Queue processing error", { error: error.message });

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: error.message.includes('AUTH') ? 401 : 500
      }
    );
  } finally {
    // CRITICAL: Always release lock, even on errors
    await releaseSyncLock(supabaseClient);
  }
});
