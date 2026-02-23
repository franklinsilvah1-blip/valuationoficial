import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DIAGNOSE-SHEETS] ${step}${detailsStr}`);
};

interface DiagnosticResult {
  success: boolean;
  config: {
    spreadsheetId: string;
    sheetName: string;
    range: string;
  };
  headers: string[];
  recomendacaoTrimColumnIndex: number | null;
  sampleData: {
    rowIndex: number;
    codigo: string;
    recomendacaoTrim: string | null;
    allValues: Record<string, string>;
  }[];
  uniqueRecomendacaoTrimValues: string[];
  totalRows: number;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  logStep("Starting Google Sheets diagnostic");

  try {
    // Obter configurações do Google Sheets
    const spreadsheetId = Deno.env.get('GOOGLE_SHEETS_SPREADSHEET_ID');
    const apiKey = Deno.env.get('GOOGLE_SHEETS_API_KEY');
    const sheetName = Deno.env.get('GOOGLE_SHEETS_SHEET_NAME') || 'GERAL';
    const range = Deno.env.get('GOOGLE_SHEETS_RANGE') || 'A:Z';

    if (!spreadsheetId || !apiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing Google Sheets configuration",
          config: { spreadsheetId: !!spreadsheetId, apiKey: !!apiKey }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    logStep("Config loaded", { spreadsheetId: spreadsheetId.substring(0, 10) + '...', sheetName, range });

    // Fazer requisição para Google Sheets API
    const fullRange = `${sheetName}!${range}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(fullRange)}?key=${apiKey}`;
    
    logStep("Fetching from Google Sheets API");
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      logStep("Google Sheets API error", { status: response.status, error: errorText });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Google Sheets API error: ${response.status}`,
          details: errorText
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const data = await response.json();
    const rows = data.values || [];
    
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No data found in spreadsheet"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Processar cabeçalhos (primeira linha)
    const headers = rows[0] as string[];
    logStep("Headers found", { count: headers.length, headers });

    // Encontrar índices das colunas importantes
    const findColumnIndex = (possibleNames: string[]): number => {
      for (const name of possibleNames) {
        const index = headers.findIndex(h => 
          h && h.toString().toUpperCase().trim() === name.toUpperCase().trim()
        );
        if (index !== -1) return index;
      }
      return -1;
    };

    const codigoIndex = findColumnIndex(['CODIGO', 'CÓDIGO', 'CODIGO_B3', 'CÓDIGO_B3']);
    const recomendacaoTrimIndex = findColumnIndex(['RECOMENDAÇÃO TRIM', 'RECOMENDACAO TRIM', 'REC TRIM', 'RECOMENDAÇÃO_TRIM']);
    const recomendacaoIndex = findColumnIndex(['RECOMENDAÇÃO', 'RECOMENDACAO']);

    logStep("Column indices", { 
      codigoIndex, 
      recomendacaoTrimIndex, 
      recomendacaoIndex,
      codigoHeader: codigoIndex >= 0 ? headers[codigoIndex] : null,
      recomendacaoTrimHeader: recomendacaoTrimIndex >= 0 ? headers[recomendacaoTrimIndex] : null
    });

    // Coletar dados de amostra (primeiros 20 registros)
    const sampleData: DiagnosticResult['sampleData'] = [];
    const uniqueRecomendacaoTrimValues = new Set<string>();

    for (let i = 1; i < Math.min(rows.length, 21); i++) {
      const row = rows[i] as string[];
      const codigo = codigoIndex >= 0 ? (row[codigoIndex] || '') : '';
      const recomendacaoTrim = recomendacaoTrimIndex >= 0 ? (row[recomendacaoTrimIndex] || '') : null;
      
      // Criar objeto com todos os valores
      const allValues: Record<string, string> = {};
      headers.forEach((header, idx) => {
        if (header && row[idx]) {
          allValues[header] = row[idx];
        }
      });

      sampleData.push({
        rowIndex: i + 1,
        codigo: codigo.toString().trim(),
        recomendacaoTrim: recomendacaoTrim?.toString().trim() || null,
        allValues
      });

      if (recomendacaoTrim) {
        uniqueRecomendacaoTrimValues.add(recomendacaoTrim.toString().trim());
      }
    }

    // Coletar TODOS os valores únicos de RECOMENDAÇÃO TRIM
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as string[];
      if (recomendacaoTrimIndex >= 0 && row[recomendacaoTrimIndex]) {
        uniqueRecomendacaoTrimValues.add(row[recomendacaoTrimIndex].toString().trim());
      }
    }

    const result: DiagnosticResult = {
      success: true,
      config: {
        spreadsheetId: spreadsheetId.substring(0, 20) + '...',
        sheetName,
        range
      },
      headers,
      recomendacaoTrimColumnIndex: recomendacaoTrimIndex >= 0 ? recomendacaoTrimIndex : null,
      sampleData,
      uniqueRecomendacaoTrimValues: Array.from(uniqueRecomendacaoTrimValues).sort(),
      totalRows: rows.length - 1 // Excluindo cabeçalho
    };

    logStep("Diagnostic complete", { 
      totalRows: result.totalRows,
      uniqueValues: result.uniqueRecomendacaoTrimValues
    });

    return new Response(
      JSON.stringify(result, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    logStep("ERROR", { message: error.message, stack: error.stack });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
