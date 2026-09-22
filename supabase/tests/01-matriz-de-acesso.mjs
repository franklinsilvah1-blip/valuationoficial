// Executa a lógica real das migrations num Postgres de verdade (PGlite/WASM)
// e valida a MATRIZ DE NEGÓCIO caso a caso.
//
// Stubs mínimos para o que é do Supabase (auth.uid, has_role, profiles,
// app_role), de modo que as funções da migration rodem sem alteração.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Caminhos relativos a este arquivo, para o teste rodar de qualquer cwd.
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const MIG = here('../migrations/');


const db = await new PGlite();

// ---------------------------------------------------------------- scaffolding
await db.exec(`
CREATE SCHEMA IF NOT EXISTS auth;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE TYPE app_role AS ENUM ('admin','user','editor','moderator');

-- "sessão" simulada: quem está logado agora
CREATE TABLE public._session (uid uuid);
INSERT INTO public._session VALUES (NULL);

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT uid FROM public._session LIMIT 1 $$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  plan text,
  plan_end_at text,
  is_admin boolean DEFAULT false
);

CREATE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT coalesce((SELECT is_admin FROM public.profiles WHERE id=_user_id), false)
     AND _role = 'admin' $$;

-- herdadas da migration 20260415120000
CREATE FUNCTION public.safe_parse_timestamptz(p_value text)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $f$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN RETURN NULL; END IF;
  RETURN p_value::timestamptz;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $f$;

CREATE FUNCTION public.normalize_plan_code(p_plan text)
RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT CASE upper(coalesce(p_plan,'START'))
    WHEN 'FREE' THEN 'START' WHEN 'TESTE' THEN 'PRO'
    WHEN 'FALE_C_ESPECIALISTA' THEN 'SPECIALIST'
    WHEN 'START' THEN 'START' WHEN 'PRO' THEN 'PRO'
    WHEN 'SPECIALIST' THEN 'SPECIALIST' WHEN 'WEALTH' THEN 'WEALTH'
    ELSE 'START' END;
$f$;

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_b3 text UNIQUE NOT NULL, nome text, tipo text, setor text,
  is_active boolean DEFAULT true
);
CREATE TABLE public.asset_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.assets(id),
  valor text, roi2026 text, roi2025 text, roi2024 text, roitrim text,
  dy2025 text, fator_mc text, roi2023a2025 text, perfil_investidor text,
  taxa_semanal text, resumo text, tendencia text, carteira text,
  recomendacao text, nota_especialista text, updated_at timestamptz DEFAULT now()
);

-- view "anterior" com a MESMA ordem de colunas de produção (o preflight confere)
CREATE VIEW public.asset_analyses_gated AS
SELECT aa.id, aa.asset_id, aa.valor, aa.roi2026, aa.roi2025, aa.roi2024,
       aa.roitrim, aa.dy2025, aa.fator_mc, aa.roi2023a2025, aa.perfil_investidor,
       aa.taxa_semanal, aa.resumo, aa.tendencia, aa.carteira, aa.recomendacao,
       aa.nota_especialista, aa.updated_at
FROM public.asset_analyses aa;

CREATE VIEW public.assets_market_view AS
SELECT a.*, g.perfil_investidor, g.recomendacao, g.tendencia,
       g.taxa_semanal AS analysis_taxa_semanal, g.roi2026, g.carteira,
       g.nota_especialista, g.valor, g.roitrim, g.roi2025, g.dy2025,
       g.roi2024, g.fator_mc, g.roi2023a2025, g.resumo
FROM public.assets a JOIN public.asset_analyses_gated g ON g.asset_id = a.id;

CREATE FUNCTION public.get_public_assets(p_search text DEFAULT NULL)
RETURNS TABLE(id uuid, codigo_b3 text) LANGUAGE sql STABLE AS $f$ SELECT a.id, a.codigo_b3 FROM public.assets a $f$;
`);

// ------------------------------------------------------------------- seed data
// 30 ativos: ROI 2026 decrescente de 300 a 10, perfis alternados.
const perfis = ['START', 'PRO', 'SPECIALIST'];
let seed = '';
for (let i = 0; i < 30; i++) {
  const roi = 300 - i * 10;
  const perfil = perfis[i % 3];
  const cod = `TST${String(i).padStart(2, '0')}`;
  seed += `
INSERT INTO public.assets (codigo_b3, nome, tipo) VALUES ('${cod}','NOME ${cod} PETROLEO','ACAO');
INSERT INTO public.asset_analyses (asset_id, roi2026, perfil_investidor, taxa_semanal, roitrim,
       tendencia, carteira, recomendacao, nota_especialista)
SELECT id, '${roi}', '${perfil}', 'R${i}', 'T${i}', 'ALTA', 'CART${i}', 'COMPRA', 'TOP ANO'
FROM public.assets WHERE codigo_b3='${cod}';`;
}
// um ativo com ROI ilegível (não deve entrar no ranking) e um inativo
seed += `
INSERT INTO public.assets (codigo_b3, nome, tipo) VALUES ('BADROI','LIXO','ACAO');
INSERT INTO public.asset_analyses (asset_id, roi2026, perfil_investidor, taxa_semanal, roitrim, tendencia, carteira, recomendacao, nota_especialista)
SELECT id,'--','START','R','T','ALTA','C','COMPRA','TOP ANO' FROM public.assets WHERE codigo_b3='BADROI';
INSERT INTO public.assets (codigo_b3, nome, tipo, is_active) VALUES ('INATIVO','OFF','ACAO', false);
INSERT INTO public.asset_analyses (asset_id, roi2026, perfil_investidor, taxa_semanal, roitrim, tendencia, carteira, recomendacao, nota_especialista)
SELECT id,'9999','START','R','T','ALTA','C','COMPRA','TOP ANO' FROM public.assets WHERE codigo_b3='INATIVO';
`;
await db.exec(seed);

// usuários
const USERS = {
  start:      { plan: 'START',      end: null, admin: false },
  pro:        { plan: 'PRO',        end: null, admin: false },
  specialist: { plan: 'SPECIALIST', end: null, admin: false },
  wealth:     { plan: 'WEALTH',     end: null, admin: false },
  admin:      { plan: 'START',      end: null, admin: true  },
  proExpired: { plan: 'PRO',        end: '2020-01-01T00:00:00Z', admin: false },
  proBadDate: { plan: 'PRO',        end: 'não-é-data',           admin: false },
  bogus:      { plan: 'SUPER_ADMIN_XYZ', end: null, admin: false },
  legacyFree: { plan: 'FREE',       end: null, admin: false },
  legacyTeste:{ plan: 'TESTE',      end: null, admin: false },
  legacyFCE:  { plan: 'FALE_C_ESPECIALISTA', end: null, admin: false },
  nullPlan:   { plan: null,         end: null, admin: false },
};
const ids = {};
for (const [k, u] of Object.entries(USERS)) {
  const r = await db.query(
    `INSERT INTO public.profiles (id, plan, plan_end_at, is_admin)
     VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`,
    [u.plan, u.end, u.admin]
  );
  ids[k] = r.rows[0].id;
}
const login = async (k) =>
  db.query('UPDATE public._session SET uid = $1', [k ? ids[k] : null]);

// ------------------------------------------------- aplica a FASE A de verdade
const stripTx = (s) => s.replace(/^\s*BEGIN;\s*$/m, '').replace(/^\s*COMMIT;\s*$/m, '');
const faseA = fs.readFileSync(MIG + '20260922120000_market_access_matrix.sql', 'utf8');
try {
  await db.exec(stripTx(faseA));
  console.log('FASE A aplicada com sucesso (preflight passou, views/funções criadas).\n');
} catch (e) {
  console.error('FALHA AO APLICAR FASE A:', e.message);
  process.exit(1);
}

// --------------------------------------------------------------------- testes
let pass = 0, fail = 0;
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n         esperado: ${b}\n         obtido:   ${a}`); }
};

const fieldsFor = async (codigo) => {
  const r = await db.query(
    `SELECT analysis_taxa_semanal AS taxa_semanal, roitrim, carteira, recomendacao, nota_especialista, tendencia
     FROM public.assets_market_view WHERE codigo_b3 = $1`, [codigo]);
  const row = r.rows[0];
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === null ? 'BLOQ' : 'VIS']));
};
const ALL_VIS = { taxa_semanal:'VIS', roitrim:'VIS', carteira:'VIS', recomendacao:'VIS', nota_especialista:'VIS', tendencia:'VIS' };
const ALL_BLOQ = { taxa_semanal:'BLOQ', roitrim:'BLOQ', carteira:'BLOQ', recomendacao:'BLOQ', nota_especialista:'BLOQ', tendencia:'BLOQ' };
const M5_BLOQ_TEND_VIS = { taxa_semanal:'BLOQ', roitrim:'BLOQ', carteira:'BLOQ', recomendacao:'BLOQ', nota_especialista:'BLOQ', tendencia:'VIS' };

// TST00=START TST01=PRO TST02=SPECIALIST
console.log('== NÍVEL DO USUÁRIO (fail-closed) ==');
for (const [k, exp] of Object.entries({
  start:'START', pro:'PRO', specialist:'FULL', wealth:'FULL', admin:'FULL',
  proExpired:'START', proBadDate:'START', bogus:'START',
  legacyFree:'START', legacyTeste:'PRO', legacyFCE:'FULL', nullPlan:'START',
})) {
  await login(k);
  const r = await db.query('SELECT public.current_user_market_level() AS lvl');
  check(`${k} -> ${exp}`, r.rows[0].lvl, exp);
}
await login(null);
check('anônimo -> ANON', (await db.query('SELECT public.current_user_market_level() AS lvl')).rows[0].lvl, 'ANON');

console.log('\n== MATRIZ DE CAMPOS (assets_market_view) ==');
await login('start');
check('START  / ativo START',      await fieldsFor('TST00'), ALL_BLOQ);
check('START  / ativo SPECIALIST', await fieldsFor('TST02'), ALL_BLOQ);
await login('pro');
check('PRO    / ativo START',      await fieldsFor('TST00'), ALL_VIS);
check('PRO    / ativo PRO',        await fieldsFor('TST01'), ALL_VIS);
check('PRO    / ativo SPECIALIST (5 bloq, tendência VIS)', await fieldsFor('TST02'), M5_BLOQ_TEND_VIS);
await login('specialist');
check('SPECIALIST / ativo SPECIALIST', await fieldsFor('TST02'), ALL_VIS);
await login('wealth');
check('WEALTH / ativo SPECIALIST', await fieldsFor('TST02'), ALL_VIS);
await login('admin');
check('ADMIN  / ativo SPECIALIST', await fieldsFor('TST02'), ALL_VIS);
await login('proExpired');
check('PRO vencido / ativo START', await fieldsFor('TST00'), ALL_BLOQ);
await login('bogus');
check('plano inválido / ativo START', await fieldsFor('TST00'), ALL_BLOQ);

console.log('\n== TOP 20 / RPC PÚBLICA (anônimo) ==');
await login(null);
const top = await db.query('SELECT * FROM public.get_public_market_assets(NULL)');
check('devolve exatamente 20 linhas', top.rows.length, 20);
check('ordenado por ROI 2026 desc', top.rows.slice(0,3).map(r=>r.codigo_b3), ['TST00','TST01','TST02']);
check('o 20º é TST19', top.rows[19].codigo_b3, 'TST19');
check('recomendacao mascarada p/ anônimo', [...new Set(top.rows.map(r=>r.recomendacao))], [null]);
check('colunas expostas (sem nome, sem ROI TRIM)', Object.keys(top.rows[0]).sort(),
      ['codigo_b3','id','recomendacao','roi2026','tipo']);
check('ROI ilegível fora do ranking', top.rows.some(r=>r.codigo_b3==='BADROI'), false);
check('ativo inativo fora do ranking', top.rows.some(r=>r.codigo_b3==='INATIVO'), false);

console.log('\n== BUSCA PÚBLICA RESTRITA AO TOP 20 ==');
const search = async (q) => (await db.query('SELECT codigo_b3 FROM public.get_public_market_assets($1)', [q])).rows.map(r=>r.codigo_b3);
check('ticker DENTRO do Top 20 (TST05) encontra', await search('TST05'), ['TST05']);
check('ticker FORA do Top 20 (TST25) NÃO encontra', await search('TST25'), []);
check('ticker FORA do Top 20 (TST29) NÃO encontra', await search('TST29'), []);
check('ROI ilegível (BADROI) NÃO encontra', await search('BADROI'), []);
check('inativo (INATIVO) NÃO encontra', await search('INATIVO'), []);
const partial = await search('TST');
check('busca parcial "TST" não escapa do Top 20', partial.length, 20);
check('busca parcial só devolve membros do Top 20',
      partial.every(c => top.rows.some(t=>t.codigo_b3===c)), true);
const byName = await search('PETROLEO');
check('busca por NOME também limitada ao Top 20', byName.length, 20);
check('busca por nome não traz TST25', byName.includes('TST25'), false);
check('curinga % não enumera', await search('%'), []);
check('curinga _ não enumera', await search('_'), []);

console.log('\n== RECOMENDAÇÃO NA RPC PARA USUÁRIO COM DIREITO ==');
await login('pro');
const proTop = await db.query('SELECT codigo_b3, recomendacao FROM public.get_public_market_assets(NULL)');
check('PRO vê recomendacao em ativo START (TST00)', proTop.rows.find(r=>r.codigo_b3==='TST00').recomendacao, 'COMPRA');
check('PRO NÃO vê recomendacao em ativo SPECIALIST (TST02)', proTop.rows.find(r=>r.codigo_b3==='TST02').recomendacao, null);
await login('specialist');
const spTop = await db.query('SELECT codigo_b3, recomendacao FROM public.get_public_market_assets(NULL)');
check('SPECIALIST vê recomendacao em ativo SPECIALIST', spTop.rows.find(r=>r.codigo_b3==='TST02').recomendacao, 'COMPRA');

console.log('\n== normalize_asset_profile (fail-safe) ==');
for (const [inp, exp] of [['START','START'],['start','START'],[' Pro ','PRO'],['SPECIALIST','SPECIALIST'],
                          ['Especialista','SPECIALIST'],['FREE','START'],['','SPECIALIST'],[null,'SPECIALIST'],
                          ['xyz-desconhecido','SPECIALIST']]) {
  const r = await db.query('SELECT public.normalize_asset_profile($1) AS p', [inp]);
  check(`perfil ${JSON.stringify(inp)} -> ${exp}`, r.rows[0].p, exp);
}

console.log('\n== safe_parse_numeric ==');
for (const [inp, exp] of [['105.71','105.71'],['-15.11','-15.11'],['0','0'],['1.234,56','1234.56'],
                          ['12,5%','12.5'],['--',null],['',null],[null,null],['abc',null]]) {
  const r = await db.query('SELECT public.safe_parse_numeric($1)::text AS n', [inp]);
  check(`numeric ${JSON.stringify(inp)} -> ${exp}`, r.rows[0].n, exp);
}

console.log(`\n================ ${pass} passaram, ${fail} falharam ================`);
process.exit(fail ? 1 : 0);
