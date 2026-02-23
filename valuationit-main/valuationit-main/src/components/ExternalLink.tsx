import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ExternalLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
  noFollow?: boolean;
  className?: string;
}

/**
 * ExternalLink component with proper SEO attributes
 * Automatically adds rel="noopener noreferrer nofollow" for external links
 * to prevent link juice leakage and security issues
 */
const ExternalLink = forwardRef<HTMLAnchorElement, ExternalLinkProps>(
  ({ href, children, noFollow = true, className, ...props }, ref) => {
    const relValue = noFollow
      ? "noopener noreferrer nofollow"
      : "noopener noreferrer";

    return (
      <a
        ref={ref}
        href={href}
        target="_blank"
        rel={relValue}
        className={cn("transition-colors", className)}
        {...props}
      >
        {children}
      </a>
    );
  }
);

ExternalLink.displayName = "ExternalLink";

export default ExternalLink;
