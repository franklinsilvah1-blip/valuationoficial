// Parte 4: privilégio EFETIVO (incl. herança de PUBLIC) e tentativa de bypass
// da view consultando a tabela crua public.asset_analyses.
//
// Cobre os pontos 1, 2, 3, 4 e 6 da revisão de segurança pré-produção.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import { fileURLToPath } from 'url';

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

// ---------------------------------------------------------------------------
// Estado inicial: reproduz o pior caso — privilégio vindo de PUBLIC, SEM
// nenhum GRANT nominal para anon. É exatamente o cenário que
// information_schema.role_table_grants WHERE grantee='anon' NÃO enxerga.
// ---------------------------------------------------------------------------
await db.exec(`
  CREATE ROLE service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

  CREATE TABLE public.asset_highlights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_id uuid, position int);

  -- NADA nominal para anon: tudo vem de PUBLIC.
  GRANT SELECT ON public.assets            TO PUBLIC;
  GRANT SELECT ON public.asset_analyses    TO PUBLIC;
  GRANT SELECT ON public.asset_highlights  TO PUBLIC;
  GRANT SELECT ON public.assets_market_view     TO anon, authenticated;
  GRANT SELECT ON public.asset_analyses_gated   TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.get_public_assets(text) TO anon, authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets, public.asset_analyses TO service_role;

  ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Anyone can view assets" ON public.assets FOR SELECT USING (true);

  ALTER TABLE public.asset_analyses ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Admins can manage analyses" ON public.asset_analyses
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));
`);

const eff = async (role, rel, priv = 'SELECT') =>
  (await db.query('SELECT has_table_privilege($1,$2,$3) AS p', [role, rel, priv])).rows[0].p;
const effFn = async (role, fn) =>
  (await db.query('SELECT has_function_privilege($1,$2,$3) AS p', [role, fn, 'EXECUTE'])).rows[0].p;
const nominal = async (rel) =>
  (await db.query(
    `SELECT count(*)::int c FROM information_schema.role_table_grants
     WHERE grantee='anon' AND table_schema='public' AND table_name=$1`, [rel])).rows[0].c;

// ============================================================ PONTO 1 e 2
console.log('== ANTES: privilégio herdado de PUBLIC é invisível ao check nominal ==');
check('anon TEM privilégio EFETIVO em assets', await eff('anon', 'public.assets'), true);
check('...mas NENHUM grant nominal aparece para anon', await nominal('assets'), 0);
check('anon TEM privilégio EFETIVO em asset_analyses', await eff('anon', 'public.asset_analyses'), true);
check('...nenhum grant nominal para anon', await nominal('asset_analyses'), 0);
check('anon TEM privilégio EFETIVO em asset_highlights', await eff('anon', 'public.asset_highlights'), true);
console.log('  (é exatamente o caso que role_table_grants WHERE grantee=anon não detecta)');

// ======================================================= PONTO 4: RLS ativa
console.log('\n== RLS ativa nas tabelas cruas ==');
const rls = async (rel) =>
  (await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass`, [rel])).rows[0].relrowsecurity;
check('RLS habilitada em public.assets', await rls('public.assets'), true);
check('RLS habilitada em public.asset_analyses', await rls('public.asset_analyses'), true);

// preflight deve ABORTAR se a RLS de asset_analyses estiver desligada
{
  const db2 = await new PGlite();
  await db2.exec(fs.readFileSync(here('scaffold.sql'), 'utf8'));
  await db2.exec(stripTx(faseA));
  await db2.exec(fs.readFileSync(here('seed.sql'), 'utf8'));
  await db2.exec(`ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;`); // só assets
  let msg = null;
  try { await db2.exec(stripTx(faseB)); } catch (e) { msg = e.message; }
  check('FASE B aborta com RLS desligada em asset_analyses', /RLS está DESABILITADA em public\.asset_analyses/.test(msg || ''), true);
  await db2.close();
}

// ================================================================= FASE B
await db.exec(stripTx(faseB));
console.log('\n== DEPOIS DA FASE B: privilégio EFETIVO de anon ==');
for (const rel of ['public.assets', 'public.asset_analyses', 'public.assets_market_view',
                   'public.asset_analyses_gated', 'public.asset_highlights']) {
  for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const v = await eff('anon', rel, priv);
    if (priv === 'SELECT') check(`has_table_privilege(anon, ${rel.replace('public.', '')}, SELECT) = false`, v, false);
    else if (v) { fail++; console.log(`  FAIL anon tem ${priv} em ${rel}`); }
  }
}

console.log('\n== DEPOIS DA FASE B: funções ==');
const fnEsperado = [
  ['public.get_public_market_assets(text)', true],
  ['public.get_public_assets(text)', false],
  ['public.top_assets_year(integer)', false],
  ['public.current_user_market_level()', false],
  ['public.current_user_has_full_market_access()', false],
  ['public.can_view_asset_premium(text)', false],
  ['public.can_view_asset_premium(text, text)', false],
  ['public.normalize_asset_profile(text)', false],
  ['public.safe_parse_numeric(text)', false],
];
for (const [fn, esperado] of fnEsperado) {
  check(`has_function_privilege(anon, ${fn.replace('public.', '')}) = ${esperado}`, await effFn('anon', fn), esperado);
}

console.log('\n== authenticated e service_role NÃO foram quebrados ==');
check('authenticated SELECT em assets', await eff('authenticated', 'public.assets'), true);
check('authenticated SELECT em assets_market_view', await eff('authenticated', 'public.assets_market_view'), true);
check('authenticated SELECT em asset_analyses_gated', await eff('authenticated', 'public.asset_analyses_gated'), true);
check('authenticated SELECT em asset_analyses (Admin precisa)', await eff('authenticated', 'public.asset_analyses'), true);
check('authenticated SELECT em asset_highlights (Admin precisa)', await eff('authenticated', 'public.asset_highlights'), true);
for (const p of ['SELECT', 'INSERT', 'UPDATE']) {
  check(`service_role ${p} em assets (sync da planilha)`, await eff('service_role', 'public.assets', p), true);
  check(`service_role ${p} em asset_analyses`, await eff('service_role', 'public.asset_analyses', p), true);
}

// ============================================== PONTO 3: bypass pela tabela crua
console.log('\n== BYPASS: usuário START tenta ler public.asset_analyses cru ==');

const login = async (k) => db.query('UPDATE public._session SET uid = $1', [k]);
const ids = {};
for (const [k, plan, admin] of [['start', 'START', false], ['pro', 'PRO', false],
                                ['spec', 'SPECIALIST', false], ['admin', 'START', true]]) {
  const r = await db.query(
    `INSERT INTO public.profiles (id, plan, plan_end_at, is_admin)
     VALUES (gen_random_uuid(), $1, NULL, $2) RETURNING id`, [plan, admin]);
  ids[k] = r.rows[0].id;
}

const comoUsuario = async (uid, sql) => {
  await login(uid);
  await db.exec('SET ROLE authenticated');
  try {
    const r = await db.query(sql);
    await db.exec('RESET ROLE');
    return { ok: true, rows: r.rows };
  } catch (e) {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    return { ok: false, err: e.message.split('\n')[0] };
  }
};

const CRU = `SELECT taxa_semanal, roitrim, carteira, recomendacao, nota_especialista
             FROM public.asset_analyses LIMIT 1`;

const startCru = await comoUsuario(ids.start, CRU);
check('START na tabela CRUA: 0 linhas (barrado pela RLS)', startCru.ok ? startCru.rows.length : 'erro:' + startCru.err, 0);

const proCru = await comoUsuario(ids.pro, CRU);
check('PRO na tabela CRUA: 0 linhas', proCru.ok ? proCru.rows.length : 'erro:' + proCru.err, 0);

const specCru = await comoUsuario(ids.spec, CRU);
check('SPECIALIST na tabela CRUA: 0 linhas', specCru.ok ? specCru.rows.length : 'erro:' + specCru.err, 0);

const adminCru = await comoUsuario(ids.admin, CRU);
check('ADMIN na tabela CRUA: acessa (painel Admin depende disso)', adminCru.ok && adminCru.rows.length === 1, true);

console.log('\n== ...e pela rota CORRETA (view) o mesmo START vê os ativos mascarados ==');
const VIEW = `SELECT codigo_b3, perfil_investidor, analysis_taxa_semanal, roitrim,
                     carteira, recomendacao, nota_especialista, tendencia
              FROM public.assets_market_view WHERE codigo_b3 = $CODE$TST00$CODE$`;
const startView = await comoUsuario(ids.start, VIEW);
if(!startView.ok) console.log('  >>> ERRO VIEW:', startView.err);
check('START vê a linha do ativo pela view', startView.ok && startView.rows.length, 1);
const sv = startView.rows?.[0];
check('START: a view retornou uma linha de verdade', sv !== undefined, true);
check('START: 5 campos premium NULL pela view',
      ['analysis_taxa_semanal', 'roitrim', 'carteira', 'recomendacao', 'nota_especialista'].map(k => sv[k]),
      [null, null, null, null, null]);
check('START: tendência também NULL (regra antiga)', sv.tendencia, null);

console.log('\n== PRO em ativo SPECIALIST (TST02) ==');
const VIEW02 = VIEW.replace('TST00', 'TST02');
const proView = await comoUsuario(ids.pro, VIEW02);
const pv = proView.rows?.[0];
check('PRO: a view retornou uma linha de verdade', pv !== undefined, true);
check('PRO vê a linha do ativo SPECIALIST', proView.ok && proView.rows.length, 1);
check('PRO: os 5 campos vêm NULL em ativo SPECIALIST',
      ['analysis_taxa_semanal', 'roitrim', 'carteira', 'recomendacao', 'nota_especialista'].map(k => pv[k]),
      [null, null, null, null, null]);
check('PRO: tendência VISÍVEL em ativo SPECIALIST (regra antiga preservada)', pv.tendencia, 'ALTA');
const proView00 = await comoUsuario(ids.pro, VIEW);
const pv0 = proView00.rows?.[0];
check('PRO: os 5 campos VISÍVEIS em ativo START',
      ['analysis_taxa_semanal', 'roitrim', 'carteira', 'recomendacao', 'nota_especialista'].map(k => pv0[k] !== null),
      [true, true, true, true, true]);


// ===== ESCRITA: o índice de expressão sobre safe_parse_numeric(roi2026) é
// avaliado a cada INSERT/UPDATE, e o privilégio de EXECUTE é checado contra
// quem escreve. Os consumidores REAIS de escrita são:
//   - service_role  -> Edge Functions do sync da planilha (INSERT/UPDATE)
//   - authenticated -> painel Admin "Limpar Banco" (DELETE), via RLS de admin
console.log('\n== ESCRITA em asset_analyses (índice de expressão + RLS) ==');

const comoRole = async (role, uid, sql) => {
  if (uid !== undefined) await login(uid);
  await db.exec('SET ROLE ' + role);
  try {
    const r = await db.query(sql);
    await db.exec('RESET ROLE');
    return { ok: true, n: r.affectedRows ?? 0 };
  } catch (e) {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    return { ok: false, err: e.message.split('\n')[0] };
  }
};

// service_role: o caminho do sync. UPDATE atravessa o índice de expressão.
const svcUpd = await comoRole('service_role', undefined,
  "UPDATE public.asset_analyses SET roi2026 = '123.45' WHERE roi2026 = '300'");
check('service_role faz UPDATE (sync da planilha atravessa o índice)',
      svcUpd.ok ? 'ok' : 'erro: ' + svcUpd.err, 'ok');

const svcIns = await comoRole('service_role', undefined,
  `INSERT INTO public.asset_analyses (asset_id, roi2026, perfil_investidor, taxa_semanal, roitrim,
      tendencia, carteira, recomendacao, nota_especialista)
    SELECT id, '7.7', 'START', 'R', 'T', 'ALTA', 'C', 'COMPRA', 'TOP ANO'
    FROM public.assets WHERE codigo_b3 = 'TST29'`);
check('service_role faz INSERT', svcIns.ok ? 'ok' : 'erro: ' + svcIns.err, 'ok');

// Admin: o caminho real do painel é DELETE (não há UPDATE no frontend).
const admDel = await comoRole('authenticated', ids.admin,
  "DELETE FROM public.asset_analyses WHERE roi2026 = '7.7'");
check('ADMIN faz DELETE em asset_analyses (Limpar Banco)',
      admDel.ok ? 'ok' : 'erro: ' + admDel.err, 'ok');

// START não escreve nada: a RLS não casa nenhuma linha.
const startDel = await comoRole('authenticated', ids.start,
  "DELETE FROM public.asset_analyses WHERE roi2026 = '123.45'");
check('START não apaga nada em asset_analyses (RLS)',
      startDel.ok && startDel.n === 0 ? 'bloqueado (0 linhas)'
        : (startDel.ok ? 'APAGOU ' + startDel.n : 'bloqueado (erro)'),
      'bloqueado (0 linhas)');

// O Top 20 continua respondendo depois das escritas.
await db.exec('SET ROLE anon');
const posEscrita = await db.query('SELECT count(*)::int c FROM public.get_public_market_assets(NULL)');
await db.exec('RESET ROLE');
check('Top 20 continua respondendo depois das escritas', posEscrita.rows[0].c, 20);

console.log(`\n================ ${pass} passaram, ${fail} falharam ================`);
process.exit(fail ? 1 : 0);
