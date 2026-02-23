import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SheetRowCountResponse {
  totalRows: number;
  timestamp: string;
  sheetName: string;
  spreadsheetId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[CHECK-SHEET-ROWS] Function started');

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('[CHECK-SHEET-ROWS] User authenticated:', user.id);

    // Check if user is admin
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roles) {
      throw new Error('Admin access required');
    }

    console.log('[CHECK-SHEET-ROWS] Admin verified');

    // Get Google Sheets configuration
    const spreadsheetId = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID');
    const sheetName = Deno.env.get('GOOGLE_SHEETS_SHEET_NAME');
    const range = Deno.env.get('GOOGLE_SHEETS_RANGE');
    const apiKey = Deno.env.get('GOOGLE_SHEETS_API_KEY');

    if (!spreadsheetId || !sheetName || !range || !apiKey) {
      throw new Error('Missing Google Sheets configuration');
    }

    // Fetch data from Google Sheets API
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!${range}?key=${apiKey}`;
    
    console.log('[CHECK-SHEET-ROWS] Fetching data from Google Sheets...');

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CHECK-SHEET-ROWS] Google Sheets API error:', errorText);
      throw new Error(`Google Sheets API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rows = data.values || [];
    
    // Count rows (excluding header)
    const totalRows = rows.length > 0 ? rows.length - 1 : 0;

    console.log('[CHECK-SHEET-ROWS] Row count retrieved:', totalRows);

    const result: SheetRowCountResponse = {
      totalRows,
      timestamp: new Date().toISOString(),
      sheetName,
      spreadsheetId,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[CHECK-SHEET-ROWS] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isAuthError = errorMessage === 'Unauthorized' || errorMessage === 'Admin access required';
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: isAuthError ? 401 : 500,
      }
    );
  }
});
