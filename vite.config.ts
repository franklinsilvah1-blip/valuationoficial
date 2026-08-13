import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Libera Supabase local (127.0.0.1:54321) no connect-src do CSP apenas no
// dev server (`apply: "serve"` — nunca roda em `vite build`), para permitir
// apontar o app para um Supabase local via VITE_SUPABASE_URL sem precisar
// editar o CSP de produção manualmente a cada teste local. O build de
// produção usa o CSP de index.html tal como está escrito, sem esta
// permissão adicional.
function localSupabaseCspDevPlugin(): Plugin {
  return {
    name: "local-supabase-csp-dev-only",
    apply: "serve",
    transformIndexHtml(html) {
      return html.replace(
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321 https://*.supabase.co wss://*.supabase.co"
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger(), mode === "development" && localSupabaseCspDevPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
