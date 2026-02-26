import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { corsHeaders } from "../_shared/cors.ts";

function logStep(step: string, details?: any) {
  console.log(`[MONITOR-QUEUE] ${step}`, details ? `- ${JSON.stringify(details)}` : '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    
    if (!cronSecret || cronSecret !== expectedSecret) {
      logStep("SECURITY: Unauthorized access attempt - invalid cron secret");
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep("Monitor started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // ✅ Auto-cleanup: limpar sync_logs órfãos logo no início
    logStep("Running auto-cleanup for orphaned sync_logs");
    const { error: cleanupError } = await supabaseClient.rpc('cleanup_orphaned_syncs');
    if (cleanupError) {
      logStep("⚠️ Auto-cleanup error (non-critical)", { error: cleanupError.message });
    } else {
      logStep("✅ Auto-cleanup completed");
    }

    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const issues: string[] = [];

    // NEW: Auto-detect and fix orphaned PROCESSING items (>10 minutes old)
    const { data: oldProcessingItems } = await supabaseClient
      .from('sync_queue')
      .select('id, created_at, sync_log_id')
      .eq('status', 'PROCESSING')
      .lt('created_at', tenMinutesAgo);

    if (oldProcessingItems && oldProcessingItems.length > 5) {
      logStep("Auto-recovering orphaned PROCESSING items", {
        count: oldProcessingItems.length,
        age: ">10 minutes"
      });
      
      issues.push(`${oldProcessingItems.length} itens órfãos (PROCESSING >10min) - auto-recuperando`);
      
      // Auto-correct immediately: revert to PENDING
      const { error: autoFixError } = await supabaseClient
        .from('sync_queue')
        .update({ 
          status: 'PENDING', 
          error_message: 'Auto-recovered by monitor (>10min)' 
        })
        .in('id', oldProcessingItems.map((i: any) => i.id));

      if (!autoFixError) {
        logStep("✅ Successfully auto-recovered orphaned items", { 
          count: oldProcessingItems.length 
        });
      } else {
        logStep("❌ Failed to auto-recover", { error: autoFixError });
      }
    }

    // 1. Check for stuck/orphaned PROCESSING items
    // Detectar itens de syncs já finalizados (órfãos) OU realmente travados (>10 minutos)
    const { data: stuckItems, error: stuckError } = await supabaseClient
      .from('sync_queue')
      .select(`
        id, 
        row_data, 
        created_at, 
        attempts,
        sync_log_id,
        sync_logs!inner(status, completed_at, started_at)
      `)
      .eq('status', 'PROCESSING');

    if (stuckError) {
      logStep("Error checking stuck items", { error: stuckError });
    } else if (stuckItems && stuckItems.length > 0) {
      // Filter for truly stuck items:
      // 1. Orphaned (sync already completed/failed)
      // 2. Really stuck (>10 minutes, not just 60 seconds)
      const trulyStuckItems = stuckItems.filter((item: any) => {
        const syncStatus = item.sync_logs?.status;
        const itemAgeMs = Date.now() - new Date(item.created_at).getTime();
        const tenMinutesMs = 10 * 60 * 1000;
        
        // Item is stuck if:
        // - Associated sync already completed (orphaned)
        // - OR item has been processing for more than 10 minutes
        const isSyncCompleted = ['SUCCESS', 'FAILED', 'TIMEOUT', 'COMPLETE'].includes(syncStatus);
        const isReallyOld = itemAgeMs > tenMinutesMs;
        
        return isSyncCompleted || isReallyOld;
      });

      if (trulyStuckItems.length > 0) {
        logStep("Found truly stuck/orphaned items", { 
          count: trulyStuckItems.length,
          reasons: {
            completedSyncs: trulyStuckItems.filter((i: any) => 
              ['SUCCESS', 'FAILED', 'TIMEOUT', 'COMPLETE'].includes(i.sync_logs?.status)
            ).length,
            reallyOldItems: trulyStuckItems.filter((i: any) => {
              const itemAgeMs = Date.now() - new Date(i.created_at).getTime();
              return itemAgeMs > (10 * 60 * 1000);
            }).length
          }
        });
        
        issues.push(`${trulyStuckItems.length} itens PROCESSING realmente travados detectados`);

        // Marcar como FAILED
        const { error: failError } = await supabaseClient
          .from('sync_queue')
          .update({ 
            status: 'FAILED',
            error_message: 'Marcado como travado pelo monitor - sync finalizado ou timeout >10min',
            processed_at: new Date().toISOString()
          })
          .in('id', trulyStuckItems.map((item: any) => item.id));

        if (failError) {
          logStep("Error marking stuck items as FAILED", { error: failError });
        } else {
          logStep("Marked stuck items as FAILED", { count: trulyStuckItems.length });
        }
      } else if (stuckItems.length > 0) {
        // There are PROCESSING items, but they're not stuck - just actively being processed
        logStep("Active processing detected - no stuck items", { 
          activeItems: stuckItems.length,
          note: "Items are being processed normally (< 10 minutes old with active sync)"
        });
      }
    }

    // 2. Check for processes stuck for more than 60 minutes
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: veryStuckItems, error: veryStuckError } = await supabaseClient
      .from('sync_queue')
      .select('id, created_at, attempts, sync_log_id')
      .eq('status', 'PROCESSING')
      .lt('created_at', sixtyMinutesAgo);

    if (veryStuckError) {
      logStep("Error checking very stuck items (>60min)", { error: veryStuckError });
    } else if (veryStuckItems && veryStuckItems.length > 0) {
      logStep("Found VERY STUCK items (>60 minutes)", { 
        count: veryStuckItems.length,
        oldest: veryStuckItems[0]?.created_at
      });
      
      issues.push(`${veryStuckItems.length} itens travados há mais de 60 minutos detectados`);

      // Marcar como FAILED (não tentar reprocessar)
      const { error: failVeryStuckError } = await supabaseClient
        .from('sync_queue')
        .update({ 
          status: 'FAILED',
          error_message: 'Timeout automático - processo travado há mais de 60 minutos',
          processed_at: new Date().toISOString()
        })
        .in('id', veryStuckItems.map(item => item.id));

      if (failVeryStuckError) {
        logStep("Error marking very stuck items as FAILED", { error: failVeryStuckError });
      } else {
        logStep("Marked very stuck items as FAILED", { count: veryStuckItems.length });
      }
    }

    // 3. Check for sync_logs stuck for more than 60 minutes
    const { data: stuckLogs, error: stuckLogsError } = await supabaseClient
      .from('sync_logs')
      .select('id, started_at, sync_type')
      .eq('status', 'IN_PROGRESS')
      .lt('started_at', sixtyMinutesAgo);

    if (stuckLogsError) {
      logStep("Error checking stuck sync_logs", { error: stuckLogsError });
    } else if (stuckLogs && stuckLogs.length > 0) {
      logStep("Found stuck sync_logs (>60 minutes)", { 
        count: stuckLogs.length,
        logs: stuckLogs.map(l => ({ id: l.id, started: l.started_at }))
      });
      
      issues.push(`${stuckLogs.length} sync_log travado há mais de 60 minutos`);

      for (const log of stuckLogs) {
        // Marcar log como FAILED
        await supabaseClient
          .from('sync_logs')
          .update({
            status: 'FAILED',
            completed_at: new Date().toISOString(),
            errors: [{
              error: 'Processo encerrado automaticamente - timeout de 60 minutos',
              timestamp: new Date().toISOString()
            }]
          })
          .eq('id', log.id);

        // Liberar lock
        await supabaseClient
          .from('app_config')
          .update({ value: 'false', updated_at: new Date().toISOString() })
          .eq('key', 'sync_lock');

        // Marcar itens da fila deste log como FAILED
        await supabaseClient
          .from('sync_queue')
          .update({
            status: 'FAILED',
            error_message: 'Sync encerrado por timeout de 60 minutos',
            processed_at: new Date().toISOString()
          })
          .eq('sync_log_id', log.id)
          .in('status', ['PENDING', 'PROCESSING']);

        logStep("Cleaned up stuck sync_log", { logId: log.id });
      }
    }

    // NEW: Auto-finalize orphaned sync_logs with no pending/processing items
    const { data: activeSyncLogs } = await supabaseClient
      .from('sync_logs')
      .select('id, started_at, total_rows')
      .in('status', ['IN_PROGRESS', 'QUEUED']);

    if (activeSyncLogs && activeSyncLogs.length > 0) {
      for (const syncLog of activeSyncLogs) {
        const { count: pendingProcessing } = await supabaseClient
          .from('sync_queue')
          .select('*', { count: 'exact', head: true })
          .eq('sync_log_id', syncLog.id)
          .in('status', ['PENDING', 'PROCESSING']);

        if (!pendingProcessing || pendingProcessing === 0) {
          logStep("Found orphaned sync_log with no pending items", { syncLogId: syncLog.id });

          // Get final stats
          const { data: queueItems } = await supabaseClient
            .from('sync_queue')
            .select('status, error_message')
            .eq('sync_log_id', syncLog.id);

          const completed = queueItems?.filter((i: any) => i.status === 'COMPLETED').length || 0;
          const failed = queueItems?.filter((i: any) => i.status === 'FAILED').length || 0;
          const finalStatus = failed === 0 ? 'SUCCESS' : (completed > 0 ? 'PARTIAL' : 'FAILED');

          // Aggregate top errors
          const failedItems = queueItems?.filter((i: any) => i.status === 'FAILED' && i.error_message) || [];
          const errorCounts: Record<string, number> = {};
          for (const item of failedItems) {
            const msg = (item.error_message || 'Unknown').substring(0, 100);
            errorCounts[msg] = (errorCounts[msg] || 0) + 1;
          }
          const topErrors = Object.entries(errorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([message, count]) => ({ message, count }));

          await supabaseClient
            .from('sync_logs')
            .update({
              status: finalStatus,
              completed_at: new Date().toISOString(),
              updated: completed,
              failed: failed,
              total_rows: syncLog.total_rows || (completed + failed),
              metadata: {
                finalized_by: 'monitor_auto_close',
                finalized_at: new Date().toISOString(),
                top_errors: topErrors,
                stats: { completed, failed, total: completed + failed }
              }
            })
            .eq('id', syncLog.id);

          // Release lock
          await supabaseClient
            .from('app_config')
            .update({ value: 'false', updated_at: new Date().toISOString() })
            .eq('key', 'sync_lock');

          logStep("✅ Auto-finalized orphaned sync_log", { syncLogId: syncLog.id, status: finalStatus });
          issues.push(`sync_log ${syncLog.id} finalizado automaticamente (${finalStatus})`);
        }
      }
    }

    const { count: pendingCount, error: pendingError } = await supabaseClient
      .from('sync_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    if (pendingError) {
      logStep("Error checking pending count", { error: pendingError });
    } else if (pendingCount && pendingCount > 100) {
      logStep("Large pending queue detected", { count: pendingCount });
      issues.push(`Fila grande: ${pendingCount} itens PENDING aguardando processamento`);
    }

    // 3. Check for recent failures (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: failedCount, error: failedError } = await supabaseClient
      .from('sync_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'FAILED')
      .gte('processed_at', fiveMinutesAgo);

    if (failedError) {
      logStep("Error checking failed items", { error: failedError });
    } else if (failedCount && failedCount > 10) {
      logStep("Multiple failures detected", { count: failedCount });
      issues.push(`${failedCount} falhas detectadas nos últimos 5 minutos`);
    }

    // 4. Send admin notification if issues found
    if (issues.length > 0) {
      logStep("Sending admin notification", { issueCount: issues.length });
      
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-admin-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
            'x-cron-secret': Deno.env.get('CRON_SECRET') || ''
          },
          body: JSON.stringify({
            subject: '⚠️ Alerta: Problemas na Fila de Sincronização',
            message: `
              <h2>Problemas Detectados na Fila de Sincronização</h2>
              <ul>
                ${issues.map(issue => `<li>${issue}</li>`).join('')}
              </ul>
              <p>O sistema tentou resolver automaticamente itens travados.</p>
              <p>Verifique o status da fila no painel de administração.</p>
            `,
            metadata: {
              issues,
              timestamp: new Date().toISOString(),
              stuckItemsCount: stuckItems?.length || 0,
              pendingCount: pendingCount || 0,
              failedCount: failedCount || 0
            }
          })
        });
        
        logStep("Admin notification sent successfully");
      } catch (notifError) {
        const errorMessage = notifError instanceof Error ? notifError.message : String(notifError);
        logStep("Error sending admin notification", { error: errorMessage });
      }
    } else {
      logStep("Queue health check passed - no issues detected");
    }

    // 5. Check for stuck sync_logs (IN_PROGRESS > 60 seconds) and release lock
    const { data: stuckSyncs, error: stuckSyncError } = await supabaseClient
      .from('sync_logs')
      .select('id, started_at, sync_type')
      .eq('status', 'IN_PROGRESS')
      .eq('sync_type', 'google_sheets')
      .lt('started_at', sixtySecondsAgo);

    if (stuckSyncError) {
      logStep("Error checking stuck syncs", { error: stuckSyncError });
    } else if (stuckSyncs && stuckSyncs.length > 0) {
      logStep("Found stuck sync_logs (>60s)", { count: stuckSyncs.length });
      
      // STEP 1: Set cancellation flag
      await supabaseClient
        .from('sync_logs')
        .update({ cancellation_requested: true })
        .in('id', stuckSyncs.map(s => s.id));
      
      logStep("Cancellation requested for stuck syncs");
      
      // STEP 2: Wait 2 seconds for process to detect flag
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // STEP 3: Force mark as FAILED
      await supabaseClient
        .from('sync_logs')
        .update({ 
          status: 'FAILED',
          completed_at: new Date().toISOString(),
          errors: [{
            error: 'Timeout: processo encerrado após 60 segundos sem progresso',
            timestamp: new Date().toISOString(),
            reason: 'No progress detected for 60 seconds'
          }],
          metadata: {
            started_at: stuckSyncs[0].started_at,
            failed_at: new Date().toISOString(),
            execution_time_ms: Date.now() - new Date(stuckSyncs[0].started_at).getTime(),
            final_status: 'TIMEOUT',
            terminated_by_monitor: true
          }
        })
        .in('id', stuckSyncs.map(s => s.id));
      
      logStep("Marked stuck syncs as FAILED");
      
      // STEP 4: Release sync lock IMMEDIATELY
      await supabaseClient
        .from('app_config')
        .update({ value: 'false' })
        .eq('key', 'sync_lock');
      
      logStep("Sync lock released after timeout cleanup");
      
      // STEP 5: Mark queue items as FAILED
      for (const sync of stuckSyncs) {
        await supabaseClient
          .from('sync_queue')
          .update({
            status: 'FAILED',
            error_message: 'Timeout: sincronização cancelada após 60 segundos',
            processed_at: new Date().toISOString()
          })
          .eq('sync_log_id', sync.id)
          .in('status', ['PENDING', 'PROCESSING']);
      }
      
      logStep("Marked queue items as FAILED");
      issues.push(`Sincronização travada detectada e encerrada (${stuckSyncs.length} sync_logs)`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        issuesFound: issues.length,
        issues,
        stuckItemsReset: stuckItems?.length || 0,
        stuckSyncsFixed: stuckSyncs?.length || 0,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Monitor error", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
