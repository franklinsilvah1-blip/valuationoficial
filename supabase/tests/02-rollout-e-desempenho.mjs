// Parte 2: FASE B, caminhos de abort do preflight, atomicidade e DESEMPENHO.
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

const SCAFFOLD = fs.readFileSync(here('scaffold.sql'), 'utf8');

async function fresh({ withGatedView = true } = {}) {
  const db = await new PGlite();
  await db.exec(withGatedView ? SCAFFOLD : SCAFFOLD.replace(/CREATE VIEW public\.asset_analyses_gated[\s\S]*?FROM public\.asset_analyses aa;/, ''));
  return db;
}

// ===================================================================== PREFLIGHT
console.log('== PREFLIGHT DA FASE A (deve ABORTAR sem alterar nada) ==');
{
  // dependência ausente: sem normalize_plan_code
  const db = await fresh();
  await db.exec('DROP FUNCTION public.normalize_plan_code(text);');
  let msg = null;
  try { await db.exec(stripTx(faseA)); } catch (e) { msg = e.message; await db.exec("ROLLBACK").catch(()=>{}); }
  check('aborta sem normalize_plan_code', /PREFLIGHT FALHOU/.test(msg || ''), true);
  check('mensagem nomeia a dependência', /normalize_plan_code/.test(msg || ''), true);
  const fn = await db.query("SELECT to_regprocedure('public.current_user_market_level()') IS NULL AS ausente");
  check('nada foi criado (current_user_market_level ausente)', fn.rows[0].ausente, true);
  await db.close();
}
{
  // view com ordem de coluna divergente
  const db = await fresh();
  // mesmas colunas, ORDEM trocada (roi2025 <-> roi2024)
  await db.exec(`DROP VIEW public.assets_market_view;
                 DROP VIEW public.asset_analyses_gated;
                 CREATE VIEW public.asset_analyses_gated AS
                 SELECT aa.id, aa.asset_id, aa.valor, aa.roi2026, aa.roi2024, aa.roi2025,
                        aa.roitrim, aa.dy2025, aa.fator_mc, aa.roi2023a2025, aa.perfil_investidor,
                        aa.taxa_semanal, aa.resumo, aa.tendencia, aa.carteira, aa.recomendacao,
                        aa.nota_especialista, aa.updated_at
                 FROM public.asset_analyses aa;
                 CREATE VIEW public.assets_market_view AS
                 SELECT a.*, g.perfil_investidor, g.recomendacao, g.tendencia,
                        g.taxa_semanal AS analysis_taxa_semanal, g.roi2026, g.carteira,
                        g.nota_especialista, g.valor, g.roitrim, g.roi2025, g.dy2025,
                        g.roi2024, g.fator_mc, g.roi2023a2025, g.resumo
                 FROM public.assets a JOIN public.asset_analyses_gated g ON g.asset_id = a.id;`);
  let msg = null;
  try { await db.exec(stripTx(faseA)); } catch (e) { msg = e.message; await db.exec("ROLLBACK").catch(()=>{}); }
  check('aborta com ordem de coluna divergente', /PREFLIGHT FALHOU/.test(msg || ''), true);
  check('mensagem mostra esperado vs atual', /esperado:/.test(msg || ''), true);
  await db.close();
}

// ================================================================== ATOMICIDADE
console.log('\n== ATOMICIDADE (BEGIN/COMMIT real) ==');
{
  const db = await fresh();
  // injeta um erro no fim da FASE A e roda COM a transação
  const quebrada = faseA.replace(/^COMMIT;\s*$/m, 'SELECT coluna_que_nao_existe;\nCOMMIT;');
  let msg = null;
  try { await db.exec(quebrada); } catch (e) { msg = e.message; await db.exec("ROLLBACK").catch(()=>{}); }
  check('falha no meio -> erro', /coluna_que_nao_existe/.test(msg || ''), true);
  const r = await db.query("SELECT to_regprocedure('public.current_user_market_level()') IS NULL AS ausente");
  check('ROLLBACK automático: nenhuma função ficou criada', r.rows[0].ausente, true);
  await db.close();
}

// ===================================================================== FASE B
console.log('\n== FASE B ==');
{
  const db = await fresh();
  let msg = null;
  try { await db.exec(stripTx(faseB)); } catch (e) { msg = e.message; await db.exec("ROLLBACK").catch(()=>{}); }
  check('FASE B aborta se FASE A não foi aplicada', /PREFLIGHT FALHOU/.test(msg || ''), true);
  check('mensagem manda aplicar a FASE A', /FASE A/.test(msg || ''), true);
  await db.close();
}
{
  const db = await fresh();
  await db.exec(stripTx(faseA));
  await db.exec(fs.readFileSync(here('seed.sql'), 'utf8'));
  // privilégios iniciais "como produção"
  await db.exec(`
    GRANT SELECT ON public.assets, public.asset_analyses,
                    public.assets_market_view, public.asset_analyses_gated TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.get_public_assets(text) TO anon, authenticated;
    ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
  -- asset_analyses PRECISA de RLS: é ela que barra o usuário START de ler os
  -- campos crus. A FASE B aborta se estiver desligada (e é isso que a suíte 04
  -- verifica explicitamente).
  ALTER TABLE public.asset_analyses ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Admins can manage analyses" ON public.asset_analyses
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));
    CREATE POLICY "Anyone can view assets" ON public.assets FOR SELECT USING (true);
  `);

  const anonGrants = async () => (await db.query(`
    SELECT table_name FROM information_schema.role_table_grants
    WHERE grantee='anon' AND table_schema='public'
      AND table_name IN ('assets','asset_analyses','assets_market_view','asset_analyses_gated')
    ORDER BY table_name`)).rows.map(r => r.table_name);

  check('ANTES: anon lê as 4 relações',
        [...new Set(await anonGrants())],
        ['asset_analyses','asset_analyses_gated','assets','assets_market_view']);

  await db.exec(stripTx(faseB));
  console.log('  (FASE B aplicada — bloco de verificação interno passou)');

  check('DEPOIS: anon não tem privilégio em nenhuma delas', await anonGrants(), []);

  const priv = async (role, fn) => (await db.query(`SELECT has_function_privilege($1,$2,'EXECUTE') AS p`, [role, fn])).rows[0].p;
  check('anon perdeu get_public_assets', await priv('anon', 'public.get_public_assets(text)'), false);
  check('anon mantém get_public_market_assets', await priv('anon', 'public.get_public_market_assets(text)'), true);
  check('anon NÃO alcança top_assets_year (interna)', await priv('anon', 'public.top_assets_year(integer)'), false);
  check('authenticated mantém get_public_assets', await priv('authenticated', 'public.get_public_assets(text)'), true);
  check('authenticated mantém SELECT em assets_market_view',
        (await db.query("SELECT has_table_privilege('authenticated','public.assets_market_view','SELECT') AS p")).rows[0].p, true);
  check('authenticated mantém SELECT em assets',
        (await db.query("SELECT has_table_privilege('authenticated','public.assets','SELECT') AS p")).rows[0].p, true);

  const pol = await db.query(`SELECT policyname, roles::text FROM pg_policies WHERE tablename='assets' AND cmd='SELECT'`);
  check('policy de SELECT em assets agora é só para authenticated',
        pol.rows.map(r => `${r.policyname}|${r.roles}`), ['Authenticated users can view assets|{authenticated}']);

  // idempotência
  await db.exec(stripTx(faseB));
  console.log('  (FASE B reaplicada sem erro — idempotente)');
  check('reaplicar FASE B mantém o estado', await anonGrants(), []);
  await db.close();
}

// ================================================================== DESEMPENHO
console.log('\n== DESEMPENHO: current_user_market_level() roda uma vez por query? ==');
{
  const db = await fresh();
  await db.exec(stripTx(faseA));
  await db.exec(fs.readFileSync(here('seed.sql'), 'utf8'));
  const linhas = (await db.query('SELECT count(*)::int AS c FROM public.asset_analyses')).rows[0].c;

  const plan = await db.query('EXPLAIN (ANALYZE, VERBOSE, COSTS OFF, TIMING OFF) SELECT * FROM public.assets_market_view');
  const txt = plan.rows.map(r => r['QUERY PLAN']).join('\n');

  // conta NOS InitPlan (cabecalho "InitPlan N" em linha propria), nao as
  // referencias "(InitPlan N).col1" que aparecem no Output.
  const initPlans = (txt.match(/^[ \t]*InitPlan \d+[ \t]*$/gm) || []).length;
  const initLoops = [...txt.matchAll(/InitPlan \d+[\s\S]{0,40}?Result \(actual rows=[\d.]+ loops=(\d+)\)/g)].map(m => +m[1]);

  console.log(`  linhas na view: ${linhas} | nos InitPlan: ${initPlans} | loops: ${JSON.stringify([...new Set(initLoops)])}`);
  console.log(`  -> ${initPlans} avaliacoes por query, contra ${linhas * 6} se fosse por linha x campo`);

  check('plano contem InitPlan (avaliacao unica, nao por linha)', initPlans > 0, true);
  check('sao 6 InitPlans, um por campo mascarado', initPlans, 6);
  check('todo InitPlan executou loops=1', [...new Set(initLoops)], [1]);
  check('avaliacoes constantes, nao proporcionais as linhas', initPlans < linhas, true);

  // mesma verificacao com 10x mais linhas: o numero NAO pode crescer
  await db.exec(`INSERT INTO public.assets (codigo_b3, nome, tipo)
                 SELECT 'BULK'||g, 'NOME BULK '||g, 'ACAO' FROM generate_series(1,300) g;
                 INSERT INTO public.asset_analyses (asset_id, roi2026, perfil_investidor, taxa_semanal,
                        roitrim, tendencia, carteira, recomendacao, nota_especialista)
                 SELECT id, '1', 'SPECIALIST','R','T','ALTA','C','COMPRA','TOP ANO'
                 FROM public.assets WHERE codigo_b3 LIKE 'BULK%';`);
  const linhas2 = (await db.query('SELECT count(*)::int AS c FROM public.asset_analyses')).rows[0].c;
  const plan2 = await db.query('EXPLAIN (ANALYZE, VERBOSE, COSTS OFF, TIMING OFF) SELECT * FROM public.assets_market_view');
  const txt2 = plan2.rows.map(r => r['QUERY PLAN']).join('\n');
  const initPlans2 = (txt2.match(/^[ \t]*InitPlan \d+[ \t]*$/gm) || []).length;
  const initLoops2 = [...txt2.matchAll(/InitPlan \d+[\s\S]{0,40}?Result \(actual rows=[\d.]+ loops=(\d+)\)/g)].map(m => +m[1]);
  console.log(`  com ${linhas2} linhas: nos InitPlan: ${initPlans2} | loops: ${JSON.stringify([...new Set(initLoops2)])}`);
  check('10x mais linhas -> mesmo numero de avaliacoes', initPlans2, initPlans);
  check('10x mais linhas -> ainda loops=1', [...new Set(initLoops2)], [1]);

  console.log('  --- EXPLAIN ANALYZE (nos InitPlan) ---');
  console.log(txt2.split('\n').filter(l => /InitPlan \d+\s*$|Result \(actual|current_user_market_level/.test(l)).slice(0, 6).map(l => '    ' + l.trim()).join('\n'));
  await db.close();
}

console.log(`\n================ ${pass} passaram, ${fail} falharam ================`);
process.exit(fail ? 1 : 0);
