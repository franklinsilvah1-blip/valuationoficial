import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://supabaseapi.atendeflow.com.br';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcxNzI5MjAwLCJleHAiOjE5Mjk0OTU2MDB9.X4rfqmPuLQNqZ_eFb1PBYluNcMwkqND6g8WqEdHi0nM';

export const supabaseExternal = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'atendeflow-auth',
  },
});
