import type { AssetsTableColumn } from "@/components/AssetsTable";

/**
 * Colunas básicas (nunca incluem os 4 campos premium) usadas em qualquer
 * tabela de ativos visível para visitantes/anônimos — home e /mercado.
 */
export const PUBLIC_ASSET_COLUMNS: AssetsTableColumn[] = [
  { key: "codigo_b3", label: "Código B3", sticky: true },
  { key: "nome", label: "Nome do ativo" },
  { key: "tipo", label: "Tipo" },
  { key: "setor", label: "Setor" },
  { key: "perfil_investidor", label: "Perfil do ativo" },
  { key: "valor", label: "Valor", align: "right" },
  { key: "roi2026", label: "ROI 2026", align: "right" },
  { key: "dy2025", label: "DY 2025", align: "right" },
  { key: "roitrim", label: "ROI Trim", align: "right" },
  { key: "roi2025", label: "ROI 2025", align: "right" },
  { key: "fator_mc", label: "Mult. Capital", align: "right" },
  { key: "roi2023a2025", label: "ROI 2023 a 2025", align: "right" },
];
