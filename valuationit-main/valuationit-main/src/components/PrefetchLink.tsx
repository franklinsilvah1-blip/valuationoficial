import { Link, LinkProps } from "react-router-dom";
import { usePrefetch } from "./ResourceHints";
import { useCallback, useState } from "react";

interface PrefetchLinkProps extends LinkProps {
  prefetchOnHover?: boolean;
  prefetchDelay?: number;
}

/**
 * PrefetchLink - Link com prefetch automático no hover
 * 
 * Melhora a performance percebida ao pré-carregar a rota
 * quando o usuário passa o mouse sobre o link.
 */
const PrefetchLink = ({ 
  prefetchOnHover = true, 
  prefetchDelay = 100,
  to,
  children,
  onMouseEnter,
  ...props 
}: PrefetchLinkProps) => {
  const { prefetchRoute } = usePrefetch();
  const [hasPrefetched, setHasPrefetched] = useState(false);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (prefetchOnHover && !hasPrefetched && typeof to === 'string') {
      // Delay para evitar prefetch em hover acidental
      const timeoutId = setTimeout(() => {
        prefetchRoute(to);
        setHasPrefetched(true);
      }, prefetchDelay);

      // Limpar timeout se o mouse sair antes do delay
      const target = e.currentTarget;
      const handleMouseLeave = () => {
        clearTimeout(timeoutId);
        target.removeEventListener('mouseleave', handleMouseLeave);
      };
      target.addEventListener('mouseleave', handleMouseLeave);
    }

    // Chamar o onMouseEnter original se existir
    onMouseEnter?.(e);
  }, [prefetchOnHover, hasPrefetched, to, prefetchDelay, prefetchRoute, onMouseEnter]);

  return (
    <Link 
      to={to} 
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {children}
    </Link>
  );
};

export default PrefetchLink;
