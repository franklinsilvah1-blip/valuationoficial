import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { mapErrorToUserMessage } from "../_shared/errors.ts";

// Validation schemas with comprehensive input validation - RELAXED for real data
const assetCodeSchema = z.string()
  .trim()
  .min(1, "Asset code is required")
  .max(20, "Asset code must be less than 20 characters")
  .transform(val => val.toUpperCase());

const textFieldSchema = z.string()
  .trim()
  .max(255, "Text field must be less than 255 characters");

const longTextSchema = z.string()
  .trim()
  .max(5000, "Text field must be less than 5000 characters");

// Database numeric columns use numeric(12,2) - allows up to 10 integer digits + 2 decimals
// Max safe value: 9,999,999,999.99 (10 billion - 0.01)
// Min safe value: -9,999,999,999.99
const NUMERIC_MAX_VALUE = 9999999999.99;
const NUMERIC_MIN_VALUE = -9999999999.99;

const numericFieldSchema = z.string()
  .trim()
  .transform((val) => {
    if (!val || val === "-" || val === "") return null;
    // Handle Brazilian number format: 1.234.567,89 -> 1234567.89
    const cleaned = val.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return null;
    
    // Cap values to prevent database overflow, log when capping occurs
    if (parsed > NUMERIC_MAX_VALUE) {
      console.warn(`[VALIDATION] Numeric value capped: ${parsed} → ${NUMERIC_MAX_VALUE}`);
      return NUMERIC_MAX_VALUE;
    }
    if (parsed < NUMERIC_MIN_VALUE) {
      console.warn(`[VALIDATION] Numeric value capped: ${parsed} → ${NUMERIC_MIN_VALUE}`);
      return NUMERIC_MIN_VALUE;
    }
    
    return parsed;
  })
  .nullable();

const integerFieldSchema = z.string()
  .trim()
  .transform((val) => {
    if (!val || val === "-" || val === "") return null;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? null : parsed;
  })
  .nullable();

const assetRowSchema = z.object({
  codigo_b3: assetCodeSchema,
  nome: textFieldSchema.min(1, "Nome is required"),
  tipo: z.string().trim().min(1, "Tipo is required").max(20),
  setor: textFieldSchema.optional(),
  valor: numericFieldSchema.optional(),
  perfil_investidor: textFieldSchema.optional(),
  recomendacao: textFieldSchema.optional(),
  tendencia: textFieldSchema.optional(),
  tax_week: numericFieldSchema.optional(),
  roi_trim: numericFieldSchema.optional(),
  roi_2026: numericFieldSchema.optional(),
  roi_2025: numericFieldSchema.optional(),
  roi_2024: numericFieldSchema.optional(),
  dy_2025: numericFieldSchema.optional(),
  mult_capital: numericFieldSchema.optional(),
  roi_2023a2025: numericFieldSchema.optional(),
  carteira: z.string().trim().min(1, "Carteira Club is required").max(50),
  nota_especialista: textFieldSchema.optional(),
  resumo: longTextSchema.optional(),
});

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-SHEETS] ${step}${detailsStr}`);
};

type PlanType = "START" | "PRO" | "SPECIALIST" | "FALE_C_ESPECIALISTA";
type AssetType = "FII" | "ACAO" | "BDR" | "CRIPTO" | "ETF" | "INDICE" | "RFIXA";

const normalizePlanType = (value: string | null | undefined): PlanType => {
  if (!value) return "START";
  const normalized = value.toUpperCase().trim();
  
  // NOVO: Reconhecer "Não Recomendado" → FALE_C_ESPECIALISTA
  if (normalized.includes("NÃO RECOMENDADO") || normalized.includes("NAO RECOMENDADO") || normalized === "NÃO RECOMENDADO") {
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

const normalizeRecommendation = (value: string | null | undefined): string | null => {
  if (!value) return null;
  
  const normalized = value.trim().toUpperCase();
  
  // Mapeamento de valores da planilha para enums do banco
  // O banco aceita: COMPRA (DY), COMPRA (RA), COMPRA (RB), COMPRA (RM), Ñ COMPRA (ATF), NEUTRA (AF), NEUTRA (TF)
  const recommendationMap: Record<string, string> = {
    // Novos valores simplificados da planilha → manter como estão (serão filtrados como texto)
    'COMPRA': 'COMPRA',
    'VENDA': 'VENDA',
    'NEUTRA': 'NEUTRA',
    'GANHOS': 'GANHOS',
    'MANTÉM': 'MANTÉM',
    'MANTEM': 'MANTÉM',
    // Valores antigos continuam funcionando
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
  
  // Se não encontrou, retornar o valor original para não perder dados
  console.log(`[SYNC-SHEETS] Unknown recommendation value: "${value}" - keeping as-is`);
  return value.trim();
};

const normalizeTrend = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  
  // Normalizar para valores simplificados
  if (normalized.includes("ALTA")) return "ALTA";
  if (normalized.includes("NEUTRA")) return "NEUTRA";
  if (normalized.includes("BAIXA")) return "BAIXA";
  
  return value.trim();
};

async function fetchGoogleSheetData(retries = 3) {
  const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  const spreadsheetId = Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID");
  const sheetName = Deno.env.get("GOOGLE_SHEETS_SHEET_NAME");
  const range = Deno.env.get("GOOGLE_SHEETS_RANGE");
  
  if (!apiKey || !spreadsheetId || !sheetName || !range) {
    throw new Error("Missing Google Sheets configuration");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!${range}`;
  
  logStep("Fetching data from Google Sheets API", { url, retries });
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': apiKey,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Sheets API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.values || !Array.isArray(data.values)) {
        throw new Error("Invalid response format from Google Sheets");
      }
      
      logStep("Data fetched successfully", { totalRows: data.values.length, attempt });
      return data.values as string[][];
    } catch (error: any) {
      logStep(`Attempt ${attempt} failed`, { error: error.message });
      
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new Error("Failed to fetch data after all retries");
}

async function populateQueueFromSheet(
  rows: string[][],
  supabaseClient: any,
  logEntryId: string
) {
  if (!rows || rows.length === 0) {
    throw new Error("No data found in spreadsheet");
  }

  const headers = rows[0];
  logStep("Headers found", { headers });

  const columnMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    const normalized = header.trim().toUpperCase();
    columnMap[normalized] = index;
  });

  logStep("Column mapping", { columnMap });

  // Detect new vs old sheet format for ROI/DY column names
  const isNewSheetFormat = columnMap["ROI 2026"] !== undefined;
  logStep("Sheet format detection", { isNewSheetFormat });

  const requiredColumns = ["CD B3", "NOME", "TIPO", "CARTEIRA TRIM"];
  const missingColumns = requiredColumns.filter(col => columnMap[col] === undefined);
  
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
  }

  const dataRows = rows.slice(1); // Skip header
  
  // Filter out completely empty rows
  const nonEmptyRows = dataRows.filter(row => 
    row && row.some(cell => cell && cell.trim() !== '')
  );
  
  logStep("Rows analysis", { 
    totalRowsFromSheet: rows.length - 1, // -1 for header
    nonEmptyRows: nonEmptyRows.length,
    emptyRowsSkipped: dataRows.length - nonEmptyRows.length
  });

  // ✅ NOVO: Coletar códigos B3 da planilha para detecção de ativos removidos
  const sheetCodigosB3 = new Set<string>();
  nonEmptyRows.forEach(row => {
    const codigo = row[columnMap["CD B3"]]?.toString().toUpperCase().trim();
    if (codigo) {
      sheetCodigosB3.add(codigo);
    }
  });
  
  logStep("Collected B3 codes from sheet", { 
    totalCodes: sheetCodigosB3.size,
    sample: Array.from(sheetCodigosB3).slice(0, 5) 
  });

  const warnings: any[] = [];

  // ✅ DETECÇÃO DE DUPLICATAS: Mapear códigos B3 para linhas
  const codigoLineMap = new Map<string, number[]>();
  nonEmptyRows.forEach((row, index) => {
    const codigo = row[columnMap["CD B3"]]?.toString().toUpperCase().trim();
    if (codigo) {
      const lineNumber = index + 2; // +2 para header e índice 0
      if (!codigoLineMap.has(codigo)) {
        codigoLineMap.set(codigo, []);
      }
      codigoLineMap.get(codigo)!.push(lineNumber);
    }
  });

  // Encontrar duplicatas (códigos que aparecem mais de uma vez)
  const duplicates = Array.from(codigoLineMap.entries())
    .filter(([_, lines]) => lines.length > 1)
    .map(([codigo, lines]) => ({ codigo, linhas: lines, count: lines.length }));

  if (duplicates.length > 0) {
    logStep("⚠️ DUPLICATAS DETECTADAS", { 
      total: duplicates.length, 
      duplicates: duplicates.map(d => `${d.codigo} (linhas: ${d.linhas.join(", ")})`)
    });
    
    duplicates.forEach(d => {
      warnings.push({
        type: "DUPLICATE_CODE",
        codigo: d.codigo,
        linhas: d.linhas,
        message: `Código ${d.codigo} duplicado ${d.count}x nas linhas: ${d.linhas.join(", ")}. Apenas a última ocorrência será mantida.`
      });
    });
  }

  const queueItems: any[] = [];
  let skipped = 0;

  logStep("Validating and preparing queue items", { totalRows: nonEmptyRows.length, duplicatesFound: duplicates.length });

  for (let i = 0; i < nonEmptyRows.length; i++) {
    const row = nonEmptyRows[i];
    
    try {
      const rawData = {
        codigo_b3: row[columnMap["CD B3"]] || "",
        nome: row[columnMap["NOME"]] || "",
        tipo: row[columnMap["TIPO"]] || "",
        setor: row[columnMap["SETOR"]] || "",
        carteira: row[columnMap["CARTEIRA TRIM"]] || "",
        recomendacao: row[columnMap["RECOMENDAÇÃO TRIM"]] || "",
        tendencia: row[columnMap["TENDÊNCIA TRIM"]] || "",
        nota_especialista: row[columnMap["NOTA ESPECIALISTA"]] || "",
        perfil_investidor: row[columnMap["PERFIL DO ATIVO"]] || "",
        resumo: row[columnMap["RESUMO"]] || "",
        tax_week: row[columnMap["ROI TRIM (R)"]] || row[columnMap["TAX WEEK"]] || "",
        roi_2024: row[columnMap["ROI 2024"]] || "",
        roi_trim: row[columnMap["ROI TRIM (T)"]] || row[columnMap["ROI TRIM"]] || "",
        roi_2023a2025: row[columnMap["ROI 2023A2025"]] || row[columnMap["ROI 2023A25"]] || "",
        dy_2025: row[isNewSheetFormat ? columnMap["DY 2025"] : columnMap["DY 2024"]] || "",
        valor: row[columnMap["VALOR"]] || "",
        mult_capital: row[columnMap["MULT CAPITAL"]] || "",
        roi_2026: row[isNewSheetFormat ? columnMap["ROI 2026"] : columnMap["ROI 2025"]] || "",
        roi_2025: row[isNewSheetFormat ? columnMap["ROI 2025"] : columnMap["DY 2025"]] || "",
      };

      const validationResult = assetRowSchema.safeParse(rawData);
      
      if (!validationResult.success) {
        skipped++;
        const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(", ");
        console.error(`[SYNC-SHEETS] Validation error for row ${i + 2}:`, {
          codigo: rawData.codigo_b3,
          errors: errorMessages,
          problematicFields: validationResult.error.issues
        });
        warnings.push({ 
          row: i + 2, // +2 for header and 0-index
          reason: "Validation failed", 
          errors: errorMessages,
          data: { codigo_b3: rawData.codigo_b3 }
        });
        continue;
      }

      // Convert validated data to processable format
      const processedData = {
        codigo_b3: validationResult.data.codigo_b3,
        nome: validationResult.data.nome,
        tipo: validationResult.data.tipo,
        setor: validationResult.data.setor || null,
        valor: validationResult.data.valor,
        perfil_investidor: validationResult.data.perfil_investidor || null,
        recomendacao: validationResult.data.recomendacao || null,
        tendencia: validationResult.data.tendencia || null,
        tax_week: validationResult.data.tax_week,
        roi_trim: validationResult.data.roi_trim,
        roi_2026: validationResult.data.roi_2026,
        roi_2025: validationResult.data.roi_2025,
        roi_2024: validationResult.data.roi_2024,
        dy_2025: validationResult.data.dy_2025,
        mult_capital: validationResult.data.mult_capital,
        roi_2023a2025: validationResult.data.roi_2023a2025,
        carteira: validationResult.data.carteira,
        nota_especialista: validationResult.data.nota_especialista,
        resumo: validationResult.data.resumo,
      };

      queueItems.push({
        sync_log_id: logEntryId,
        row_index: i,
        row_data: processedData,
        status: 'PENDING'
      });

    } catch (error: any) {
      skipped++;
      warnings.push({ row: i + 2, error: error.message });
    }
  }

  logStep("Inserting queue items", { validItems: queueItems.length, skipped });

  // Insert all queue items in batches
  const batchSize = 100;
  for (let i = 0; i < queueItems.length; i += batchSize) {
    const batch = queueItems.slice(i, i + batchSize);
    const { error: insertError } = await supabaseClient
      .from("sync_queue")
      .insert(batch);
    
    if (insertError) {
      logStep("Error inserting queue batch", { error: insertError.message });
      throw insertError;
    }
  }

  return { 
    totalQueued: queueItems.length, 
    skipped, 
    warnings,
    totalRows: nonEmptyRows.length,
    duplicatesFound: duplicates.length,
    duplicateCodes: duplicates,
    sheetCodigosB3: Array.from(sheetCodigosB3) // ✅ Retornar lista de códigos
  };
}

async function processSheetDataInBatches(
  rows: string[][],
  supabaseClient: any,
  userId: string,
  batchSize = 100,
  timeoutMs = 55000 // 55 seconds to leave buffer
) {
  if (!rows || rows.length === 0) {
    throw new Error("No data found in spreadsheet");
  }

  const startTime = Date.now();
  const headers = rows[0];
  logStep("Headers found", { headers });

  const columnMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    const normalized = header.trim().toUpperCase();
    columnMap[normalized] = index;
  });

  logStep("Column mapping", { columnMap });

  // Detect new vs old sheet format for ROI/DY column names
  const isNewSheetFormat = columnMap["ROI 2026"] !== undefined;
  logStep("Sheet format detection (direct mode)", { isNewSheetFormat });

  const requiredColumns = ["CD B3", "NOME", "TIPO", "CARTEIRA TRIM"];
  const missingColumns = requiredColumns.filter(col => columnMap[col] === undefined);
  
  if (missingColumns.length > 0) {
    throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
  }

  // Log missing critical columns
  const criticalColumns = ["ROI 2025", "ROI 2023A25", "TENDÊNCIA TRIM", "MULT CAPITAL"];
  const missingCritical = criticalColumns.filter(col => columnMap[col] === undefined);
  if (missingCritical.length > 0) {
    logStep("⚠️ CRITICAL: Missing columns", { missingCritical });
  }

  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const errors: any[] = [];
  const warnings: any[] = [];

  // Process in batches to avoid timeout
  const dataRows = rows.slice(1); // Skip header
  
  // Filter out completely empty rows
  const nonEmptyRows = dataRows.filter(row => 
    row && row.some(cell => cell && cell.trim() !== '')
  );
  
  logStep("Rows analysis (direct mode)", { 
    totalRowsFromSheet: rows.length - 1,
    nonEmptyRows: nonEmptyRows.length,
    emptyRowsSkipped: dataRows.length - nonEmptyRows.length
  });

  // ✅ NOVO: Coletar códigos B3 da planilha para detecção de ativos removidos
  const sheetCodigosB3 = new Set<string>();
  nonEmptyRows.forEach(row => {
    const codigo = row[columnMap["CD B3"]]?.toString().toUpperCase().trim();
    if (codigo) {
      sheetCodigosB3.add(codigo);
    }
  });
  
  logStep("Collected B3 codes from sheet (direct mode)", { 
    totalCodes: sheetCodigosB3.size,
    sample: Array.from(sheetCodigosB3).slice(0, 5) 
  });

  // ✅ DETECÇÃO DE DUPLICATAS: Mapear códigos B3 para linhas
  const codigoLineMap = new Map<string, number[]>();
  nonEmptyRows.forEach((row, index) => {
    const codigo = row[columnMap["CD B3"]]?.toString().toUpperCase().trim();
    if (codigo) {
      const lineNumber = index + 2; // +2 para header e índice 0
      if (!codigoLineMap.has(codigo)) {
        codigoLineMap.set(codigo, []);
      }
      codigoLineMap.get(codigo)!.push(lineNumber);
    }
  });

  // Encontrar duplicatas (códigos que aparecem mais de uma vez)
  const duplicateCodes = Array.from(codigoLineMap.entries())
    .filter(([_, lines]) => lines.length > 1)
    .map(([codigo, lines]) => ({ codigo, linhas: lines, count: lines.length }));

  if (duplicateCodes.length > 0) {
    logStep("⚠️ DUPLICATAS DETECTADAS (direct mode)", { 
      total: duplicateCodes.length, 
      duplicates: duplicateCodes.map(d => `${d.codigo} (linhas: ${d.linhas.join(", ")})`)
    });
    
    duplicateCodes.forEach(d => {
      warnings.push({
        type: "DUPLICATE_CODE",
        codigo: d.codigo,
        linhas: d.linhas,
        message: `Código ${d.codigo} duplicado ${d.count}x nas linhas: ${d.linhas.join(", ")}. Apenas a última ocorrência será mantida.`
      });
    });
  }

  const totalBatches = Math.ceil(nonEmptyRows.length / batchSize);
  
  logStep("Starting batch processing", { 
    totalRows: nonEmptyRows.length, 
    batchSize, 
    totalBatches,
    duplicatesFound: duplicateCodes.length 
  });

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      logStep("Approaching timeout, stopping processing", {
        processedBatches: batchIndex,
        totalBatches,
        elapsedMs: Date.now() - startTime
      });
      warnings.push({
        type: "TIMEOUT_WARNING",
        message: `Processing stopped after ${batchIndex} batches due to timeout limit`,
        processedRows: batchIndex * batchSize
      });
      break;
    }

    const batchStart = batchIndex * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, nonEmptyRows.length);
    const batch = nonEmptyRows.slice(batchStart, batchEnd);

    logStep(`Processing batch ${batchIndex + 1}/${totalBatches}`, {
      rows: `${batchStart + 1}-${batchEnd}`,
      elapsedMs: Date.now() - startTime
    });

    for (let i = 0; i < batch.length; i++) {
      const rowIndex = batchStart + i + 1; // +1 for header
      const row = batch[i];
      
      try {
        const rawData = {
          codigo_b3: row[columnMap["CD B3"]] || "",
          nome: row[columnMap["NOME"]] || "",
          tipo: row[columnMap["TIPO"]] || "",
          setor: row[columnMap["SETOR"]] || "",
          carteira: row[columnMap["CARTEIRA TRIM"]] || "",
          recomendacao: row[columnMap["RECOMENDAÇÃO TRIM"]] || "",
          tendencia: row[columnMap["TENDÊNCIA TRIM"]] || "",
          nota_especialista: row[columnMap["NOTA ESPECIALISTA"]] || "",
          perfil_investidor: row[columnMap["PERFIL DO ATIVO"]] || "",
          resumo: row[columnMap["RESUMO"]] || "",
          tax_week: row[columnMap["ROI TRIM (R)"]] || row[columnMap["TAX WEEK"]] || "",
          roi_2024: row[columnMap["ROI 2024"]] || "",
          roi_trim: row[columnMap["ROI TRIM (T)"]] || row[columnMap["ROI TRIM"]] || "",
          roi_2023a2025: row[columnMap["ROI 2023A2025"]] || row[columnMap["ROI 2023A25"]] || "",
          dy_2025: row[isNewSheetFormat ? columnMap["DY 2025"] : columnMap["DY 2024"]] || "",
          valor: row[columnMap["VALOR"]] || "",
          mult_capital: row[columnMap["MULT CAPITAL"]] || "",
          roi_2026: row[isNewSheetFormat ? columnMap["ROI 2026"] : columnMap["ROI 2025"]] || "",
          roi_2025: row[isNewSheetFormat ? columnMap["ROI 2025"] : columnMap["DY 2025"]] || "",
        };

        const validationResult = assetRowSchema.safeParse(rawData);
        
        if (!validationResult.success) {
          skipped++;
          const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(", ");
          warnings.push({ 
            row: rowIndex + 1, 
            reason: "Validation failed", 
            errors: errorMessages,
            data: { codigo_b3: rawData.codigo_b3 }
          });
          continue;
        }

        const validatedData = validationResult.data;
        const tipo = normalizeAssetType(validatedData.tipo);
        const carteira = normalizePlanType(validatedData.carteira);
        const recomendacao = normalizeRecommendation(validatedData.recomendacao);
        const tendencia = normalizeTrend(validatedData.tendencia);

        // Upsert asset and mark as active (exists in current spreadsheet)
        const { data: asset, error: assetError } = await supabaseClient
          .from("assets")
          .upsert(
            {
              codigo_b3: validatedData.codigo_b3,
              nome: validatedData.nome,
              tipo,
              setor: validatedData.setor || null,
              is_active: true, // Mark as active since it's in the spreadsheet
              updated_at: new Date().toISOString(),
            },
            { onConflict: "codigo_b3" }
          )
          .select()
          .single();

        if (assetError) {
          failed++;
          errors.push({ row: rowIndex + 1, error: assetError.message, codigo: validatedData.codigo_b3 });
          continue;
        }

        // Prepare analysis data
        const analysisData: any = {
          asset_id: asset.id,
          carteira,
          perfil_investidor: validatedData.perfil_investidor || null,
          recomendacao,
          tendencia,
          taxa_semanal: validatedData.tax_week,
          roitrim: validatedData.roi_trim,
          roi2026: validatedData.roi_2026,
          roi2025: validatedData.roi_2025,
          roi2024: validatedData.roi_2024,
          dy2025: validatedData.dy_2025,
          fator_mc: validatedData.mult_capital,
          roi2023a2025: validatedData.roi_2023a2025,
          nota_especialista: validatedData.nota_especialista,
          valor: validatedData.valor,
          resumo: validatedData.resumo,
          updated_at: new Date().toISOString(),
        };

        // Upsert analysis (single query instead of SELECT + UPDATE/INSERT)
        const { error: analysisError } = await supabaseClient
          .from("asset_analyses")
          .upsert(analysisData, {
            onConflict: "asset_id,carteira",
            ignoreDuplicates: false
          });

        if (analysisError) {
          failed++;
          errors.push({ row: rowIndex + 1, error: analysisError.message, codigo: validatedData.codigo_b3 });
        } else {
          updated++; // Count all successful upserts as updates
        }

      } catch (error: any) {
        failed++;
        errors.push({ row: rowIndex + 1, error: error.message });
      }
    }

    logStep(`Batch ${batchIndex + 1} completed`, { inserted, updated, failed, skipped });
  }

  return { 
    inserted, 
    updated, 
    failed, 
    skipped, 
    errors, 
    warnings,
    duplicatesFound: duplicateCodes.length,
    duplicateCodes,
    sheetCodigosB3: Array.from(sheetCodigosB3) // ✅ Retornar lista de códigos
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Create client with ANON_KEY for auth verification
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  // Create client with SERVICE_ROLE_KEY for database operations
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  let logEntryId: string | null = null;

  try {
    logStep("Function started");

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('AUTH_REQUIRED');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    
    if (authError || !user) {
      logStep("Auth error", { error: authError?.message });
      throw new Error('AUTH_INVALID');
    }

    logStep("User authenticated", { userId: user.id });

    const { data: isAdmin } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      throw new Error('ADMIN_ACCESS_REQUIRED');
    }

    await checkRateLimit(user.id, 'sync-google-sheets', 3, 60);

    logStep("Admin verified, starting sync");

    // Check sync lock to prevent concurrent syncs
    const { data: lockData, error: lockError } = await supabaseClient
      .from('app_config')
      .select('value')
      .eq('key', 'sync_lock')
      .single();

    if (lockError && lockError.code !== 'PGRST116') {
      throw new Error(`LOCK_CHECK_FAILED: ${lockError.message}`);
    }

    if (lockData && lockData.value === 'true') {
      logStep("Sync already in progress");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'SYNC_IN_PROGRESS',
          message: 'Uma sincronização já está em andamento. Aguarde a conclusão.' 
        }),
        { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check for existing active sync (double-check)
    const { data: activeSyncCheck } = await supabaseClient
      .from("sync_logs")
      .select("id, started_at")
      .eq("sync_type", "google_sheets")
      .eq("status", "IN_PROGRESS")
      .maybeSingle();

    if (activeSyncCheck) {
      const minutesRunning = (Date.now() - new Date(activeSyncCheck.started_at).getTime()) / 1000 / 60;
      
      return new Response(
        JSON.stringify({
          error: "Sync already in progress",
          message: `Uma sincronização já está em andamento há ${minutesRunning.toFixed(1)} minutos. Aguarde a conclusão ou o timeout.`,
          activeSyncId: activeSyncCheck.id
        }),
        { 
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check for items in queue
    const { data: queueCheck } = await supabaseClient
      .from("sync_queue")
      .select("id")
      .in("status", ["PENDING", "PROCESSING"])
      .limit(1);

    if (queueCheck && queueCheck.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Queue is active",
          message: "Já existe uma fila de processamento ativa. Aguarde a conclusão antes de iniciar nova sincronização."
        }),
        { 
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Acquire lock - try to update first, if no rows affected then insert
    const { error: lockUpdateError } = await supabaseClient
      .from('app_config')
      .update({ value: 'true' })
      .eq('key', 'sync_lock');

    if (lockUpdateError) {
      throw new Error(`LOCK_ACQUIRE_FAILED: ${lockUpdateError.message}`);
    }

    logStep("Sync lock acquired");

    // Clean up stuck logs before creating new one
    await supabaseClient
      .from('sync_logs')
      .update({ 
        status: 'FAILED',
        completed_at: new Date().toISOString(),
        metadata: { error: 'Stuck in IN_PROGRESS, cleaned up by new sync' }
      })
      .eq('sync_type', 'google_sheets')
      .eq('status', 'IN_PROGRESS')
      .lt('started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Older than 5 minutes

    const triggerType = req.headers.get('X-Trigger-Type') === 'cron' ? 'automatic' : 'manual';
    
    const { data: logEntry } = await supabaseClient
      .from('sync_logs')
      .insert({
        sync_type: 'google_sheets',
        status: 'IN_PROGRESS',
        triggered_by: user.id,
        trigger_type: triggerType,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    logEntryId = logEntry.id;
    logStep("Log entry created", { logId: logEntryId });

    if (!logEntryId) {
      throw new Error("Failed to create log entry");
    }

    const startTime = Date.now();

    logStep("Fetching data from Google Sheets...");
    const rows = await fetchGoogleSheetData(3);
    logStep("Data fetched", { totalRows: rows.length });

    // Check if we should use queue mode (default for large datasets)
    const useQueue = rows.length > 100; // Use queue for datasets larger than 100 rows
    
    logStep("Sync mode selected", { useQueue, totalRows: rows.length });

    if (useQueue) {
      // Queue mode: Populate queue and trigger first batch processing
      logStep("Using queue mode for background processing");
      
      // ✅ CRÍTICO: Limpar fila antiga antes de popular com novos dados
      logStep("Clearing old queue items before populating new ones");
      const { error: deleteError } = await supabaseClient
        .from('sync_queue')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all items
      
      if (deleteError) {
        logStep("Warning: Failed to clear old queue items", { error: deleteError.message });
      } else {
        logStep("Old queue items cleared successfully");
      }
      
      // Also delete any old PENDING items from previous syncs
      const { error: deleteOldPendingError } = await supabaseClient
        .from('sync_queue')
        .delete()
        .eq('status', 'PENDING')
        .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Older than 1 hour
      
      if (deleteOldPendingError) {
        logStep("Warning: Failed to clear old pending items", { error: deleteOldPendingError.message });
      }
      
      const queueResult = await populateQueueFromSheet(rows, supabaseClient, logEntryId);
      
      const executionTimeMs = Date.now() - startTime;
      logStep("Queue populated", { ...queueResult, executionTimeMs });

      await supabaseClient
        .from('sync_logs')
        .update({
          status: 'QUEUED',
          total_rows: queueResult.totalRows,
          skipped: queueResult.skipped,
          warnings: queueResult.warnings.length > 0 ? queueResult.warnings : null,
          completed_at: new Date().toISOString(),
          metadata: { 
            execution_time_ms: executionTimeMs,
            queue_mode: true,
            items_queued: queueResult.totalQueued,
            duplicates_found: queueResult.duplicatesFound || 0,
            duplicate_codes: queueResult.duplicateCodes || [],
            sheet_codigos_b3: queueResult.sheetCodigosB3 || [] // ✅ Armazenar lista de códigos
          }
        })
        .eq('id', logEntryId);

      // Trigger first batch processing asynchronously
      logStep("Triggering first queue batch processing");
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-sync-queue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
          'x-cron-secret': Deno.env.get('CRON_SECRET') || '',
          'X-Trigger-Type': 'auto'
        }
      }).catch(err => logStep("Error triggering queue processor", { error: err.message }));

      // Release lock after queueing (queue processor will handle the rest)
      await supabaseClient
        .from('app_config')
        .update({ value: 'false' })
        .eq('key', 'sync_lock');
      logStep("Sync lock released after queueing");

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'queue',
          totalQueued: queueResult.totalQueued,
          skipped: queueResult.skipped,
          logId: logEntryId,
          executionTimeMs,
          message: 'Sincronização em background iniciada. Os dados serão processados automaticamente.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } else {
      // Direct mode: Process immediately (for small datasets)
      logStep("Using direct mode for immediate processing");
      
      const result = await processSheetDataInBatches(rows, supabaseClient, user.id);
      
      const executionTimeMs = Date.now() - startTime;
      logStep("Processing complete", { ...result, executionTimeMs });

      // Count non-empty rows for accurate total_rows
      const nonEmptyRowsCount = rows.slice(1).filter(row => 
        row && row.some(cell => cell && cell.trim() !== '')
      ).length;
      
      await supabaseClient
        .from('sync_logs')
        .update({
          status: result.failed > 0 ? 'PARTIAL' : 'SUCCESS',
          inserted: result.inserted,
          updated: result.updated,
          failed: result.failed,
          skipped: result.skipped,
          total_rows: nonEmptyRowsCount,
          errors: result.errors.length > 0 ? result.errors : null,
          warnings: result.warnings.length > 0 ? result.warnings : null,
          completed_at: new Date().toISOString(),
          metadata: { 
            execution_time_ms: executionTimeMs, 
            queue_mode: false,
            duplicates_found: result.duplicatesFound || 0,
            duplicate_codes: result.duplicateCodes || [],
            sheet_codigos_b3: result.sheetCodigosB3 || [] // ✅ Armazenar lista de códigos
          }
        })
        .eq('id', logEntryId);

      // ✅ NOVO: Desativar ativos órfãos após sincronização bem-sucedida (direct mode)
      if (result.sheetCodigosB3 && result.sheetCodigosB3.length > 0) {
        logStep("🧹 Post-sync cleanup: Deactivating orphan assets (direct mode)");
        
        const { data: orphanAssets } = await supabaseClient
          .from("assets")
          .select("id, codigo_b3")
          .eq("is_active", true)
          .not("codigo_b3", "in", `(${result.sheetCodigosB3.join(',')})`);
        
        if (orphanAssets && orphanAssets.length > 0) {
          logStep("Found orphan assets to deactivate", { 
            count: orphanAssets.length,
            assets: orphanAssets.map((a: any) => a.codigo_b3)
          });
          
          const orphanIds = orphanAssets.map((a: any) => a.id);
          await supabaseClient
            .from("assets")
            .update({ 
              is_active: false,
              updated_at: new Date().toISOString()
            })
            .in("id", orphanIds);
          
          logStep("✅ Deactivated orphan assets (direct mode)", { 
            count: orphanAssets.length 
          });
        } else {
          logStep("✅ No orphan assets found (direct mode)");
        }
      }

      // Release lock after direct mode completion
      await supabaseClient
        .from('app_config')
        .update({ value: 'false' })
        .eq('key', 'sync_lock');
      logStep("Sync lock released after direct processing");

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'direct',
          ...result,
          logId: logEntryId,
          executionTimeMs
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Sync error", { error: errorMessage });

    // Release lock on error
    await supabaseClient
      .from('app_config')
      .update({ value: 'false' })
      .eq('key', 'sync_lock')
      .then(() => logStep("Sync lock released on error"));

    if (logEntryId) {
      await supabaseClient
        .from('sync_logs')
        .update({
          status: 'FAILED',
          errors: [{ error: errorMessage }],
          completed_at: new Date().toISOString()
        })
        .eq('id', logEntryId);
    }

    const status = errorMessage.includes('AUTH') ? 401 : 
                   errorMessage.includes('ADMIN') ? 403 :
                   errorMessage.includes('SYNC_IN_PROGRESS') ? 409 : 500;

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        message: mapErrorToUserMessage(error as Error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status
      }
    );
  }
});
