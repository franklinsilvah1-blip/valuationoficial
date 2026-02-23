import { useState, useCallback, ImgHTMLAttributes } from "react";

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'onLoad' | 'fetchPriority'> {
  src: string;
  alt: string;
  fallback?: string;
  lazy?: boolean;
  aspectRatio?: string;
  priority?: boolean;
}

/**
 * OptimizedImage - Componente de imagem otimizado com lazy-loading e fallback
 * 
 * @param src - URL da imagem
 * @param alt - Texto alternativo (obrigatório para acessibilidade)
 * @param fallback - URL de imagem de fallback (opcional)
 * @param lazy - Se true, usa lazy-loading (padrão: true)
 * @param aspectRatio - Aspect ratio para placeholder (ex: "16/9")
 * @param priority - Se true, carrega com alta prioridade (LCP)
 * @param width - Largura da imagem (importante para evitar CLS)
 * @param height - Altura da imagem (importante para evitar CLS)
 */
const OptimizedImage = ({
  src,
  alt,
  fallback = "/placeholder.svg",
  lazy = true,
  aspectRatio,
  priority = false,
  className = "",
  width,
  height,
  ...props
}: OptimizedImageProps) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const handleError = useCallback(() => {
    if (!hasError) {
      setHasError(true);
    }
  }, [hasError]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const imageSrc = hasError ? fallback : src;

  // Determine loading strategy
  const loadingStrategy = priority ? "eager" : (lazy ? "lazy" : "eager");
  
  return (
    <img
      src={imageSrc}
      alt={alt}
      loading={loadingStrategy}
      decoding={priority ? "sync" : "async"}
      // @ts-ignore - fetchPriority is valid but not in React types yet
      fetchpriority={priority ? "high" : "auto"}
      onError={handleError}
      onLoad={handleLoad}
      width={width}
      height={height}
      className={`${className} ${!isLoaded ? "animate-pulse bg-muted" : ""}`}
      style={{
        aspectRatio: aspectRatio,
        contentVisibility: lazy ? "auto" : "visible",
        ...props.style,
      }}
      {...props}
    />
  );
};

export default OptimizedImage;
