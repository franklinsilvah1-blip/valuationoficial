import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ResourceHints - Componente para adicionar preload/prefetch baseado na rota atual
 * 
 * Estratégia:
 * - Homepage: prefetch das rotas mais acessadas (assinatura, mercado, auth)
 * - Assinatura: prefetch de auth (próximo passo do funil)
 * - Mercado: prefetch de auth e assinatura
 * - Auth: prefetch de dashboard (após login)
 */

// Mapa de rotas para suas próximas rotas prováveis
const ROUTE_PREFETCH_MAP: Record<string, string[]> = {
  "/": ["/assinatura", "/mercado", "/auth", "/blog"],
  "/mercado": ["/auth", "/assinatura"],
  "/assinatura": ["/auth"],
  "/blog": ["/assinatura", "/consultoria"],
  "/consultoria": ["/assinatura", "/contato"],
  "/auth": ["/app/dashboard", "/app/mercado"],
};

// Assets críticos para preload por rota
const ROUTE_PRELOAD_ASSETS: Record<string, { href: string; as: string; type?: string }[]> = {
  "/": [
    // Hero background já é importado pelo Vite, mas podemos preconectar à CDN de imagens
  ],
};

const ResourceHints = () => {
  const location = useLocation();

  useEffect(() => {
    // Limpar hints anteriores
    const existingHints = document.querySelectorAll('link[data-resource-hint]');
    existingHints.forEach(hint => hint.remove());

    const currentPath = location.pathname;
    
    // Adicionar prefetch para rotas prováveis
    const routesToPrefetch = ROUTE_PREFETCH_MAP[currentPath] || [];
    
    routesToPrefetch.forEach(route => {
      // Verificar se já existe
      if (!document.querySelector(`link[rel="prefetch"][href="${route}"]`)) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        link.setAttribute('data-resource-hint', 'true');
        document.head.appendChild(link);
      }
    });

    // Adicionar preload de assets críticos para a rota
    const assetsToPreload = ROUTE_PRELOAD_ASSETS[currentPath] || [];
    
    assetsToPreload.forEach(asset => {
      if (!document.querySelector(`link[rel="preload"][href="${asset.href}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = asset.href;
        link.as = asset.as;
        if (asset.type) {
          link.type = asset.type;
        }
        link.setAttribute('data-resource-hint', 'true');
        document.head.appendChild(link);
      }
    });

    // Preconnect para APIs externas usadas na rota
    const preconnectOrigins = [
      'https://yoazkdmzjibogpxkjseh.supabase.co', // Supabase API
    ];

    preconnectOrigins.forEach(origin => {
      if (!document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        link.setAttribute('data-resource-hint', 'true');
        document.head.appendChild(link);
      }
    });

  }, [location.pathname]);

  return null; // Componente não renderiza nada visualmente
};

export default ResourceHints;

/**
 * Hook para prefetch manual de rotas
 * Útil para prefetch on hover em links
 */
export const usePrefetch = () => {
  const prefetchRoute = (route: string) => {
    if (!document.querySelector(`link[rel="prefetch"][href="${route}"]`)) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = route;
      document.head.appendChild(link);
    }
  };

  const preloadAsset = (href: string, as: string, type?: string) => {
    if (!document.querySelector(`link[rel="preload"][href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = href;
      link.as = as;
      if (type) {
        link.type = type;
      }
      document.head.appendChild(link);
    }
  };

  return { prefetchRoute, preloadAsset };
};
