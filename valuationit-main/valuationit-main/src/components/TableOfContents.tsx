import { useMemo, useState, useEffect } from "react";
import { List } from "lucide-react";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
  minHeadings?: number;
}

const TableOfContents = ({ content, minHeadings = 3 }: TableOfContentsProps) => {
  const [activeId, setActiveId] = useState<string>("");

  const headings = useMemo(() => {
    if (!content) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");
    const elements = doc.querySelectorAll("h2, h3");
    
    const items: TocItem[] = [];
    elements.forEach((el, index) => {
      const text = el.textContent?.trim() || "";
      if (text) {
        const id = `heading-${index}`;
        items.push({
          id,
          text,
          level: parseInt(el.tagName.charAt(1)),
        });
      }
    });

    return items;
  }, [content]);

  // Add IDs to actual headings in the DOM
  useEffect(() => {
    const articleContent = document.querySelector(".prose");
    if (!articleContent) return;

    const elements = articleContent.querySelectorAll("h2, h3");
    elements.forEach((el, index) => {
      el.id = `heading-${index}`;
    });
  }, [content]);

  // Track active heading on scroll
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -80% 0px" }
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [headings]);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  if (headings.length < minHeadings) return null;

  return (
    <nav className="bg-muted/50 rounded-lg p-4 mb-8 border">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-foreground">
        <List className="h-4 w-4" />
        <span>Índice do Artigo</span>
      </div>
      <ul className="space-y-1">
        {headings.map((heading) => (
          <li key={heading.id}>
            <button
              onClick={() => handleClick(heading.id)}
              className={cn(
                "text-left w-full text-sm py-1 px-2 rounded transition-colors hover:bg-muted",
                heading.level === 3 && "pl-6",
                activeId === heading.id
                  ? "text-primary font-medium bg-primary/10"
                  : "text-muted-foreground"
              )}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default TableOfContents;
