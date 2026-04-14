import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import SearchFilters from "@/components/SearchFilters";
import AssetCard from "@/components/AssetCard";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useViewLimit } from "@/hooks/useViewLimit";
import { useAuth } from "@/contexts/AuthContext";
import { hasFullAccessToAsset, getRequiredPlanForAsset } from "@/utils/fieldVisibility";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AssetCardSkeleton from "@/components/AssetCardSkeleton";
import { 
  RECOMENDACAO_GROUPS, 
  TENDENCIA_GROUPS,
  PERFIL_INVESTIDOR_OPTIONS, 
  RECOMENDACAO_OPTIONS, 
  TENDENCIA_OPTIONS,
  CARTEIRA_OPTIONS,
  NOTA_ESPECIALISTA_OPTIONS,
  getFilterLabel 
} from "@/utils/filterMappings";
// Helper: parse numeric value from text fields (e.g. "12.5%", "12,5", "R$ 30")
const parseNumericText = (val: any): number => {
  if (val == null || val === "") return -Infinity;
  const str = String(val).replace(/[%R$\s]/g, "").replace(",", ".");
  const n = parseFloat(str);
  return isNaN(n) ? -Infinity : n;
};

const sortResultsClientSide = (items: any[], sortKey: string): any[] => {
  const fieldMap: Record<string, string> = {
    roi2026: "roi2026",
    roi2025: "roi2025",
    roi2023a26: "roi2023a2025",
  };
  const [field, dir] = sortKey.split("_");
  const dataField = fieldMap[field];
  if (!dataField) return items;
  const desc = dir === "desc";
  return [...items].sort((a, b) => {
    const va = parseNumericText(a[dataField]);
    const vb = parseNumericText(b[dataField]);
    return desc ? vb - va : va - vb;
  });
};

const MercadoApp = () => {
  const navigate = useNavigate();
  const {
    userPlan
  } = useAuth();
  const {
    limitReached,
    recordView,
    isFreeUser
  } = useViewLimit();
  const [filters, setFilters] = useState({
    codigo: "",
    tipo: "all",
    setor: "all",
    perfil_investidor: "all",
    recomendacao: "all",
    tendencia: "all",
    carteira: "all",
    nota_especialista: "all"
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("codigo_asc");
  const itemsPerPage = 30;
  const handleViewAsset = async (assetId: string) => {
    if (isFreeUser) {
      if (limitReached) {
        navigate("/assinatura");
        return;
      }
      const success = await recordView(assetId);
      if (!success) {
        navigate("/assinatura");
      }
    }
  };

  // Query para contar total de itens
  const {
    data: totalCount
  } = useQuery({
    queryKey: ["assets-analyses-count", filters, userPlan],
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    queryFn: async () => {
      // @ts-ignore - Supabase type inference issue with deep chaining
      let query = supabase
        .from("assets")
        .select("id, asset_analyses!inner(id)", { count: "exact", head: true })
        .eq("is_active", true); // Only count active assets from spreadsheet
      if (filters.codigo) {
        query = query.or(`codigo_b3.ilike.%${filters.codigo}%,nome.ilike.%${filters.codigo}%`);
      }
      if (filters.tipo && filters.tipo !== "all") {
        query = query.eq("tipo", filters.tipo.toUpperCase() as any);
      }
      if (filters.setor && filters.setor !== "all") {
        query = query.eq("setor", filters.setor);
      }

      // Filtros de análise - MESMOS da query principal
      if (filters.perfil_investidor && filters.perfil_investidor !== "all") {
        query = query.eq("asset_analyses.perfil_investidor", filters.perfil_investidor);
      }
      if (filters.recomendacao && filters.recomendacao !== "all") {
        const recomendacaoValues = RECOMENDACAO_GROUPS[filters.recomendacao];
        if (recomendacaoValues && recomendacaoValues.length > 0) {
          query = query.in("asset_analyses.recomendacao", recomendacaoValues as any);
        } else {
          query = query.eq("asset_analyses.recomendacao", filters.recomendacao as any);
        }
      }
      if (filters.tendencia && filters.tendencia !== "all") {
        const tendenciaValues = TENDENCIA_GROUPS[filters.tendencia];
        if (tendenciaValues && tendenciaValues.length > 0) {
          query = query.in("asset_analyses.tendencia", tendenciaValues as any);
        } else {
          query = query.eq("asset_analyses.tendencia", filters.tendencia as any);
        }
      }
      if (filters.carteira && filters.carteira !== "all") {
        query = query.eq("asset_analyses.carteira", filters.carteira as any);
      }
      if (filters.nota_especialista && filters.nota_especialista !== "all") {
        query = query.eq("asset_analyses.nota_especialista", filters.nota_especialista);
      }
      const {
        count,
        error
      } = await query;
      if (error) throw error;
      return count || 0;
    }
  });
  const totalPages = Math.ceil((totalCount || 0) / itemsPerPage);

  
  const {
    data: assetsWithAnalyses,
    isLoading,
    isFetching
  } = useQuery({
    queryKey: ["assets-analyses", filters, userPlan, currentPage, sortBy],
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    placeholderData: (previousData) => previousData, // Mantém dados anteriores durante navegação
    queryFn: async () => {
      // Build query
      // @ts-ignore - Supabase type inference issue with deep chaining
      let query = supabase.from("assets").select(`
          *,
          asset_analyses!inner(
            perfil_investidor,
            recomendacao,
            tendencia,
            taxa_semanal,
            roi2026,
            carteira,
            nota_especialista,
            valor,
            roitrim,
            roi2025,
            dy2025,
            roi2024,
            fator_mc,
            roi2023a2025
          )
        `)
        .eq("is_active", true); // Only fetch active assets from spreadsheet
      
      if (filters.codigo) {
        query = query.or(`codigo_b3.ilike.%${filters.codigo}%,nome.ilike.%${filters.codigo}%`);
      }
      if (filters.tipo && filters.tipo !== "all") {
        query = query.eq("tipo", filters.tipo.toUpperCase() as any);
      }
      if (filters.setor && filters.setor !== "all") {
        query = query.eq("setor", filters.setor);
      }

      // Filtros de análise (agora há apenas uma análise por ativo)
      if (filters.perfil_investidor && filters.perfil_investidor !== "all") {
        query = query.eq("asset_analyses.perfil_investidor", filters.perfil_investidor);
      }
      if (filters.recomendacao && filters.recomendacao !== "all") {
        const recomendacaoValues = RECOMENDACAO_GROUPS[filters.recomendacao];
        if (recomendacaoValues && recomendacaoValues.length > 0) {
          query = query.in("asset_analyses.recomendacao", recomendacaoValues as any);
        } else {
          query = query.eq("asset_analyses.recomendacao", filters.recomendacao as any);
        }
      }
      if (filters.tendencia && filters.tendencia !== "all") {
        const tendenciaValues = TENDENCIA_GROUPS[filters.tendencia];
        if (tendenciaValues && tendenciaValues.length > 0) {
          query = query.in("asset_analyses.tendencia", tendenciaValues as any);
        } else {
          query = query.eq("asset_analyses.tendencia", filters.tendencia as any);
        }
      }
      if (filters.carteira && filters.carteira !== "all") {
        query = query.eq("asset_analyses.carteira", filters.carteira as any);
      }
      if (filters.nota_especialista && filters.nota_especialista !== "all") {
        query = query.eq("asset_analyses.nota_especialista", filters.nota_especialista);
      }

      // Aplicar ordenação base (código como fallback)
      const [sortField] = sortBy.split("_");
      if (sortField === "codigo") {
        const isAsc = sortBy.includes("asc");
        query = query.order("codigo_b3", { ascending: isAsc });
      } else {
        query = query.order("codigo_b3", { ascending: true });
      }
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      const {
        data,
        error
      } = await query.range(from, to);
      if (error) throw error;

      // Processar resultados - agora cada ativo tem UMA análise
      const mapped = data?.map((asset: any) => {
        const analysis = Array.isArray(asset.asset_analyses) ? asset.asset_analyses[0] : asset.asset_analyses || {};
        if (!analysis || Object.keys(analysis).length === 0) return null;

        // Determinar nível de acesso e plano necessário
        const hasFullAccess = hasFullAccessToAsset(userPlan, analysis.carteira);
        const requiredPlan = getRequiredPlanForAsset(analysis.carteira);

        // Definir accessLevel para compatibilidade com AssetCard
        let accessLevel: "full" | "limited" | "upgrade_to_pro" | "upgrade_to_specialist";
        if (hasFullAccess) {
          accessLevel = "full";
        } else if (userPlan === "FREE") {
          accessLevel = "limited";
        } else if (requiredPlan === "SPECIALIST") {
          accessLevel = "upgrade_to_specialist";
        } else {
          accessLevel = "upgrade_to_pro";
        }
        return {
          ...asset,
          perfilInvestidor: analysis.perfil_investidor,
          recomendacao: analysis.recomendacao,
          tendencia: analysis.tendencia,
          taxaSemanal: analysis.taxa_semanal,
          roi2026: analysis.roi2026,
          carteira: analysis.carteira,
          nota_especialista: analysis.nota_especialista,
          valor: analysis.valor,
          roi2023a2025: analysis.roi2023a2025,
          roitrim: analysis.roitrim,
          roi2025: analysis.roi2025,
          dy2025: analysis.dy2025,
          roi2024: analysis.roi2024,
          fatorMc: analysis.fator_mc,
          accessLevel
        };
      }).filter(Boolean) || [];
      return sortResultsClientSide(mapped, sortBy);
    }
  });
  const handleSearch = (newFilters: any) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
    setCurrentPage(1); // Reset to first page on new search
  };
  const handleSortChange = (value: string) => {
    setSortBy(value);
    setCurrentPage(1);
  };
  const removeFilter = (filterKey: string) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: "all"
    }));
    setCurrentPage(1);
  };
  const clearAllFilters = () => {
    setFilters({
      codigo: "",
      tipo: "all",
      setor: "all",
      perfil_investidor: "all",
      recomendacao: "all",
      tendencia: "all",
      carteira: "all",
      nota_especialista: "all"
    });
    setCurrentPage(1);
  };

  // Friendly labels for filter values - usando função centralizada

  // Get active filters for display
  const activeFilters = Object.entries(filters).filter(([key, value]) => {
    // Remover filtros avançados para usuários FREE (exceto nota_especialista que é para todos)
    if (userPlan === "FREE" && ["perfil_investidor", "recomendacao", "tendencia", "carteira"].includes(key)) {
      return false;
    }
    if (key === "codigo") return value !== "";
    return value !== "all";
  }).map(([key, value]) => ({
    key,
    value,
    label: key === "codigo" ? `Código: ${value}` : getFilterLabel(key, value)
  }));
  const hasActiveFilters = activeFilters.length > 0;
  return <AppLayout title="Mercado">
      <div className="space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Mercado Avançado</h1>
          <p className="text-muted-foreground">Explore ativos globais do mercado. Busca gratuita com análises básicas.</p>
        </div>

        {/* Busca por código - disponível para plano FREE */}
        <div className="mb-8">
          <SearchFilters onSearch={handleSearch} showAllFilters={userPlan !== "FREE"} isFreeUser={userPlan === "FREE"} />
        </div>

        {/* Filtros avançados - apenas para usuários não FREE */}
        {userPlan !== "FREE" && <div className="space-y-4 mb-8">
            {/* Active Filters Badges */}
            <div className={`flex flex-wrap items-center gap-2 p-4 bg-muted/50 rounded-lg border border-border transition-all duration-300 overflow-hidden ${hasActiveFilters ? 'opacity-100 max-h-40 scale-100' : 'opacity-0 max-h-0 p-0 border-0 scale-95'}`}>
                <span className="text-sm font-medium text-muted-foreground mr-2">
                  Filtros ativos:
                </span>
                {activeFilters.map(({
            key,
            value,
            label
          }, index) => <Badge 
                    key={`${key}-${value}`} 
                    variant="secondary" 
                    className="gap-1 pr-1 cursor-pointer hover:bg-secondary/80 transition-all duration-200 animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {label}
                    <button onClick={() => removeFilter(key)} className="ml-1 rounded-full hover:bg-background/80 p-0.5 transition-colors" aria-label={`Remover filtro ${label}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>)}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllFilters} 
                  className={`h-7 text-xs gap-1 transition-all duration-300 hover:bg-destructive/10 hover:text-destructive ${activeFilters.length > 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
                >
                  <X className="h-3 w-3" />
                  Limpar todos
                </Button>
              </div>

            {/* Filtros avançados - apenas para planos pagos */}
            {userPlan !== "FREE" && <div className="space-y-4">
                {/* Linha 1: Tipo, Setor, Perfil Investidor */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <label className="text-sm font-semibold text-foreground flex items-center gap-1 cursor-help">
                            Tipo
                            <span className="text-muted-foreground text-xs">ⓘ</span>
                          </label>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Filtre por categoria do ativo: Ações, FIIs, BDRs, ETFs, Criptos, Índices ou Renda Fixa</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Select onValueChange={value => setFilters({
                      ...filters,
                      tipo: value
                    })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os tipos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os tipos</SelectItem>
                        <SelectItem value="ACAO">Ação</SelectItem>
                        <SelectItem value="BDR">BDR</SelectItem>
                        <SelectItem value="CRIPTO">Cripto</SelectItem>
                        <SelectItem value="ETF">ETF</SelectItem>
                        <SelectItem value="FII">FII</SelectItem>
                        <SelectItem value="INDICE">Índice</SelectItem>
                        <SelectItem value="RFIXA">Renda Fixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <label className="text-sm font-semibold text-foreground flex items-center gap-1 cursor-help">
                            Setor
                            <span className="text-muted-foreground text-xs">ⓘ</span>
                          </label>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Filtre por setor de atuação: Bancos, Tech, Consumo, Petróleo, FIIs e outros</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Select onValueChange={value => setFilters({
                      ...filters,
                      setor: value
                    })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os setores" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectItem value="all">Todos os setores</SelectItem>
                        <SelectItem value="Agro/Alimentos">Agro/Alimentos</SelectItem>
                        <SelectItem value="Asia">Asia</SelectItem>
                        <SelectItem value="Bancos">Bancos</SelectItem>
                        <SelectItem value="Bolsas">Bolsas</SelectItem>
                        <SelectItem value="Brasil">Brasil</SelectItem>
                        <SelectItem value="Consumo">Consumo</SelectItem>
                        <SelectItem value="Cripto">Cripto</SelectItem>
                        <SelectItem value="Educação">Educação</SelectItem>
                        <SelectItem value="EUA">EUA</SelectItem>
                        <SelectItem value="Europa">Europa</SelectItem>
                        <SelectItem value="Exp. imóveis">Exp. imóveis</SelectItem>
                        <SelectItem value="FI Agro">FI Agro</SelectItem>
                        <SelectItem value="FI Híbrido">FI Híbrido</SelectItem>
                        <SelectItem value="FI Papel">FI Papel</SelectItem>
                        <SelectItem value="FI Tijolo">FI Tijolo</SelectItem>
                        <SelectItem value="Financeiro">Financeiro</SelectItem>
                        <SelectItem value="Global">Global</SelectItem>
                        <SelectItem value="Metais">Metais</SelectItem>
                        <SelectItem value="Incorporadora">Incorporadora</SelectItem>
                        <SelectItem value="Indústrias">Indústrias</SelectItem>
                        <SelectItem value="Máquinas/Peças">Máquinas/Peças</SelectItem>
                        <SelectItem value="Mineração/Aço">Mineração/Aço</SelectItem>
                        <SelectItem value="Outros">Outros</SelectItem>
                        <SelectItem value="Petróleo">Petróleo</SelectItem>
                        <SelectItem value="Renda Fixa">Renda Fixa</SelectItem>
                        <SelectItem value="Serviços">Serviços</SelectItem>
                        <SelectItem value="Tech">Tech</SelectItem>
                        <SelectItem value="Tecnologia Info">Tecnologia Info</SelectItem>
                        <SelectItem value="Telecom">Telecom</SelectItem>
                        <SelectItem value="Utilities">Utilities</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <label className="text-sm font-semibold text-foreground flex items-center gap-1 cursor-help">
                            Perfil do Ativo
                            <span className="text-muted-foreground text-xs">ⓘ</span>
                          </label>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Filtre ativos por perfil: START, PRO ou SPECIALIST</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Select onValueChange={value => setFilters({
                      ...filters,
                      perfil_investidor: value
                    })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {PERFIL_INVESTIDOR_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Linha 2: Carteira, Tendência, Recomendação, Nota Especialista */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <label className="text-sm font-semibold text-foreground flex items-center gap-1 cursor-help">
                            Carteira
                            <span className="text-muted-foreground text-xs">ⓘ</span>
                          </label>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Filtre por nível de carteira recomendada para o ativo</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Select onValueChange={value => setFilters({
                      ...filters,
                      carteira: value
                    })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {CARTEIRA_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <label className="text-sm font-semibold text-foreground flex items-center gap-1 cursor-help">
                            Tendência
                            <span className="text-muted-foreground text-xs">ⓘ</span>
                          </label>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Tendência trimestral: ALTA (ROI acima da taxa), NEUTRA ou BAIXA</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Select onValueChange={value => setFilters({
                      ...filters,
                      tendencia: value
                    })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {TENDENCIA_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <label className="text-sm font-semibold text-foreground flex items-center gap-1 cursor-help">
                            Recomendação TRIM
                            <span className="text-muted-foreground text-xs">ⓘ</span>
                          </label>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Recomendação trimestral: COMPRA, VENDA ou NEUTRA. Inclui filtros de ganhos &gt;10% e &gt;20%</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Select onValueChange={value => setFilters({
                      ...filters,
                      recomendacao: value
                    })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {RECOMENDACAO_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <label className="text-sm font-semibold text-foreground flex items-center gap-1 cursor-help">
                            Nota Especialista
                            <span className="text-muted-foreground text-xs">ⓘ</span>
                          </label>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Classificação especial do especialista: Ativo TOP, Recomendado ou Não Recomendado</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Select onValueChange={value => setFilters({
                      ...filters,
                      nota_especialista: value
                    })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as notas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as notas</SelectItem>
                        {NOTA_ESPECIALISTA_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>}
          </div>}

        {/* Results Counter & Sort Controls */}
        {!isLoading && (totalCount || 0) > 0 && <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{totalCount || 0}</span> resultado{(totalCount || 0) !== 1 ? 's' : ''} encontrado{(totalCount || 0) !== 1 ? 's' : ''}
              {totalPages > 1 && <span className="ml-2">
                  • Página <span className="font-medium text-foreground">{currentPage}</span> de <span className="font-medium text-foreground">{totalPages}</span>
                </span>}
            </div>
            
            <div className="flex items-center gap-2">
              <label htmlFor="sort-select" className="text-sm text-muted-foreground whitespace-nowrap">
                Ordenar por:
              </label>
              <select id="sort-select" value={sortBy} onChange={e => handleSortChange(e.target.value)} className="px-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="codigo_asc">Código (A-Z)</option>
                <option value="codigo_desc">Código (Z-A)</option>
                <option value="roi2026_desc">ROI 2026 (Maior)</option>
                <option value="roi2025_desc">ROI 2025 (Maior)</option>
                <option value="roi2023a26_desc">ROI 2023A26 (Maior)</option>
              </select>
            </div>
          </div>}

        {/* Card explicativo para usuários FREE */}
        {userPlan === "FREE" && <div className="mb-12">
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 shadow-lg">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                    Ativos em Destaque
                  </h3>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    Acesse os melhores ativos globais recomendados por Especialistas.
                  </p>
                  <div className="flex flex-col items-center gap-2 pt-4">
                    <span className="text-sm text-foreground flex items-center gap-2">
                      ✓ Ativos TOP ANO
                    </span>
                    <span className="text-sm text-foreground flex items-center gap-2">
                      ✓ Ativos TOP TRIM
                    </span>
                    <span className="text-sm text-foreground flex items-center gap-2">
                      ✓ Ativos TOP GANHOS
                    </span>
                  </div>
                  <div className="pt-6">
                    <Button size="lg" className="gradient-cta text-accent-foreground font-bold text-base md:text-lg px-6 md:px-8 hover-scale shadow-lg" onClick={() => navigate("/assinatura")}>
                      🚀 Fazer upgrade plano
                    </Button>
                    <p className="text-xs text-muted-foreground mt-3">
                      A partir de R$ 49,90/mês • Acesso ilimitado a todos os ativos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>}

        {/* Results */}
        <div id="assets-list">
        {isLoading || isFetching ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(12)].map((_, i) => <AssetCardSkeleton key={i} />)}
          </div>
        ) : assetsWithAnalyses && assetsWithAnalyses.length > 0 ? <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {assetsWithAnalyses.map((asset: any, index: number) => (
                <div 
                  key={asset.id} 
                  className="animate-fade-in"
                  style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                >
                  <AssetCard 
                    assetId={asset.id} 
                    codigo={asset.codigo_b3} 
                    nome={asset.nome} 
                    tipo={asset.tipo} 
                    setor={asset.setor} 
                    perfilInvestidor={asset.perfilInvestidor} 
                    recomendacao={asset.recomendacao} 
                    tendencia={asset.tendencia} 
                    taxaSemanal={asset.taxaSemanal} 
                    carteira={asset.carteira} 
                    nota={asset.nota_especialista} 
                    notaEspecialista={asset.nota_especialista} 
                    resumo={asset.resumo} 
                    valor={asset.valor} 
                    roi2026={asset.roi2026} 
                    roi2023a2025={asset.roi2023a2025} 
                    roitrim={asset.roitrim} 
                    roi2025={asset.roi2025} 
                    dy2025={asset.dy2025} 
                    roi24={asset.roi24} 
                    fatorMc={asset.fatorMc} 
                    userPlan={userPlan} 
                  />
                </div>
              ))}
            </div>

          {/* Pagination */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => setCurrentPage(1)} 
              disabled={currentPage === 1 || totalPages <= 1}
              className="hidden sm:flex"
            >
              Primeira
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
              disabled={currentPage === 1 || totalPages <= 1}
            >
              ◀ Anterior
            </Button>
            <div className="text-sm font-medium px-4 py-2 bg-muted rounded-md">
              Página {currentPage} de {totalPages}
            </div>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
              disabled={currentPage === totalPages || totalPages <= 1}
            >
              Próxima ▶
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => setCurrentPage(totalPages)} 
              disabled={currentPage === totalPages || totalPages <= 1}
              className="hidden sm:flex"
            >
              Última
            </Button>
          </div>
          </> : <div className="text-center py-12">
            <p className="text-muted-foreground">
              Nenhum ativo encontrado com os filtros selecionados. Tente outros critérios.
            </p>
          </div>}
        </div>
      </div>
    </AppLayout>;
};
export default MercadoApp;