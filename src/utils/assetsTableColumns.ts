import type { AssetsTableColumn } from "@/components/AssetsTable";

/**
 * Tabela pública (HOME e /mercado para visitante não autenticado).
 *
 * São exatamente 4 colunas — as únicas que a RPC pública
 * `get_public_market_assets` / `get_top_assets_year` devolve. "Recomendação
 * TRIM" aparece como coluna, mas seu VALOR não é enviado ao navegador de quem
 * não tem direito: o Postgres o entrega como NULL e o AssetsTable renderiza o
 * indicador de bloqueio. Nenhuma outra coluna premium é sequer selecionada no
 * servidor.
 *
 * Quatro colunas cabem confortavelmente na largura de um celular, sem precisar
 * de rolagem horizontal.
 */
export const PUBLIC_ASSET_COLUMNS: AssetsTableColumn[] = [
  { key: "codigo_b3", label: "Código B3", sticky: true },
  { key: "tipo", label: "Tipo de Ativo" },
  { key: "roi2026", label: "ROI 2026", align: "right", tone: "roi" },
  { key: "recomendacao", label: "Recomendação TRIM", align: "right", tone: "recomendacao" },
];
