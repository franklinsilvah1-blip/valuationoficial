import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchFilters from "@/components/SearchFilters";
import SEOHead, { createBreadcrumbSchema, createSpeakableSchema } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { AssetsTable } from "@/components/AssetsTable";
import { PUBLIC_ASSET_COLUMNS } from "@/utils/assetsTableColumns";
import { usePublicMarketAssets } from "@/hooks/usePublicMarketAssets";
import { useAuth } from "@/contexts/AuthContext";
import { getMarketLevel } from "@/utils/marketAccess";

const Mercado = () => {
  const navigate = useNavigate();
  const { user, userPlan } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");

  // Mantém o campo de busca sincronizado se a URL mudar externamente
  // (ex.: usuário chega direto num link /mercado?q=PETR4 ou dá refresh).
  useEffect(() => {
    setSearchTerm(searchParams.get("q") ?? "");
  }, [searchParams]);

  const activeSearch = searchParams.get("q") ?? "";

  // Sem termo de busca, a RPC devolve exatamente o mesmo Top 20 da home
  // (get_top_assets_year no Postgres — uma só definição de "20 ativos com
  // maior ROI 2026" para as duas telas). Com termo, devolve o resultado da
  // busca nas mesmas 4 colunas. O visitante não recebe mais nada: as views
  // completas deixaram de ter GRANT para `anon`, então não há como paginar a
  // base inteira por fora desta RPC.
  const { data: assets = [], isLoading, error } = usePublicMarketAssets(activeSearch);

  const marketLevel = getMarketLevel(userPlan, !!user);

  const handleSearch = (term: string) => {
    const trimmed = term.trim();
    if (trimmed) {
      setSearchParams({ q: trimmed });
    } else {
      setSearchParams({});
    }
  };

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "https://valuationit.com.br/" },
    { name: "Mercado", url: "https://valuationit.com.br/mercado" },
  ]);

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
          "investimentos Brasil",
        ]}
        ogImage="https://valuationit.com.br/og-image.png"
        jsonLd={[breadcrumbSchema, speakableSchema].filter(Boolean)}
      />

      <Navbar />

      <main className="container py-12">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Mercado</h1>
          <p className="text-muted-foreground max-w-3xl">
            Encontre e compare os melhores ativos globais recomendados pelos nossos especialistas de investimentos
          </p>
        </header>

        <div className="mb-8">
          <SearchFilters
            onSearch={(filters: any) => handleSearch(filters?.codigo ?? "")}
            initialValue={searchTerm}
          />
        </div>

        {!activeSearch && (
          <h2 className="text-xl md:text-2xl font-bold mb-4">Melhores ativos do ano</h2>
        )}

        <AssetsTable
          columns={PUBLIC_ASSET_COLUMNS}
          rows={assets}
          isLoading={isLoading}
          error={error}
          marketLevel={marketLevel}
          emptyMessage="Nenhum ativo encontrado para essa busca."
        />

        {user ? (
          <div className="mt-10 text-center border-t border-border pt-8">
            <p className="text-muted-foreground mb-4">
              Você já tem conta. Acesse o Mercado Avançado para ver todos os ativos, filtros e indicadores.
            </p>
            <Button size="lg" onClick={() => navigate("/app/mercado")}>
              Ir para o Mercado Avançado
            </Button>
          </div>
        ) : (
          <div className="mt-10 text-center border-t border-border pt-8">
            <p className="text-muted-foreground mb-4">
              Cadastre-se gratuitamente para ver a lista completa de ativos e indicadores básicos.
              Assine o PRO para liberar ROI TRIM, carteira, recomendação e nota do especialista.
            </p>
            <Button size="lg" onClick={() => navigate("/auth?mode=signup")}>
              Criar conta grátis
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Mercado;
