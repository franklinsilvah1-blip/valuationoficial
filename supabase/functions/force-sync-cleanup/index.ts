import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupResult {
  success: boolean;
  orphanedSyncsFixed: number;
  queueItemsCleared: number;
  lockReleased: boolean;
  message: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated and is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (rolesError || !roles) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[FORCE-CLEANUP] Starting emergency cleanup', { userId: user.id });

    // Create service role client for cleanup operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const result: CleanupResult = {
      success: false,
      orphanedSyncsFixed: 0,
      queueItemsCleared: 0,
      lockReleased: false,
      message: ''
    };

    // 1. Find and mark orphaned IN_PROGRESS sync_logs as FAILED
    console.log('[FORCE-CLEANUP] Checking for orphaned sync_logs');
    const { data: orphanedSyncs, error: orphanedError } = await supabaseAdmin
      .from('sync_logs')
      .select('id')
      .in('status', ['IN_PROGRESS', 'QUEUED']);

    if (!orphanedError && orphanedSyncs && orphanedSyncs.length > 0) {
      console.log('[FORCE-CLEANUP] Found orphaned syncs', { count: orphanedSyncs.length });
      
      const { error: updateError } = await supabaseAdmin
        .from('sync_logs')
        .update({
          status: 'FAILED',
          completed_at: new Date().toISOString(),
          errors: [{
            error: 'Process abandoned - recovered by force cleanup',
            timestamp: new Date().toISOString()
          }]
        })
        .in('status', ['IN_PROGRESS', 'QUEUED']);

      if (updateError) {
        console.error('[FORCE-CLEANUP] Error updating orphaned syncs', updateError);
      } else {
        result.orphanedSyncsFixed = orphanedSyncs.length;
        console.log('[FORCE-CLEANUP] ✅ Marked orphaned syncs as FAILED', { count: orphanedSyncs.length });
      }
    }

    // 2. Clear sync_queue items related to orphaned syncs
    if (orphanedSyncs && orphanedSyncs.length > 0) {
      const orphanedIds = orphanedSyncs.map(s => s.id);
      console.log('[FORCE-CLEANUP] Clearing queue items for orphaned syncs', { syncIds: orphanedIds });
      
      const { data: queueItems, error: queueCountError } = await supabaseAdmin
        .from('sync_queue')
        .select('id')
        .in('sync_log_id', orphanedIds);

      if (!queueCountError && queueItems) {
        const { error: deleteError } = await supabaseAdmin
          .from('sync_queue')
          .delete()
          .in('sync_log_id', orphanedIds);

        if (deleteError) {
          console.error('[FORCE-CLEANUP] Error clearing queue', deleteError);
        } else {
          result.queueItemsCleared = queueItems.length;
          console.log('[FORCE-CLEANUP] ✅ Cleared queue items', { count: queueItems.length });
        }
      }
    }

    // 3. Release sync_lock
    console.log('[FORCE-CLEANUP] Releasing sync_lock');
    const { error: lockError } = await supabaseAdmin
      .from('app_config')
      .update({
        value: 'false',
        updated_at: new Date().toISOString()
      })
      .eq('key', 'sync_lock');

    if (lockError) {
      console.error('[FORCE-CLEANUP] Error releasing lock', lockError);
      result.message = 'Lock release failed';
    } else {
      result.lockReleased = true;
      console.log('[FORCE-CLEANUP] ✅ Lock released');
    }

    // Build result message
    result.success = result.lockReleased;
    
    if (result.orphanedSyncsFixed > 0 || result.queueItemsCleared > 0) {
      result.message = `Sistema destravado: ${result.orphanedSyncsFixed} sync(s) órfã(s) finalizada(s), ${result.queueItemsCleared} item(ns) da fila limpo(s), lock liberado.`;
    } else {
      result.message = 'Sistema já estava liberado. Lock garantido como liberado.';
    }

    console.log('[FORCE-CLEANUP] Cleanup completed', result);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[FORCE-CLEANUP] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Erro ao executar limpeza de emergência'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
