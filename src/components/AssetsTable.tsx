import { Lock } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PREMIUM_FIELD_KEYS } from "@/utils/fieldVisibility";

export interface AssetsTableColumn {
  /** Chave do campo no objeto de linha. */
  key: string;
  /** Rótulo exibido no cabeçalho. */
  label: string;
  /** Alinhamento do conteúdo (numéricos/percentuais devem ser "right"). */
  align?: "left" | "right";
  /** Coluna fixa (sticky) ao rolar horizontalmente — use só na 1ª coluna. */
  sticky?: boolean;
}

export interface AssetsTableRow {
  id: string;
  [key: string]: unknown;
}

interface AssetsTableProps {
  columns: AssetsTableColumn[];
  rows: AssetsTableRow[];
  isLoading?: boolean;
  error?: unknown;
  emptyMessage?: string;
  /** Chamado quando o usuário clica numa linha (opcional). */
  onRowClick?: (row: AssetsTableRow) => void;
  /** Rótulo mostrado nas células bloqueadas (padrão: "Disponível no PRO"). */
  lockedTooltip?: string;
  /**
   * Se o usuário atual tem acesso completo aos campos premium (PRO+).
   * Default true — para tabelas públicas (home, /mercado) que nunca
   * incluem colunas premium no payload, o valor é irrelevante (a coluna
   * simplesmente não existe na linha). Passe `false` explicitamente em
   * /app/mercado para usuários START, para que os `null` reais dos 4 campos
   * premium apareçam como bloqueados. Para PRO/SPECIALIST/WEALTH, mantenha
   * `true` — um valor `null` genuíno (dado ainda não preenchido na
   * planilha) deve aparecer como "—", nunca como cadeado, já que o usuário
   * tem o plano certo e não há nada "bloqueado" para ele.
   */
  hasFullMarketAccess?: boolean;
}

const isPremiumField = (key: string) => (PREMIUM_FIELD_KEYS as string[]).includes(key);

const renderCellValue = (
  row: AssetsTableRow,
  column: AssetsTableColumn,
  lockedTooltip: string,
  hasFullMarketAccess: boolean
) => {
  const value = row[column.key];

  // Campo premium null APENAS quando o usuário não tem acesso completo: o
  // backend mascarou o valor real (ver supabase/migrations — view
  // asset_analyses_gated). Mostramos um indicador de bloqueio, nunca
  // inventamos um placeholder que pareça um valor real. Para quem já tem
  // acesso completo, um null aqui é um dado genuinamente ausente, tratado
  // como qualquer outro campo vazio (ver bloco abaixo) — nunca como bloqueio.
  if ((value === null || value === undefined || value === "") && isPremiumField(column.key) && !hasFullMarketAccess) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 text-muted-foreground/60 cursor-help select-none">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{lockedTooltip}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{lockedTooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  return <>{String(value)}</>;
};

/**
 * Tabela de ativos reutilizada em /, /mercado e /app/mercado. Cabeçalho fixo
 * durante rolagem vertical, rolagem horizontal no mobile (sem virar cards),
 * primeira coluna fixa quando marcada `sticky`. Valores premium ausentes
 * (null, vindos do backend já mascarados por plano) são exibidos com um
 * indicador de bloqueio, nunca escondidos só por CSS sobre um valor real.
 */
export const AssetsTable = ({
  columns,
  rows,
  isLoading,
  error,
  emptyMessage = "Nenhum ativo encontrado com os filtros selecionados. Tente outros critérios.",
  onRowClick,
  lockedTooltip = "Disponível no plano PRO",
  hasFullMarketAccess = true,
}: AssetsTableProps) => {
  if (error) {
    return (
      <div className="text-center py-12 border border-destructive/30 rounded-lg bg-destructive/5">
        <p className="text-destructive font-medium">Não foi possível carregar os ativos.</p>
        <p className="text-sm text-muted-foreground mt-1">Tente novamente em instantes.</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-x-auto rounded-lg border border-border"
      role="region"
      aria-label="Tabela de ativos"
      tabIndex={0}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.key}
                scope="col"
                className={[
                  column.align === "right" ? "text-right" : "text-left",
                  column.sticky ? "sticky left-0 z-20 bg-background" : "",
                  "whitespace-nowrap",
                ].join(" ")}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.sticky ? "sticky left-0 bg-background" : ""}>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={onRowClick ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset" : ""}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={[
                      column.align === "right" ? "text-right tabular-nums" : "text-left",
                      column.sticky ? "sticky left-0 z-10 bg-background font-medium" : "",
                      "whitespace-nowrap",
                    ].join(" ")}
                  >
                    {renderCellValue(row, column, lockedTooltip, hasFullMarketAccess)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AssetsTable;
