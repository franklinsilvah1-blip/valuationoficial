import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { Helmet } from "react-helmet";

export interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

const SITE_URL = "https://valuationinvesttech.com";

export const generateBreadcrumbSchema = (items: BreadcrumbItem[]) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.href ? `${SITE_URL}${item.href}` : undefined,
    })),
  };
};

const Breadcrumbs = ({ items, className = "" }: BreadcrumbsProps) => {
  const schema = generateBreadcrumbSchema(items);

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>
      
      <nav 
        aria-label="Breadcrumb" 
        className={`flex items-center text-sm text-muted-foreground ${className}`}
      >
        <ol className="flex items-center flex-wrap gap-1">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            
            return (
              <li key={index} className="flex items-center">
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 mx-1 flex-shrink-0" />
                )}
                
                {index === 0 && (
                  <Home className="h-4 w-4 mr-1 flex-shrink-0" />
                )}
                
                {isLast || !item.href ? (
                  <span 
                    className={isLast ? "text-foreground font-medium truncate max-w-[200px] md:max-w-[300px]" : ""}
                    title={item.name}
                  >
                    {item.name}
                  </span>
                ) : (
                  <Link 
                    to={item.href} 
                    className="hover:text-primary transition-colors"
                  >
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
};

export default Breadcrumbs;
