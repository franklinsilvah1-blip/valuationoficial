import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TrackingScript {
  id: string;
  name: string;
  type: string;
  script_id: string | null;
  script_content: string | null;
  location: string;
  is_active: boolean;
}

// Scripts that are hardcoded in index.html - skip these
const HARDCODED_SCRIPT_TYPES = [
  "google_tag_manager",
  "google_analytics", 
  "facebook_pixel"
];

const TrackingScripts = () => {
  // Fetch active tracking scripts (only custom scripts)
  const { data: scripts } = useQuery({
    queryKey: ["tracking-scripts-custom"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tracking_scripts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching tracking scripts:", error);
        return [];
      }
      
      // Filter out scripts that are hardcoded in index.html
      return (data as TrackingScript[]).filter(
        script => !HARDCODED_SCRIPT_TYPES.includes(script.type)
      );
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Generate script content based on type (only for custom scripts now)
  const generateScriptContent = (script: TrackingScript): string | null => {
    if (script.type === "custom") {
      return script.script_content || null;
    }

    if (!script.script_id) return null;

    // Only Google Ads remains as dynamic injection
    if (script.type === "google_ads") {
      return `
        (function() {
          var gtagScript = document.createElement('script');
          gtagScript.async = true;
          gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=${script.script_id}';
          var firstScript = document.getElementsByTagName('script')[0];
          firstScript.parentNode.insertBefore(gtagScript, firstScript);
          
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${script.script_id}');
        })();
      `;
    }

    return null;
  };

  // Inject scripts into the DOM
  useEffect(() => {
    if (!scripts || scripts.length === 0) return;

    const injectedScripts: HTMLScriptElement[] = [];

    scripts.forEach((script) => {
      const content = generateScriptContent(script);
      if (!content) return;

      // Create script element
      const scriptElement = document.createElement("script");
      scriptElement.type = "text/javascript";
      scriptElement.setAttribute("data-tracking-id", script.id);
      scriptElement.text = content;

      // Inject based on location
      if (script.location === "head") {
        document.head.appendChild(scriptElement);
      } else if (script.location === "body_start") {
        if (document.body.firstChild) {
          document.body.insertBefore(scriptElement, document.body.firstChild);
        } else {
          document.body.appendChild(scriptElement);
        }
      } else if (script.location === "body_end") {
        document.body.appendChild(scriptElement);
      }

      injectedScripts.push(scriptElement);
    });

    // Cleanup function to remove scripts when component unmounts
    return () => {
      injectedScripts.forEach((script) => {
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      });
    };
  }, [scripts]);

  return null;
};

export default TrackingScripts;
