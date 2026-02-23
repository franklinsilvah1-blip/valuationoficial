import { Helmet } from "react-helmet";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
  keywords?: string[];
  noindex?: boolean;
  jsonLd?: object | object[];
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
}

const SITE_URL = "https://valuationit.com.br";
const SITE_NAME = "VALUATION Invest Tech";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@valuationit";

const SEOHead = ({
  title,
  description,
  canonical,
  ogImage,
  ogType = "website",
  keywords,
  noindex = false,
  jsonLd,
  publishedTime,
  modifiedTime,
  author,
}: SEOHeadProps) => {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const canonicalUrl = canonical || (typeof window !== "undefined" ? window.location.href : SITE_URL);
  const imageUrl = ogImage?.startsWith("http") ? ogImage : `${SITE_URL}${ogImage || "/og-image.png"}`;
  
  // Ensure description is within limits
  const safeDescription = description.length > 160 ? description.substring(0, 157) + "..." : description;

  const renderJsonLd = () => {
    if (!jsonLd) return null;
    
    const schemas = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    
    return schemas.map((schema, index) => (
      <script
        key={index}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    ));
  };

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={safeDescription} />
      {keywords && keywords.length > 0 && (
        <meta name="keywords" content={keywords.join(", ")} />
      )}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Canonical */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={safeDescription} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="pt_BR" />

      {/* Article specific */}
      {ogType === "article" && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {ogType === "article" && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {ogType === "article" && author && (
        <meta property="article:author" content={author} />
      )}

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={canonicalUrl} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={safeDescription} />
      <meta property="twitter:image" content={imageUrl} />
      <meta property="twitter:site" content={TWITTER_HANDLE} />

      {/* JSON-LD Structured Data */}
      {renderJsonLd()}
    </Helmet>
  );
};

export default SEOHead;

// Helper function to create WebPage schema (generic)
export const createWebPageSchema = (
  name: string,
  description: string,
  url: string,
  dateModified?: string
) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name,
  description,
  url,
  dateModified: dateModified || new Date().toISOString().split("T")[0],
  publisher: {
    "@type": "Organization",
    name: "VALUATION Invest Tech",
    url: "https://valuationit.com.br",
    logo: {
      "@type": "ImageObject",
      url: "https://valuationit.com.br/logo.webp",
    },
  },
});

// Helper function to create CollectionPage schema
export const createCollectionPageSchema = (
  name: string,
  description: string,
  url: string
) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name,
  description,
  url,
  publisher: {
    "@type": "Organization",
    name: "VALUATION Invest Tech",
    url: "https://valuationit.com.br",
    logo: {
      "@type": "ImageObject",
      url: "https://valuationit.com.br/logo.webp",
    },
  },
});

// Helper function to create Organization schema
export const createOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "VALUATION Invest Tech",
  alternateName: "ValuAtion",
  url: "https://valuationit.com.br",
  logo: "https://valuationit.com.br/logo.webp",
  description: "Consultoria de investimentos com análises profissionais de ações, FIIs, BDRs e criptomoedas da B3.",
  foundingDate: "2020",
  founder: {
    "@type": "Person",
    name: "Franklin Silvah",
    jobTitle: "Fundador e Líder Executivo",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+55-31-99328-7761",
    contactType: "customer service",
    email: "consultoria@valuationit.com.br",
    availableLanguage: "Portuguese",
  },
  sameAs: [
    "https://www.instagram.com/franklinsilvah/",
    "https://www.linkedin.com/in/franklinsilvah/",
    "https://www.youtube.com/@valuationit",
  ],
  address: {
    "@type": "PostalAddress",
    addressCountry: "BR",
    addressLocality: "Belo Horizonte",
    addressRegion: "MG",
  },
});

// Helper function to create WebSite schema
export const createWebSiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "VALUATION Invest Tech",
  url: "https://valuationit.com.br",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://valuationit.com.br/mercado?codigo={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
});

// Helper function to create FAQPage schema
export const createFAQSchema = (faqs: { question: string; answer: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
});

// Helper function to create Product schema for subscription plans
export const createProductSchema = (
  name: string,
  description: string,
  price: number,
  currency: string = "BRL"
) => ({
  "@context": "https://schema.org",
  "@type": "Product",
  name: `Plano ${name} - VALUATION Invest Tech`,
  description,
  brand: {
    "@type": "Brand",
    name: "VALUATION Invest Tech",
  },
  offers: {
    "@type": "Offer",
    price: price,
    priceCurrency: currency,
    priceValidUntil: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
    availability: "https://schema.org/InStock",
    url: "https://valuationit.com.br/assinatura",
  },
});

// Helper function to create Article schema
export const createArticleSchema = (
  title: string,
  description: string,
  imageUrl: string,
  authorName: string,
  publishedTime: string,
  modifiedTime?: string,
  url?: string
) => ({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: title,
  description,
  image: imageUrl,
  author: {
    "@type": "Person",
    name: authorName,
  },
  publisher: {
    "@type": "Organization",
    name: "VALUATION Invest Tech",
    logo: {
      "@type": "ImageObject",
      url: "https://valuationit.com.br/logo.webp",
    },
  },
  datePublished: publishedTime,
  dateModified: modifiedTime || publishedTime,
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": url || "https://valuationit.com.br/blog",
  },
});

// Helper function to create Service schema
export const createServiceSchema = (
  name: string,
  description: string,
  providerName: string = "VALUATION Invest Tech"
) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "Financial Consulting",
  name,
  description,
  provider: {
    "@type": "Organization",
    name: providerName,
    url: "https://valuationit.com.br",
  },
  areaServed: {
    "@type": "Country",
    name: "Brazil",
  },
});

// Helper function to create Person schema
export const createPersonSchema = (
  name: string,
  jobTitle: string,
  description: string,
  imageUrl?: string
) => ({
  "@context": "https://schema.org",
  "@type": "Person",
  name,
  jobTitle,
  description,
  image: imageUrl,
  worksFor: {
    "@type": "Organization",
    name: "VALUATION Invest Tech",
  },
});

// Helper function to create BreadcrumbList schema
export const createBreadcrumbSchema = (
  items: { name: string; url: string }[]
) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});

// Helper function to create LocalBusiness schema
export const createLocalBusinessSchema = () => ({
  "@context": "https://schema.org",
  "@type": "FinancialService",
  name: "VALUATION Invest Tech",
  alternateName: "ValuAtion",
  url: "https://valuationit.com.br",
  logo: "https://valuationit.com.br/logo.webp",
  image: "https://valuationit.com.br/og-image.png",
  description: "Consultoria de investimentos com análises profissionais de ações, FIIs, BDRs e criptomoedas da B3.",
  telephone: "+55-31-99328-7761",
  email: "consultoria@valuationit.com.br",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Belo Horizonte",
    addressRegion: "MG",
    addressCountry: "BR",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: -19.9191,
    longitude: -43.9386,
  },
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "09:00",
    closes: "18:00",
  },
  priceRange: "$$",
  currenciesAccepted: "BRL",
  paymentAccepted: "Credit Card, PIX",
  areaServed: {
    "@type": "Country",
    name: "Brazil",
  },
  sameAs: [
    "https://www.instagram.com/franklinsilvah/",
    "https://www.linkedin.com/in/franklinsilvah/",
    "https://www.youtube.com/@valuationit",
  ],
});

// Helper function to create AggregateRating schema
export const createAggregateRatingSchema = (
  ratingValue: number = 4.9,
  reviewCount: number = 5000,
  bestRating: number = 5
) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "VALUATION Invest Tech",
  url: "https://valuationit.com.br",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: ratingValue,
    bestRating: bestRating,
    worstRating: 1,
    ratingCount: reviewCount,
    reviewCount: reviewCount,
  },
});

// Helper function to create FinancialService schema
export const createFinancialServiceSchema = (
  serviceName: string,
  description: string,
  offers?: { price: number; priceCurrency: string }[]
) => ({
  "@context": "https://schema.org",
  "@type": "FinancialService",
  name: serviceName,
  description: description,
  provider: {
    "@type": "Organization",
    name: "VALUATION Invest Tech",
    url: "https://valuationit.com.br",
  },
  areaServed: {
    "@type": "Country",
    name: "Brazil",
  },
  serviceType: "Investment Consulting",
  termsOfService: "https://valuationit.com.br/termos",
  ...(offers && {
    offers: offers.map((offer) => ({
      "@type": "Offer",
      price: offer.price,
      priceCurrency: offer.priceCurrency,
      availability: "https://schema.org/InStock",
    })),
  }),
});

// Helper function to create ItemList schema for assets
export const createItemListSchema = (
  items: { name: string; url: string; position: number }[],
  listName: string = "Ativos do Mercado"
) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: listName,
  numberOfItems: items.length,
  itemListElement: items.map((item) => ({
    "@type": "ListItem",
    position: item.position,
    name: item.name,
    url: item.url,
  })),
});

// Helper function to create SoftwareApplication schema
export const createSoftwareApplicationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "VALUATION Invest Tech",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: 0,
    highPrice: 199,
    priceCurrency: "BRL",
    offerCount: 5,
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: 4.9,
    ratingCount: 5000,
    bestRating: 5,
    worstRating: 1,
  },
  featureList: [
    "Análises profissionais de ativos",
    "Carteiras recomendadas personalizadas",
    "Recomendações de especialistas",
    "Acompanhamento em tempo real",
    "Simulador de carteira",
  ],
});

// Helper function to create Review schema with AggregateRating for testimonials
export const createReviewSchema = (
  reviews: { author: string; reviewBody: string; rating: number }[],
  ratingValue: number = 4.9,
  reviewCount: number = 5000
) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "VALUATION Invest Tech",
  url: "https://valuationit.com.br",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: ratingValue,
    bestRating: 5,
    worstRating: 1,
    ratingCount: reviewCount,
    reviewCount: reviewCount,
  },
  review: reviews.map((review) => ({
    "@type": "Review",
    author: {
      "@type": "Person",
      name: review.author,
    },
    reviewBody: review.reviewBody,
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
    itemReviewed: {
      "@type": "Organization",
      name: "VALUATION Invest Tech",
      url: "https://valuationit.com.br",
    },
  })),
});

// Helper function to create ContactPage schema
export const createContactPageSchema = (
  email: string = "consultoria@valuationit.com.br",
  telephone: string = "+55-31-99328-7761"
) => ({
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contato - VALUATION Invest Tech",
  description: "Entre em contato com a equipe VALUATION Invest Tech",
  url: "https://valuationit.com.br/contato",
  mainEntity: {
    "@type": "Organization",
    name: "VALUATION Invest Tech",
    email: email,
    telephone: telephone,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: telephone,
      contactType: "customer service",
      email: email,
      availableLanguage: "Portuguese",
    },
  },
});

// Helper function to create HowTo schema
export const createHowToSchema = (
  name: string,
  description: string,
  steps: { name: string; text: string; image?: string }[],
  totalTime?: string
) => ({
  "@context": "https://schema.org",
  "@type": "HowTo",
  name,
  description,
  ...(totalTime && { totalTime }),
  step: steps.map((step, index) => ({
    "@type": "HowToStep",
    position: index + 1,
    name: step.name,
    text: step.text,
    ...(step.image && { image: step.image }),
  })),
});

// Helper function to create SiteNavigationElement schema
export const createSiteNavigationElementSchema = (
  navItems: { name: string; url: string }[]
) => ({
  "@context": "https://schema.org",
  "@type": "SiteNavigationElement",
  name: "Main Navigation",
  hasPart: navItems.map((item) => ({
    "@type": "WebPage",
    name: item.name,
    url: item.url,
  })),
});

// Helper function to create DataFeed schema for asset lists
export const createDataFeedSchema = (
  name: string,
  description: string,
  dataItems: { name: string; identifier: string; description?: string }[],
  dateModified?: string
) => ({
  "@context": "https://schema.org",
  "@type": "DataFeed",
  name,
  description,
  dateModified: dateModified || new Date().toISOString(),
  dataFeedElement: dataItems.map((item) => ({
    "@type": "DataFeedItem",
    item: {
      "@type": "FinancialProduct",
      name: item.name,
      identifier: item.identifier,
      ...(item.description && { description: item.description }),
    },
  })),
});

// Helper function to create Speakable schema for voice search
export const createSpeakableSchema = (
  url: string,
  cssSelectors: string[]
) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  url,
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: cssSelectors,
  },
});
