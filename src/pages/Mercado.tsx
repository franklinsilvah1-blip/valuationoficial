import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchFilters from "@/components/SearchFilters";
import AssetCard from "@/components/AssetCard";
import SEOHead, { createBreadcrumbSchema, createItemListSchema, createDataFeedSchema, createSpeakableSchema } from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const Mercado = () => {
  const { userPlan, loading } = useAuth();
  const [filters, setFilters] = useState({
    codigo: "",
    tipo: "all",
    setor: "all"
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Query para contar total de itens
  const { data: totalCount } = useQuery({
    queryKey: ["assets-count", filters],
    queryFn: async () => {
      let query = supabase.from("assets").select("*", {
        count: "exact",
        head: true
      });
      if (filters.codigo) {
        query = query.or(`codigo_b3.ilike.%${filters.codigo}%,nome.ilike.%${filters.codigo}%`);
      }
      if (filters.tipo && filters.tipo !== "all") {
        query = query.eq("tipo", filters.tipo.toUpperCase() as any);
      }
      if (filters.setor && filters.setor !== "all") {
        query = query.eq("setor", filters.setor);
      }
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    }
  });

  const totalPages = Math.ceil((totalCount || 0) / itemsPerPage);

  const { data: assets, isLoading, isFetching } = useQuery({
    queryKey: ["assets", filters, currentPage],
    queryFn: async () => {
      let query = supabase.from("assets").select(`
          *,
          asset_analyses(*)
        `);
      if (filters.codigo) {
        query = query.or(`codigo_b3.ilike.%${filters.codigo}%,nome.ilike.%${filters.codigo}%`);
      }
      if (filters.tipo && filters.tipo !== "all") {
        query = query.eq("tipo", filters.tipo.toUpperCase() as any);
      }
      if (filters.setor && filters.setor !== "all") {
        query = query.eq("setor", filters.setor);
      }
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      const { data, error } = await query.order("codigo_b3").range(from, to);
      if (error) throw error;
      return data?.map((asset: any) => {
        const analysis = Array.isArray(asset.asset_analyses) 
          ? asset.asset_analyses[0] 
          : asset.asset_analyses || {};
        
        return {
          ...asset,
          analysis
        };
      });
    }
  });

  const handleSearch = (newFilters: any) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
    setCurrentPage(1);
  };

  const removeFilter = (filterKey: string) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: filterKey === "codigo" ? "" : "all"
    }));
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setFilters({
      codigo: "",
      tipo: "all",
      setor: "all"
    });
    setCurrentPage(1);
  };

  const getFilterLabel = (key: string, value: string): string => {
    if (value === "all" || value === "") return "";
    const labels: Record<string, Record<string, string>> = {
      tipo: {
        ACAO: "Ação",
        BDR: "BDR",
        CRIPTO: "Cripto",
        ETF: "ETF",
        FII: "FII",
        INDICE: "Índice"
      }
    };
    return labels[key]?.[value] || value;
  };

  const activeFilters = Object.entries(filters).filter(([key, value]) => {
    if (key === "codigo") return value !== "";
    return value !== "all";
  }).map(([key, value]) => ({
    key,
    value,
    label: key === "codigo" ? `Código: ${value}` : getFilterLabel(key, value)
  }));

  const hasActiveFilters = activeFilters.length > 0;

  // Breadcrumb schema
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "https://valuationit.com.br/" },
    { name: "Mercado", url: "https://valuationit.com.br/mercado" },
  ]);

  // ItemList schema for assets (first 10 items for SEO)
  const itemListSchema = assets && assets.length > 0 
    ? createItemListSchema(
        assets.slice(0, 10).map((asset: any, index: number) => ({
          name: `${asset.codigo_b3} - ${asset.nome}`,
          url: `https://valuationit.com.br/mercado?codigo=${asset.codigo_b3}`,
          position: index + 1,
        })),
        "Ativos do Mercado Brasileiro"
      )
    : null;

  // DataFeed schema for assets table
  const dataFeedSchema = assets && assets.length > 0
    ? createDataFeedSchema(
        "Ativos Financeiros do Mercado Brasileiro",
        "Lista de ações, FIIs, BDRs, ETFs e criptomoedas com análises da VALUATION Invest Tech",
        assets.slice(0, 20).map((asset: any) => ({
          name: `${asset.codigo_b3} - ${asset.nome}`,
          identifier: asset.codigo_b3,
          description: `${asset.tipo} - ${asset.setor || "Diversos"}`,
        }))
      )
    : null;

  // Speakable schema for voice search
  const speakableSchema = createSpeakableSchema("https://valuationit.com.br/mercado", [
    "h1",
    "header p",
  ]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mercado de Ações, FIIs e BDRs - Análises Profissionais"
        description="Explore ativos da B3 com análises profissionais. Pesquise ações, FIIs, BDRs, ETFs e criptomoedas. Acesse recomendações de especialistas e carteiras personalizadas."
        canonical="https://valuationit.com.br/mercado"
        keywords={[
          "mercado de ações",
          "ações B3",
          "FIIs",
          "fundos imobiliários",
          "BDRs",
          "ETFs",
          "criptomoedas",
          "análise de ativos",
          "investimentos Brasil"
        ]}
        ogImage="https://valuationit.com.br/og-image.png"
        jsonLd={[breadcrumbSchema, itemListSchema, dataFeedSchema, speakableSchema].filter(Boolean)}
      />

      <Navbar />

      <main className="container py-12">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Mercado</h1>
          <p className="text-muted-foreground">
            Explore ativos globais do mercado. Busca gratuita com análises básicas.
          </p>
        </header>

        <div className="mb-8 space-y-4">
          <SearchFilters onSearch={handleSearch} />
          
          {/* Active Filters Badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/50 rounded-lg border border-border">
              <span className="text-sm font-medium text-muted-foreground mr-2">
                Filtros ativos:
              </span>
              {activeFilters.map(({ key, value, label }) => (
                <Badge 
                  key={`${key}-${value}`} 
                  variant="secondary" 
                  className="gap-1 pr-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                >
                  {label}
                  <button 
                    onClick={() => removeFilter(key)} 
                    className="ml-1 rounded-full hover:bg-background/80 p-0.5 transition-colors" 
                    aria-label={`Remover filtro ${label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {activeFilters.length > 1 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-7 text-xs">
                  Limpar todos
                </Button>
              )}
            </div>
          )}
        </div>

        {loading || isLoading || userPlan === null ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : assets && assets.length > 0 ? (
          <>
            {/* Results Counter */}
            {!isLoading && totalCount !== undefined && (
              <div className="mb-6 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{totalCount}</span> resultado{totalCount !== 1 ? 's' : ''} encontrado{totalCount !== 1 ? 's' : ''}
                  {totalPages > 1 && (
                    <span className="ml-2">
                      • Página <span className="font-medium text-foreground">{currentPage}</span> de <span className="font-medium text-foreground">{totalPages}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {assets.map((asset: any) => {
                const analysis = asset.analysis || {};
                const showLimitedInfo = userPlan === "FREE" || userPlan === null;
                
                return (
                  <AssetCard
                    key={asset.id} 
                    assetId={asset.id} 
                    codigo={asset.codigo_b3} 
                    nome={asset.nome} 
                    tipo={asset.tipo} 
                    setor={asset.setor} 
                    perfilInvestidor={analysis.perfil_investidor}
                    recomendacao={analysis.recomendacao}
                    tendencia={analysis.tendencia} 
                    taxaSemanal={analysis.taxa_semanal} 
                    valor={analysis.valor} 
                    roi2026={analysis.roi2026}
                    roi2023a2025={analysis.roi2023a2025}
                    roi2025={analysis.roi2025}
                    dy2025={analysis.dy2025}
                    roi24={analysis.roi2024}
                    roitrim={analysis.roitrim}
                    fatorMc={analysis.fator_mc} 
                    carteira={analysis.carteira}
                    notaEspecialista={analysis.nota_especialista}
                    userPlan={userPlan || "FREE"}
                  />
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Paginação">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <div className="text-sm text-muted-foreground px-4">
                  Página {currentPage} de {totalPages}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                  disabled={currentPage === totalPages}
                >
                  Próximo
                </Button>
              </nav>
            )}

            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Faça o cadastro gratuito para acessar informações básicas do mercado. Para análises completas e recomendações assine um dos nossos planos!
              </p>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum ativo encontrado. Tente outros filtros.</p>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default Mercado;
