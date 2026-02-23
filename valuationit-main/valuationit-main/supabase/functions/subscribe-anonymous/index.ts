import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { endpoint, p256dh, auth, deviceId } = await req.json();

    if (!endpoint || !p256dh || !auth) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: endpoint, p256dh, auth' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate device_id if not provided
    const finalDeviceId = deviceId || crypto.randomUUID();

    console.log(`Processing anonymous subscription for device: ${finalDeviceId}`);

    // Check if this device already has a subscription
    const { data: existingSubscription } = await supabase
      .from('push_subscriptions')
      .select('id, is_active')
      .eq('device_id', finalDeviceId)
      .single();

    if (existingSubscription) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({
          endpoint,
          p256dh,
          auth,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubscription.id);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        throw updateError;
      }

      console.log(`Updated existing subscription for device: ${finalDeviceId}`);
      
      return new Response(
        JSON.stringify({ success: true, deviceId: finalDeviceId, updated: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if endpoint already exists (same browser, different device_id)
    const { data: endpointExists } = await supabase
      .from('push_subscriptions')
      .select('id, device_id')
      .eq('endpoint', endpoint)
      .single();

    if (endpointExists) {
      // Update device_id if different
      if (endpointExists.device_id !== finalDeviceId) {
        await supabase
          .from('push_subscriptions')
          .update({ 
            device_id: finalDeviceId, 
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', endpointExists.id);
      }

      return new Response(
        JSON.stringify({ success: true, deviceId: finalDeviceId, updated: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new anonymous subscription
    const { error: insertError } = await supabase
      .from('push_subscriptions')
      .insert({
        endpoint,
        p256dh,
        auth,
        device_id: finalDeviceId,
        user_id: null,
        is_active: true
      });

    if (insertError) {
      console.error('Error creating subscription:', insertError);
      throw insertError;
    }

    console.log(`Created new anonymous subscription for device: ${finalDeviceId}`);

    return new Response(
      JSON.stringify({ success: true, deviceId: finalDeviceId, created: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error in subscribe-anonymous:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});