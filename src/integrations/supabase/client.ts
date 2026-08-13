import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Lê exclusivamente das variáveis de ambiente — sem fallback hardcoded para
// nenhuma URL/chave. Um fallback para produção faria um ambiente mal
// configurado (.env ausente/incompleto) apontar silenciosamente para dados
// reais. Falha rápido e explicitamente em vez disso; a mensagem nunca inclui
// o valor das variáveis (não expõe secrets no log/console).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Supabase environment variables are not configured. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em .env ou .env.local."
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});