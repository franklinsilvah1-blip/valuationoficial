// Parte 5: gate final.
//  (1) whitelist de policies em asset_analyses — policy permissiva "esperta"
//      (ex.: auth.uid() IS NOT NULL) tem de abortar a FASE B;
//  (2) search_path / CREATE no schema public;
//  (3) DML realmente necessário em public.assets (botão "Limpar Banco");
//  (4) tabela completa de has_function_privilege para anon.
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

// Base comum: scaffold + FASE A + seed + privilégios "como produção".
async function base({ policyAnalyses, schemaCreate } = {}) {
  const db = await new PGlite();
  await db.exec(fs.readFileSync(here('scaffold.sql'), 'utf8'));
  await db.exec(stripTx(faseA));
  await db.exec(fs.readFileSync(here('seed.sql'), 'utf8'));
  await db.exec(`
    CREATE ROLE service_role;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE TABLE public.asset_highlights (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_id uuid, position int);
    GRANT SELECT ON public.assets, public.asset_analyses, public.asset_highlights TO PUBLIC;
    GRANT SELECT ON public.assets_market_view, public.asset_analyses_gated TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.get_public_assets(text) TO anon, authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets, public.asset_analyses TO service_role;
    ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Anyone can view assets" ON public.assets FOR SELECT USING (true);
    CREATE POLICY "Admins can manage assets" ON public.assets
      FOR ALL USING (public.has_role(auth.uid(), 'admin'));
    ALTER TABLE public.asset_analyses ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Admins can manage analyses" ON public.asset_analyses
      FOR ALL USING (public.has_role(auth.uid(), 'admin'));
  `);
  if (policyAnalyses) await db.exec(policyAnalyses);
  if (schemaCreate) await db.exec(schemaCreate);
  return db;
}

const aplicarB = async (db) => {
  try { await db.exec(stripTx(faseB)); return { ok: true }; }
  catch (e) { await db.exec('ROLLBACK').catch(() => {}); return { ok: false, err: e.message }; }
};

// ================================================= 1. WHITELIST DE POLICIES
console.log('== 1. Policies permissivas em asset_analyses devem ABORTAR a FASE B ==');

const PERIGOSAS = [
  ['USING (auth.uid() IS NOT NULL)',
   `CREATE POLICY "logados veem tudo" ON public.asset_analyses FOR SELECT USING (auth.uid() IS NOT NULL);`],
  ['USING (true)',
   `CREATE POLICY "todo mundo" ON public.asset_analyses FOR SELECT USING (true);`],
  ['USING (1 = 1)',
   `CREATE POLICY "sempre" ON public.asset_analyses FOR SELECT USING (1 = 1);`],
  ['FOR ALL TO authenticated USING (true)',
   `CREATE POLICY "auth tudo" ON public.asset_analyses FOR ALL TO authenticated USING (true);`],
  ['USING (perfil_investidor = \'START\')',
   `CREATE POLICY "so start" ON public.asset_analyses FOR SELECT USING (perfil_investidor = 'START');`],
];
for (const [nome, sql] of PERIGOSAS) {
  const db = await base({ policyAnalyses: sql });
  const r = await aplicarB(db);
  check(`aborta com policy ${nome}`, !r.ok && /policy PERMISSIVE sem teste de admin/.test(r.err || ''), true);
  await db.close();
}

console.log('\n== 1b. Policies de ESCRITA permissivas devem ABORTAR a FASE B ==');

const PERIGOSAS_ESCRITA = [
  ['DELETE em asset_analyses TO authenticated USING (true)',
   `CREATE POLICY "del analyses" ON public.asset_analyses FOR DELETE TO authenticated USING (true);`],
  ['DELETE em assets TO authenticated USING (true)',
   `CREATE POLICY "del assets" ON public.assets FOR DELETE TO authenticated USING (true);`],
  ['DELETE em assets USING (auth.uid() IS NOT NULL)',
   `CREATE POLICY "del assets logado" ON public.assets FOR DELETE USING (auth.uid() IS NOT NULL);`],
  ['ALL em assets TO authenticated USING (true)',
   `CREATE POLICY "all assets" ON public.assets FOR ALL TO authenticated USING (true);`],
  ['ALL em asset_analyses sem teste de admin',
   `CREATE POLICY "all analyses" ON public.asset_analyses FOR ALL USING (auth.uid() IS NOT NULL);`],
  ['UPDATE com USING admin mas WITH CHECK permissivo',
   `CREATE POLICY "upd check fraco" ON public.asset_analyses FOR UPDATE
      USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (true);`],
  ['INSERT com WITH CHECK (true)',
   `CREATE POLICY "ins fraco" ON public.asset_analyses FOR INSERT WITH CHECK (true);`],
];
for (const [nome, sql] of PERIGOSAS_ESCRITA) {
  const db = await base({ policyAnalyses: sql });
  const r = await aplicarB(db);
  check(`aborta com policy ${nome}`,
        !r.ok && /policy PERMISSIVE sem teste de admin/.test(r.err || ''), true);
  await db.close();
}

console.log('\n== 1c. asset_highlights segue a mesma lógica ==');
for (const [nome, sql] of [
  ['DELETE TO authenticated USING (true)',
   `CREATE POLICY "hl del" ON public.asset_highlights FOR DELETE TO authenticated USING (true);`],
  ['INSERT WITH CHECK (true)',
   `CREATE POLICY "hl ins" ON public.asset_highlights FOR INSERT WITH CHECK (true);`],
  ['ALL sem teste de admin',
   `CREATE POLICY "hl all" ON public.asset_highlights FOR ALL USING (auth.uid() IS NOT NULL);`],
]) {
  const db = await base({ policyAnalyses:
    `ALTER TABLE public.asset_highlights ENABLE ROW LEVEL SECURITY; ${sql}` });
  const r = await aplicarB(db);
  check(`aborta com policy em asset_highlights: ${nome}`,
        !r.ok && /policy PERMISSIVE sem teste de admin/.test(r.err || ''), true);
  await db.close();
}
{
  const db = await base({ policyAnalyses:
    `ALTER TABLE public.asset_highlights ENABLE ROW LEVEL SECURITY;
     CREATE POLICY "Admins can manage highlights" ON public.asset_highlights
       FOR ALL USING (public.has_role(auth.uid(), 'admin'));` });
  const r = await aplicarB(db);
  check('policy legítima de admin em asset_highlights é aceita', r.ok, true);
  await db.close();
}

console.log('\n== ...e NÃO aborta com as policies legítimas ==');
{
  const db = await base();
  const r = await aplicarB(db);
  check('policy só de admin (has_role) é aceita', r.ok, true);
  await db.close();
}
{
  // RESTRICTIVE nunca concede — não deve disparar o alarme
  const db = await base({ policyAnalyses:
    `CREATE POLICY "restritiva" ON public.asset_analyses AS RESTRICTIVE FOR SELECT USING (auth.uid() IS NOT NULL);` });
  const r = await aplicarB(db);
  check('policy RESTRICTIVE não dispara falso positivo', r.ok, true);
  await db.close();
}
{
  // policy limitada a service_role não é alcançável por usuário final
  const db = await base({ policyAnalyses:
    `CREATE POLICY "svc" ON public.asset_analyses FOR SELECT TO service_role USING (true);` });
  const r = await aplicarB(db);
  check('policy restrita a service_role não dispara falso positivo', r.ok, true);
  await db.close();
}
{
  // policy de DELETE legítima (só admin) tem de passar
  const db = await base({ policyAnalyses:
    `CREATE POLICY "admin del" ON public.asset_analyses FOR DELETE
       USING (public.has_role(auth.uid(), 'admin'));` });
  const r = await aplicarB(db);
  check('policy DELETE só de admin é aceita', r.ok, true);
  await db.close();
}
{
  // UPDATE legítimo: admin nas DUAS expressões
  const db = await base({ policyAnalyses:
    `CREATE POLICY "admin upd" ON public.asset_analyses FOR UPDATE
       USING (public.has_role(auth.uid(), 'admin'))
       WITH CHECK (public.has_role(auth.uid(), 'admin'));` });
  const r = await aplicarB(db);
  check('policy UPDATE com admin em USING e WITH CHECK é aceita', r.ok, true);
  await db.close();
}

// ============================================ 2. CREATE no schema public
console.log('\n== 2. CREATE no schema public deve ABORTAR a FASE B ==');
for (const [papel, sql] of [['anon', 'GRANT CREATE ON SCHEMA public TO anon;'],
                            ['authenticated', 'GRANT CREATE ON SCHEMA public TO authenticated;']]) {
  const db = await base({ schemaCreate: sql });
  const r = await aplicarB(db);
  check(`aborta se ${papel} tem CREATE em public`, !r.ok && new RegExp(`${papel} tem CREATE no schema public`).test(r.err || ''), true);
  await db.close();
}

// ================================ 3, 4: estado final + DML + funções
console.log('\n== 3. Estado final ==');
const db = await base();
const r = await aplicarB(db);
check('FASE B aplica com o estado legítimo', r.ok, true);

const eff = async (role, rel, priv) =>
  (await db.query('SELECT has_table_privilege($1,$2,$3) AS p', [role, rel, priv])).rows[0].p;
const effFn = async (role, fn) =>
  (await db.query('SELECT has_function_privilege($1,$2,$3) AS p', [role, fn, 'EXECUTE'])).rows[0].p;

console.log('\n  -- privilégios de authenticated em assets (mínimo provado) --');
check('authenticated SELECT em assets', await eff('authenticated', 'public.assets', 'SELECT'), true);
check('authenticated DELETE em assets (botão Limpar Banco)', await eff('authenticated', 'public.assets', 'DELETE'), true);
check('authenticated SELECT em asset_analyses', await eff('authenticated', 'public.asset_analyses', 'SELECT'), true);
check('authenticated DELETE em asset_analyses', await eff('authenticated', 'public.asset_analyses', 'DELETE'), true);

console.log('\n  -- schema public --');
const sp = async (role, priv) =>
  (await db.query('SELECT has_schema_privilege($1,$2,$3) AS p', [role, 'public', priv])).rows[0].p;
check('anon CREATE em public = false', await sp('anon', 'CREATE'), false);
check('authenticated CREATE em public = false', await sp('authenticated', 'CREATE'), false);
check('anon USAGE em public = true', await sp('anon', 'USAGE'), true);
check('authenticated USAGE em public = true', await sp('authenticated', 'USAGE'), true);

console.log('\n== 4. Tabela completa de has_function_privilege para anon ==');
const TABELA = [
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
for (const [fn, esperado] of TABELA) {
  check(`anon ${fn.replace('public.', '').padEnd(42)} = ${esperado}`, await effFn('anon', fn), esperado);
}

// ================================= DML real: o botão "Limpar Banco" funciona?
console.log('\n== O botão "Limpar Banco" (DELETE como authenticated) ==');
const ids = {};
for (const [k, plan, admin] of [['start', 'START', false], ['pro', 'PRO', false],
                                ['spec', 'SPECIALIST', false], ['wealth', 'WEALTH', false],
                                ['admin', 'START', true]]) {
  const x = await db.query(
    `INSERT INTO public.profiles (id, plan, plan_end_at, is_admin)
     VALUES (gen_random_uuid(), $1, NULL, $2) RETURNING id`, [plan, admin]);
  ids[k] = x.rows[0].id;
}
const comoUsuario = async (uid, sql) => {
  await db.query('UPDATE public._session SET uid = $1', [uid]);
  await db.exec('SET ROLE authenticated');
  try {
    const x = await db.query(sql);
    await db.exec('RESET ROLE');
    return { ok: true, rows: x.rows, n: x.affectedRows ?? 0 };
  } catch (e) {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    return { ok: false, err: e.message.split('\n')[0] };
  }
};

const CRU = `SELECT taxa_semanal, roitrim, carteira, recomendacao, nota_especialista
             FROM public.asset_analyses LIMIT 1`;
console.log('\n  -- leitura da tabela CRUA por plano --');
for (const k of ['start', 'pro', 'spec', 'wealth']) {
  const res = await comoUsuario(ids[k], CRU);
  check(`${k.toUpperCase().padEnd(6)} lê asset_analyses cru: 0 linhas`,
        res.ok ? res.rows.length : 'erro: ' + res.err, 0);
}
const adm = await comoUsuario(ids.admin, CRU);
check('ADMIN  lê asset_analyses cru: acessa', adm.ok && adm.rows.length === 1, true);

console.log('\n  -- DELETE (Limpar Banco) --');
// Ordem real do botão (AdminSync.tsx): apaga asset_analyses ANTES de assets,
// por causa da FK asset_analyses_asset_id_fkey.
const startDelA = await comoUsuario(ids.start, `DELETE FROM public.asset_analyses WHERE asset_id IN (SELECT id FROM public.assets WHERE codigo_b3 = 'TST29')`);
check('START não apaga análises (RLS)', startDelA.ok ? startDelA.n : 'erro: ' + startDelA.err, 0);
const startDel = await comoUsuario(ids.start, `DELETE FROM public.assets WHERE codigo_b3 = 'TST29'`);
check('START não apaga nada (RLS)', startDel.ok ? startDel.n : 'erro: ' + startDel.err, 0);
const admDelA = await comoUsuario(ids.admin, `DELETE FROM public.asset_analyses WHERE asset_id IN (SELECT id FROM public.assets WHERE codigo_b3 = 'TST29')`);
check('ADMIN apaga a análise (passo 1 do Limpar Banco)', admDelA.ok ? admDelA.n : 'erro: ' + admDelA.err, 1);
const admDel = await comoUsuario(ids.admin, `DELETE FROM public.assets WHERE codigo_b3 = 'TST29'`);
check('ADMIN apaga o ativo (passo 2 do Limpar Banco)', admDel.ok ? admDel.n : 'erro: ' + admDel.err, 1);

console.log('\n== DELETE real por plano (GRANT permite a operação; RLS decide as linhas) ==');
for (const k of ['start', 'pro', 'spec', 'wealth']) {
  const dAn = await comoUsuario(ids[k], `DELETE FROM public.asset_analyses WHERE roi2026 = '280'`);
  check(`${k.toUpperCase().padEnd(6)} DELETE em asset_analyses: 0 linhas`,
        dAn.ok ? dAn.n : 'erro: ' + dAn.err, 0);
  const dAs = await comoUsuario(ids[k], `DELETE FROM public.assets WHERE codigo_b3 = 'TST28'`);
  check(`${k.toUpperCase().padEnd(6)} DELETE em assets: 0 linhas`,
        dAs.ok ? dAs.n : 'erro: ' + dAs.err, 0);
}
// E o dado continua lá depois de todas as tentativas.
const sobrou = await db.query(`SELECT count(*)::int c FROM public.assets WHERE codigo_b3 = 'TST28'`);
check('o ativo alvo NÃO foi apagado por nenhum não-admin', sobrou.rows[0].c, 1);

await db.close();
console.log(`\n================ ${pass} passaram, ${fail} falharam ================`);
process.exit(fail ? 1 : 0);
