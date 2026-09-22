// Parte 3: SET ROLE anon — prova de superfície. Depois da FASE B, o que o
// papel anon REALMENTE consegue executar/ler?
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Caminhos relativos a este arquivo, para o teste rodar de qualquer cwd.
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const MIG = here('../migrations/');

const faseA = fs.readFileSync(MIG + '20260922120000_market_access_matrix.sql', 'utf8');
const faseB = fs.readFileSync(MIG + '20260922130000_market_access_lockdown.sql', 'utf8');
const stripTx = (s) => s.replace(/^\s*BEGIN;\s*$/m, '').replace(/^\s*COMMIT;\s*$/m, '');

let pass = 0, fail = 0;
const check = (n, a, e) => {
  const x = JSON.stringify(a), y = JSON.stringify(e);
  if (x === y) { pass++; console.log(`  ok   ${n}`); }
  else { fail++; console.log(`  FAIL ${n}\n         esperado: ${y}\n         obtido:   ${x}`); }
};

const db = await new PGlite();
await db.exec(fs.readFileSync(here('scaffold.sql'), 'utf8'));
await db.exec(stripTx(faseA));
await db.exec(fs.readFileSync(here('seed.sql'), 'utf8'));
await db.exec(`
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  GRANT SELECT ON public.assets, public.asset_analyses,
                  public.assets_market_view, public.asset_analyses_gated TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.get_public_assets(text) TO anon, authenticated;
  CREATE TABLE public.asset_highlights (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_id uuid, position int);
  GRANT SELECT ON public.asset_highlights TO anon, authenticated;
  ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
  -- asset_analyses PRECISA de RLS: é ela que barra o usuário START de ler os
  -- campos crus. A FASE B aborta se estiver desligada (e é isso que a suíte 04
  -- verifica explicitamente).
  ALTER TABLE public.asset_analyses ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Admins can manage analyses" ON public.asset_analyses
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));
  CREATE POLICY "Anyone can view assets" ON public.assets FOR SELECT USING (true);
`);

// ---------------------------------------------------------- ANTES da FASE B
const asAnon = async (sql) => {
  try {
    await db.exec('SET ROLE anon');
    const r = await db.query(sql);
    await db.exec('RESET ROLE');
    return { ok: true, rows: r.rows.length };
  } catch (e) {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    return { ok: false, err: e.message.split('\n')[0] };
  }
};

console.log('== ANTES DA FASE B (estado atual de produção) ==');
const antes = {};
for (const [nome, sql] of [
  ['assets',               'SELECT id FROM public.assets'],
  ['assets_market_view',   'SELECT id FROM public.assets_market_view'],
  ['asset_analyses_gated', 'SELECT id FROM public.asset_analyses_gated'],
  ['get_public_assets',    "SELECT * FROM public.get_public_assets('TST25')"],
]) {
  antes[nome] = await asAnon(sql);
  console.log(`  anon -> ${nome.padEnd(22)} ${antes[nome].ok ? 'PERMITIDO (' + antes[nome].rows + ' linhas)' : 'negado'}`);
}
check('anon enumerava assets', antes['assets'].ok, true);
check('anon enumerava assets_market_view', antes['assets_market_view'].ok, true);
check('anon alcançava ativo fora do Top 20 via get_public_assets', antes['get_public_assets'].rows > 0, true);

// ------------------------------------------------------------- aplica FASE B
await db.exec(stripTx(faseB));
console.log('\n== DEPOIS DA FASE B — SET ROLE anon ==');

const casos = [
  ['SELECT em assets',               'SELECT id FROM public.assets',                                   false],
  ['SELECT em asset_analyses',       'SELECT id FROM public.asset_analyses',                           false],
  ['SELECT em assets_market_view',   'SELECT id FROM public.assets_market_view',                       false],
  ['SELECT em asset_analyses_gated', 'SELECT id FROM public.asset_analyses_gated',                     false],
  ['SELECT em asset_highlights',     'SELECT id FROM public.asset_highlights',                         false],
  ['get_public_assets (RPC antiga)', "SELECT * FROM public.get_public_assets('TST25')",                false],
  ['top_assets_year (interna)',      'SELECT * FROM public.top_assets_year(20)',                       false],
  ['current_user_market_level',      'SELECT public.current_user_market_level()',                      false],
  ['can_view_asset_premium/2',       "SELECT public.can_view_asset_premium('FULL','PRO')",             false],
  ['normalize_asset_profile',        "SELECT public.normalize_asset_profile('PRO')",                   false],
  ['safe_parse_numeric',             "SELECT public.safe_parse_numeric('1')",                          false],
  ['get_public_market_assets',       'SELECT * FROM public.get_public_market_assets(NULL)',            true ],
];

for (const [nome, sql, esperadoOk] of casos) {
  const r = await asAnon(sql);
  check(`anon ${esperadoOk ? 'PODE' : 'NÃO pode'}: ${nome}`, r.ok, esperadoOk);
}

// ------------------------------------- a única porta continua correta e limitada
console.log('\n== A ÚNICA PORTA RESTANTE, executada COMO anon ==');
await db.exec('SET ROLE anon');
const top = await db.query('SELECT * FROM public.get_public_market_assets(NULL)');
check('devolve 20 linhas', top.rows.length, 20);
check('recomendacao mascarada', [...new Set(top.rows.map(r => r.recomendacao))], [null]);
check('só 5 colunas, sem nome/ROI TRIM', Object.keys(top.rows[0]).sort(), ['codigo_b3','id','recomendacao','roi2026','tipo']);
const fora = await db.query("SELECT * FROM public.get_public_market_assets('TST25')");
check('ticker fora do Top 20 não é devolvido', fora.rows.length, 0);
const dentro = await db.query("SELECT * FROM public.get_public_market_assets('TST05')");
check('ticker dentro do Top 20 é devolvido', dentro.rows.map(r => r.codigo_b3), ['TST05']);
await db.exec('RESET ROLE');

// --------------------------------------- authenticated continua funcionando
console.log('\n== authenticated (plano START) continua com a lista completa ==');
await db.exec('SET ROLE authenticated');
const auth = await db.query('SELECT count(*)::int AS c FROM public.assets_market_view');
check('authenticated lê todos os ativos', auth.rows[0].c, 30);
await db.exec('RESET ROLE');

console.log(`\n================ ${pass} passaram, ${fail} falharam ================`);
process.exit(fail ? 1 : 0);
