import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Lock, MessageSquare, Plus, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContactSpecialistDialog from "./ContactSpecialistDialog";
import { formatCurrency, formatPercent, formatNumber } from "@/utils/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useViewLimit } from "@/hooks/useViewLimit";
import { useAuth } from "@/contexts/AuthContext";
import { getAssetAccessLevelWithProfile, AccessResult } from "@/utils/assetAccessHelper";
import { normalizePerfilInvestidor, normalizeNotaEspecialista, getRecomendacaoDetailLabel } from "@/utils/filterMappings";
import { cn } from "@/lib/utils";

type PlanType = "FREE" | "START" | "PRO" | "SPECIALIST";

interface AssetCardProps {
  codigo: string;
  nome: string;
  tipo: string;
  setor?: string;
  recomendacao?: string;
  tendencia?: string;
  nota?: number;
  perfilInvestidor?: string;
  carteira?: string;
  resumo?: string;
  taxaSemanal?: number;
  valor?: number;
  roi2026?: number;
  roi2023a2025?: number;
  roi2025?: number;
  dy2025?: number;
  roi24?: number;
  fatorMc?: number;
  roitrim?: number;
  assetId?: string;
  userPlan?: PlanType | string;
  hideAddToCartButton?: boolean;
  notaEspecialista?: string;
  showRemoveButton?: boolean;
  onRemoveFromWallet?: (assetId: string) => void;
}

const AssetCard = ({
  codigo,
  nome,
  tipo,
  setor,
  recomendacao,
  tendencia,
  nota,
  perfilInvestidor,
  carteira,
  resumo,
  taxaSemanal,
  valor,
  roi2026,
  roi2023a2025,
  roi2025,
  dy2025,
  roi24,
  fatorMc,
  roitrim,
  assetId,
  userPlan = "START",
  hideAddToCartButton = false,
  notaEspecialista,
  showRemoveButton = false,
  onRemoveFromWallet,
}: AssetCardProps) => {
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [isLoadingFavorite, setIsLoadingFavorite] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { 
    remainingViews, 
    recordView,
  } = useViewLimit();

  // Lógica simplificada: apenas PLANO + PERFIL DO ATIVO
  const accessResult: AccessResult = getAssetAccessLevelWithProfile(
    userPlan,
    perfilInvestidor
  );

  // Log de segurança para auditoria
  console.log('[SECURITY-CHECK]', {
    codigo,
    userPlan,
    perfilInvestidor,
    accessResult: {
      cardType: accessResult.cardType,
      buttons: accessResult.buttons,
      message: accessResult.message
    }
  });

  // Check if asset is favorited
  const { data: isFavorited } = useQuery({
    queryKey: ["favorite", assetId],
    queryFn: async () => {
      if (!assetId) return false;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from("asset_favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("asset_id", assetId)
        .maybeSingle();

      return !!data;
    },
    enabled: !!assetId,
  });
  
  const navigate = useNavigate();

  const handleUpgradeClick = () => {
    navigate("/assinatura");
  };

  const handleVerMais = async () => {
    if (!assetId) return;
    
    const success = await recordView(assetId);
    if (success) {
      toast({
        title: "✅ Visualização registrada",
        description: `${remainingViews - 1} visualizações restantes hoje.`,
      });
    } else {
      toast({
        title: "🔒 Limite atingido",
        description: "Você atingiu o limite de 3 visualizações diárias. Faça upgrade para acesso ilimitado!",
        variant: "destructive",
      });
      navigate("/assinatura");
    }
  };

  const handleToggleFavorite = async () => {
    if (!assetId) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Login necessário",
        description: "Faça login para adicionar ativos aos favoritos",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingFavorite(true);
    try {
      if (isFavorited) {
        const { error } = await supabase
          .from("asset_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("asset_id", assetId);

        if (error) throw error;

        toast({
          title: "Removido dos favoritos",
          description: `${codigo} foi removido da sua carteira`,
        });
      } else {
        const { error } = await supabase
          .from("asset_favorites")
          .insert({
            user_id: user.id,
            asset_id: assetId,
          });

        if (error) throw error;

        toast({
          title: "Adicionado aos favoritos",
          description: `${codigo} foi adicionado à sua carteira`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["favorite", assetId] });
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favorites-count"] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingFavorite(false);
    }
  };

  const getTrendIcon = () => {
    if (tendencia === "ALTA") return <TrendingUp className="h-4 w-4" />;
    if (tendencia === "BAIXA") return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  // Cores das pílulas para PERFIL INVESTIDOR
  const getPerfilBadgeColor = (perfil?: string) => {
    if (!perfil) return "bg-gray-100 text-gray-700 border-gray-300";
    const upper = perfil.toUpperCase();
    
    if (upper === "START") return "bg-green-500 text-white border-green-600";
    if (upper === "PRO") return "bg-amber-500 text-white border-amber-600";
    if (upper.includes("SPECIALIST")) return "bg-gray-900 text-white border-gray-800";
    
    return "bg-gray-100 text-gray-700 border-gray-300";
  };

  // Cores das pílulas para RECOMENDAÇÃO TRIM
  const getRecomendacaoBadgeColor = (rec?: string) => {
    if (!rec) return "bg-gray-100 text-gray-700 border-gray-300";
    const label = getRecomendacaoDetailLabel(rec);
    
    switch (label) {
      case "COMPRA": return "bg-green-500 text-white border-green-600";
      case "GANHOS": return "bg-yellow-400 text-yellow-900 border-yellow-500";
      case "MANTÉM": return "bg-gray-900 text-white border-gray-800";
      case "NEUTRA": return "bg-gray-400 text-gray-900 border-gray-500";
      case "VENDA": return "bg-red-500 text-white border-red-600";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  // Cores das pílulas para TENDÊNCIA TRIM
  const getTendenciaBadgeColor = (tend?: string) => {
    if (!tend) return "bg-gray-100 text-gray-700 border-gray-300";
    const upper = tend.toUpperCase();
    
    if (upper.includes("ALTA")) return "bg-yellow-400 text-yellow-900 border-yellow-500";
    if (upper.includes("BAIXA")) return "bg-red-500 text-white border-red-600";
    return "bg-gray-400 text-gray-900 border-gray-500"; // NEUTRA
  };

  // Cores das pílulas para NOTA DO ESPECIALISTA
  const getNotaEspecialistaBadgeColor = (nota?: string) => {
    if (!nota) return "bg-gray-100 text-gray-700 border-gray-300";
    
    // Estilo preto (escuro): TOP ANO, TOP TRIM, TOP PDY, Recomendado (RA)
    if (nota.includes("TOP ANO") || nota.includes("TOP TRIM") || nota.includes("TOP GANHOS") || nota.includes("(RA)")) {
      return "bg-gray-900 text-white border-gray-800";
    }
    // Estilo amarelo: Recomendado (DY), (RB), (RM)
    if (nota.includes("(DY)") || nota.includes("(RB)") || nota.includes("(RM)")) {
      return "bg-yellow-400 text-yellow-900 border-yellow-500";
    }
    // Estilo vermelho: Não Recomendado (AF), (TF), (IM)
    if (nota.includes("(AF)") || nota.includes("(TF)") || nota.includes("(IM)")) {
      return "bg-red-500 text-white border-red-600";
    }
    
    return "bg-gray-100 text-gray-700 border-gray-300";
  };

  // Determinar label da tendência - retorna valor original da planilha
  const getTendenciaLabel = (tend?: string) => {
    if (!tend) return "";
    return tend; // Mantém o valor exato da planilha
  };

  // ========== HELPER ÚNICO PARA CLASSES DE DESTAQUE ==========
  // Classes base do badge de destaque (usado em Tendência, Recomendação, ROI, etc.)
  const highlightBadgeBaseClasses = "rounded-full px-3 border";
  
  // Classes do container de destaque (fundo amber)
  const highlightContainerClasses = "bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-300 dark:border-amber-700";
  
  // Classes do flex wrapper interno
  const highlightFlexClasses = "flex items-center gap-2 flex-wrap";
  
  // Classes do label do destaque
  const highlightLabelClasses = "text-xs font-bold text-amber-800 dark:text-amber-300";
  
  // Classes do badge ROI TRIM (cor fixa amber)
  const roiTrimBadgeClasses = cn(highlightBadgeBaseClasses, "bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200");

  // Determinar se deve mostrar card completo ou limitado
  const showFullCard = accessResult.cardType === "full";
  const showUpgradeButton = accessResult.buttons.includes("upgrade");

  return (
    <Card className="shadow-card hover:shadow-elevated transition-all duration-300 group animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-lg text-primary group-hover:text-primary-glow transition-colors">
              {codigo}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-1">{nome}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className="text-xs">
              {tipo}
            </Badge>
            {setor && (
              <span className="text-xs text-muted-foreground text-right max-w-[140px] line-clamp-1">
                <span className="font-medium">Setor:</span> {setor}
              </span>
            )}
          </div>
        </div>
        
        {/* PERFIL DO ATIVO - No cabeçalho */}
        {perfilInvestidor && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-medium text-muted-foreground">PERFIL DO ATIVO:</span>
            <Badge variant="outline" className={cn("rounded-full px-3 text-xs border", getPerfilBadgeColor(perfilInvestidor))}>
              {normalizePerfilInvestidor(perfilInvestidor)}
            </Badge>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* NOTA DO ESPECIALISTA - apenas para cards completos */}
        {notaEspecialista && showFullCard && normalizeNotaEspecialista(notaEspecialista) && (
          <div className={highlightContainerClasses}>
            <div className={highlightFlexClasses}>
              <span className={highlightLabelClasses}>NOTA:</span>
              <Badge variant="outline" className={cn(highlightBadgeBaseClasses, "text-xs", getNotaEspecialistaBadgeColor(notaEspecialista))}>
                {normalizeNotaEspecialista(notaEspecialista.replace("!", "").trim())}
              </Badge>
            </div>
          </div>
        )}

        {showFullCard ? (
          <>
            {/* ========== CARD COMPLETO ========== */}
            

            {/* RECOMENDAÇÃO TRIM - Destaque Padrão com pílula colorida (inclui TOP TRIM) */}
            {(recomendacao || (notaEspecialista && notaEspecialista.toUpperCase().includes("TOP TRIM"))) && (
              <div className={highlightContainerClasses}>
                <div className={highlightFlexClasses}>
                  <span className={highlightLabelClasses}>RECOMENDAÇÃO TRIM:</span>
                  <Badge variant="outline" className={cn(highlightBadgeBaseClasses, 
                    recomendacao ? getRecomendacaoBadgeColor(recomendacao) : "bg-gray-900 text-white border-gray-800"
                  )}>
                    {recomendacao ? getRecomendacaoDetailLabel(recomendacao) : "TOP TRIM"}
                  </Badge>
                </div>
              </div>
            )}

            {/* TENDÊNCIA TRIM - Destaque Padrão com pílula colorida */}
            {tendencia && (
              <div className={highlightContainerClasses}>
                <div className={highlightFlexClasses}>
                  <span className={highlightLabelClasses}>TENDÊNCIA TRIM:</span>
                  <Badge variant="outline" className={cn(highlightBadgeBaseClasses, getTendenciaBadgeColor(tendencia))}>
                    {getTendenciaLabel(tendencia)}
                  </Badge>
                </div>
              </div>
            )}

            {/* ROI TRIM (R) e ROI TRIM (T) - Lado a lado na mesma linha */}
            {(taxaSemanal !== undefined || roitrim !== undefined) && (
              <div className="grid grid-cols-2 gap-2">
                {taxaSemanal !== undefined && (
                  <div className={cn(highlightContainerClasses, "p-2")}>
                    <div className={highlightFlexClasses}>
                      <span className={highlightLabelClasses}>ROI TRIM (R):</span>
                      <Badge variant="outline" className={roiTrimBadgeClasses}>
                        {formatPercent(taxaSemanal)}
                      </Badge>
                    </div>
                  </div>
                )}
                {roitrim !== undefined && (
                  <div className={cn(highlightContainerClasses, "p-2")}>
                    <div className={highlightFlexClasses}>
                      <span className={highlightLabelClasses}>ROI TRIM (T):</span>
                      <Badge variant="outline" className={roiTrimBadgeClasses}>
                        {formatPercent(roitrim)}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Seção secundária - dados numéricos */}
            <div className="pt-2 border-t space-y-2 text-muted-foreground">
              {valor !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-xs">VALOR:</span>
                  <span className="text-xs font-medium">{formatCurrency(valor)}</span>
                </div>
              )}
              {roi2026 !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-xs">ROI 2026:</span>
                  <span className="text-xs font-medium">{formatPercent(roi2026)}</span>
                </div>
              )}
              {roi2025 !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-xs">ROI 2025:</span>
                  <span className="text-xs font-medium">{formatPercent(roi2025)}</span>
                </div>
              )}
              {dy2025 !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-xs">DY 2025:</span>
                  <span className="text-xs font-medium">{formatPercent(dy2025)}</span>
                </div>
              )}
              {fatorMc !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-xs">MULT CAPITAL:</span>
                  <span className="text-xs font-medium">{formatNumber(fatorMc)}</span>
                </div>
              )}
              {roi2023a2025 !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-xs">ROI 2023A26:</span>
                  <span className="text-xs font-medium">{formatPercent(roi2023a2025)}</span>
                </div>
              )}
            </div>

            {/* Botão Remover da Carteira */}
            {showRemoveButton && onRemoveFromWallet && assetId && (
              <div className="pt-4">
                <Button
                  variant="default"
                  size="default"
                  onClick={() => onRemoveFromWallet(assetId)}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Remover da Carteira
                </Button>
              </div>
            )}

            {/* Botão Adicionar à Carteira */}
            {!hideAddToCartButton && assetId && !showRemoveButton && (
              <div className="pt-2">
                <Button
                  size="sm"
                  variant={isFavorited ? "secondary" : "outline"}
                  className="w-full"
                  onClick={handleToggleFavorite}
                  disabled={isLoadingFavorite}
                >
                  {isLoadingFavorite ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isFavorited ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Remover da Carteira
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar à Carteira
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ========== CARD LIMITADO (FREE ou Upgrade necessário) ========== */}
            <div className="space-y-3 pt-2">


              {/* Seção secundária - dados numéricos */}
              <div className="pt-2 border-t space-y-2 text-muted-foreground">
                {valor !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs">VALOR:</span>
                    <span className="text-xs font-medium">{formatCurrency(valor)}</span>
                  </div>
                )}
                {roi2026 !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs">ROI 2026:</span>
                    <span className="text-xs font-medium">{formatPercent(roi2026)}</span>
                  </div>
                )}
                {roi2025 !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs">ROI 2025:</span>
                    <span className="text-xs font-medium">{formatPercent(roi2025)}</span>
                  </div>
                )}
                {dy2025 !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs">DY 2025:</span>
                    <span className="text-xs font-medium">{formatPercent(dy2025)}</span>
                  </div>
                )}
                {fatorMc !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs">MULT CAPITAL:</span>
                    <span className="text-xs font-medium">{formatNumber(fatorMc)}</span>
                  </div>
                )}
                {roi2023a2025 !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs">ROI 2023A25:</span>
                    <span className="text-xs font-medium">{formatPercent(roi2023a2025)}</span>
                  </div>
                )}
              </div>

              {/* Mensagem de análise limitada */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 bg-muted/30 p-3 rounded-md">
                <Lock className="h-4 w-4 text-primary" />
                <span className="text-xs">{accessResult.message || "Análise completa disponível para assinantes"}</span>
              </div>
              
              {/* Botões baseados no accessResult */}
              <div className="flex flex-col gap-2">
                
                {/* Botão Fazer Upgrade */}
                {showUpgradeButton && (
                  <Button 
                    size="sm" 
                    className="w-full gradient-cta text-accent-foreground font-semibold hover:opacity-90"
                    onClick={handleUpgradeClick}
                  >
                    Fazer Upgrade
                  </Button>
                )}
                
                {/* Botão Remover da Carteira */}
                {showRemoveButton && onRemoveFromWallet && assetId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onRemoveFromWallet(assetId)}
                    className="w-full"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Remover da Carteira
                  </Button>
                )}
                
                {/* Botão Adicionar à Carteira */}
                {assetId && !showRemoveButton && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant={isFavorited ? "secondary" : "outline"}
                          className="px-3"
                          onClick={handleToggleFavorite}
                          disabled={isLoadingFavorite}
                        >
                          {isLoadingFavorite ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isFavorited ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{isFavorited ? "Remover da minha carteira" : "Adicionar a minha carteira"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* Contact Dialog */}
      <ContactSpecialistDialog
        open={showContactDialog}
        onOpenChange={setShowContactDialog}
        assetCode={codigo}
        assetName={nome}
      />
    </Card>
  );
};

export default AssetCard;
