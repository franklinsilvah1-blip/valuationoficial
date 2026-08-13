import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchFilters from "@/components/SearchFilters";
import SEOHead, { createBreadcrumbSchema, createSpeakableSchema } from "@/components/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AssetsTable } from "@/components/AssetsTable";
import { PUBLIC_ASSET_COLUMNS } from "@/utils/assetsTableColumns";

const Mercado = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");

  // Mantém o campo de busca sincronizado se a URL mudar externamente
  // (ex.: usuário chega direto num link /mercado?q=PETR4 ou dá refresh).
  useEffect(() => {
    setSearchTerm(searchParams.get("q") ?? "");
  }, [searchParams]);

  const activeSearch = searchParams.get("q") ?? "";

  const { data: assets, isLoading, error } = useQuery({
    queryKey: ["public-assets", activeSearch],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_assets", {
        p_search: activeSearch || null,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

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
          <p className="text-muted-foreground">
            {activeSearch
              ? `Resultado da busca por "${activeSearch}"`
              : "Os 20 primeiros ativos do nosso catálogo. Pesquise um ativo específico ou cadastre-se para ver a lista completa."}
          </p>
        </header>

        <div className="mb-8">
          <SearchFilters
            onSearch={(filters: any) => handleSearch(filters?.codigo ?? "")}
            initialValue={searchTerm}
          />
        </div>

        <AssetsTable
          columns={PUBLIC_ASSET_COLUMNS}
          rows={(assets ?? []).map((a: any) => ({ ...a, id: a.id }))}
          isLoading={isLoading}
          error={error}
          emptyMessage="Nenhum ativo encontrado para essa busca."
        />

        <div className="mt-10 text-center border-t border-border pt-8">
          <p className="text-muted-foreground mb-4">
            Cadastre-se gratuitamente para ver a lista completa de ativos e indicadores básicos.
            Assine o PRO para liberar tendência, carteira, recomendação e nota do especialista.
          </p>
          <Button size="lg" onClick={() => navigate("/auth?mode=signup")}>
            Criar conta grátis
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Mercado;
