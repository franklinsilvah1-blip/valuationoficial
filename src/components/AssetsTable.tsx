import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  canViewAssetField,
  getUnlockCta,
  isProtectedAssetField,
  type MarketLevel,
} from "@/utils/marketAccess";
import {
  BADGE_BASE_CLASSES,
  formatRoiText,
  getCarteiraBadgeColor,
  getNotaEspecialistaBadgeColor,
  getPerfilBadgeColor,
  getRecomendacaoBadgeColor,
  getRoiToneClass,
  getTendenciaBadgeColor,
} from "@/utils/assetBadgeColors";

/** Como a célula é pintada. Segue o código de cores da planilha. */
export type AssetCellTone =
  | "plain"
  | "roi"
  | "perfil"
  | "recomendacao"
  | "tendencia"
  | "carteira"
  | "nota";

export interface AssetsTableColumn {
  /** Chave do campo no objeto de linha. */
  key: string;
  /** Rótulo exibido no cabeçalho. */
  label: string;
  /** Alinhamento do conteúdo (numéricos/percentuais devem ser "right"). */
  align?: "left" | "right";
  /** Coluna fixa (sticky) ao rolar horizontalmente — use só na 1ª coluna. */
  sticky?: boolean;
  /** Formatação/cor da célula conforme o código de cores da base. */
  tone?: AssetCellTone;
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
  /**
   * Nível de acesso do usuário atual (espelho de `current_user_market_level()`
   * no banco). Junto com o PERFIL de cada ativo, decide se um campo premium
   * vazio deve aparecer como "bloqueado" (cadeado + CTA) ou apenas como dado
   * ausente ("—").
   *
   * A proteção real do valor NÃO está aqui: os campos premium chegam `null`
   * porque o Postgres os mascarou por linha (ver
   * supabase/migrations/20260922120000_market_access_matrix.sql). Esta prop só
   * escolhe a apresentação.
   *
   * Default "FULL": para tabelas que nunca incluem coluna premium no payload,
   * o valor é irrelevante e um `null` genuíno aparece como "—", não como
   * cadeado.
   */
  marketLevel?: MarketLevel;
  /** Conteúdo extra renderizado ao final de cada linha (ex.: ação de carteira). */
  renderRowActions?: (row: AssetsTableRow) => React.ReactNode;
  /** Rótulo do cabeçalho da coluna de ações, quando houver. */
  rowActionsLabel?: string;
}

/**
 * Célula de campo premium a que o usuário não tem direito. O valor real nunca
 * chegou ao navegador — não existe nada a revelar por CSS, DevTools ou React
 * state. Mostramos um cadeado discreto com o CTA do fluxo já existente
 * (cadastro para visitante, /assinatura para upgrade), sem transformar a
 * célula em propaganda.
 */
const LockedCell = ({
  level,
  assetProfile,
  fieldKey,
}: {
  level: MarketLevel;
  assetProfile?: string | null;
  fieldKey: string;
}) => {
  const cta = getUnlockCta(level, assetProfile, fieldKey);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={cta.href}
            onClick={(e) => e.stopPropagation()}
            aria-label={cta.label}
            className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-muted-foreground/70 hover:text-primary hover:bg-primary/5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">{cta.label}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>{cta.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const renderToned = (tone: AssetCellTone | undefined, value: unknown) => {
  const text = String(value);

  switch (tone) {
    case "roi":
      return <span className={getRoiToneClass(value)}>{formatRoiText(value)}</span>;
    case "perfil":
      return (
        <Badge variant="outline" className={cn(BADGE_BASE_CLASSES, "text-xs", getPerfilBadgeColor(text))}>
          {text}
        </Badge>
      );
    case "recomendacao":
      return (
        <Badge variant="outline" className={cn(BADGE_BASE_CLASSES, "text-xs", getRecomendacaoBadgeColor(text))}>
          {text}
        </Badge>
      );
    case "tendencia":
      return (
        <Badge variant="outline" className={cn(BADGE_BASE_CLASSES, "text-xs", getTendenciaBadgeColor(text))}>
          {text}
        </Badge>
      );
    case "carteira":
      return (
        <Badge variant="outline" className={cn(BADGE_BASE_CLASSES, "text-xs", getCarteiraBadgeColor(text))}>
          {text}
        </Badge>
      );
    case "nota":
      return (
        <Badge variant="outline" className={cn(BADGE_BASE_CLASSES, "text-xs", getNotaEspecialistaBadgeColor(text))}>
          {text}
        </Badge>
      );
    default:
      return <>{text}</>;
  }
};

const renderCellValue = (row: AssetsTableRow, column: AssetsTableColumn, marketLevel: MarketLevel) => {
  const value = row[column.key];
  const isEmpty = value === null || value === undefined || value === "";

  // Campo protegido vazio E sem direito de acesso: o backend mascarou o valor
  // real. Mostramos o indicador de bloqueio, nunca um placeholder que pareça
  // um valor real. Para quem TEM direito, um vazio aqui é dado genuinamente
  // ausente na planilha e aparece como "—".
  //
  // canViewAssetField aplica a regra certa POR CAMPO: os 5 campos da matriz
  // dependem do PERFIL do ativo; TENDÊNCIA TRIM depende só do plano.
  if (isEmpty && isProtectedAssetField(column.key)) {
    const profile = row.perfil_investidor as string | undefined;
    if (!canViewAssetField(marketLevel, column.key, profile)) {
      return <LockedCell level={marketLevel} assetProfile={profile} fieldKey={column.key} />;
    }
  }

  if (isEmpty) {
    return <span className="text-muted-foreground">—</span>;
  }

  return renderToned(column.tone, value);
};

/**
 * Tabela de ativos reutilizada em /, /mercado e /app/mercado.
 *
 * Responsividade: cabeçalho fixo na rolagem vertical, rolagem horizontal
 * controlada no mobile (sem virar cards, para não perder a comparação entre
 * ativos) e primeira coluna fixa quando marcada `sticky`, de modo que o código
 * B3 continue visível enquanto se rola lateralmente.
 */
export const AssetsTable = ({
  columns,
  rows,
  isLoading,
  error,
  emptyMessage = "Nenhum ativo encontrado com os filtros selecionados. Tente outros critérios.",
  onRowClick,
  marketLevel = "FULL",
  renderRowActions,
  rowActionsLabel = "Carteira",
}: AssetsTableProps) => {
  if (error) {
    return (
      <div className="text-center py-12 border border-destructive/30 rounded-lg bg-destructive/5">
        <p className="text-destructive font-medium">Não foi possível carregar os ativos.</p>
        <p className="text-sm text-muted-foreground mt-1">Tente novamente em instantes.</p>
      </div>
    );
  }

  const totalColumns = columns.length + (renderRowActions ? 1 : 0);

  // Cabeçalho com fundo e peso próprios, destacado das linhas (identidade
  // visual atual: tom do "muted" da marca, texto em negrito e caixa alta
  // discreta), mantendo contraste suficiente em tema claro e escuro.
  const headCellClasses =
    "bg-muted text-foreground font-bold text-xs uppercase tracking-wide whitespace-nowrap";

  return (
    <div
      className="relative w-full overflow-x-auto rounded-lg border border-border"
      role="region"
      aria-label="Tabela de ativos"
      tabIndex={0}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 shadow-sm">
          <TableRow className="hover:bg-muted border-b-2 border-border">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                scope="col"
                className={cn(
                  headCellClasses,
                  column.align === "right" ? "text-right" : "text-left",
                  column.sticky && "sticky left-0 z-20"
                )}
              >
                {column.label}
              </TableHead>
            ))}
            {renderRowActions && (
              <TableHead scope="col" className={cn(headCellClasses, "text-right")}>
                {rowActionsLabel}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {Array.from({ length: totalColumns }).map((__, j) => (
                  <TableCell key={j} className={j === 0 && columns[0]?.sticky ? "sticky left-0 bg-background" : ""}>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={totalColumns} className="text-center py-12 text-muted-foreground">
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
                    className={cn(
                      column.align === "right" ? "text-right tabular-nums" : "text-left",
                      column.sticky && "sticky left-0 z-10 bg-background font-semibold",
                      "whitespace-nowrap"
                    )}
                  >
                    {renderCellValue(row, column, marketLevel)}
                  </TableCell>
                ))}
                {renderRowActions && (
                  <TableCell className="text-right whitespace-nowrap">{renderRowActions(row)}</TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AssetsTable;
