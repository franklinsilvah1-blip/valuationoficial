import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const results: Record<string, string> = {};

    // 1. subscription_plans
    const subscriptionPlans = [
      {"id":"2cbb8718-f6e6-4317-a120-a97e47d3b737","plan_code":"FREE","display_name":"Plano Gratuito","description":"Experimente grátis","price_quarterly":0,"price_note":null,"stripe_price_id":null,"features":["Visualização de até 3 ativos por dia","Acesso básico ao Mercado","Análises resumidas de ativos","Análise de perfil investidor"],"is_active":true,"sort_order":0,"created_at":"2025-12-19T13:25:11.739068+00:00","updated_at":"2025-12-19T13:25:11.739068+00:00"},
      {"id":"4a368365-d41f-4fcc-bc3c-466dca21543f","plan_code":"WEALTH","display_name":"Fale com Especialista","description":"Para investidores e empresários","price_quarterly":0,"price_note":"Consulte para valores personalizados","stripe_price_id":null,"features":["Todos os benefícios do SPECIALIST","Estratégia personalizada","Ampliação inteligente de patrimônio","Blindagem estratégica da riqueza","Mentoria exclusiva para investidores e empresas"],"is_active":true,"sort_order":4,"created_at":"2025-12-19T13:25:11.739068+00:00","updated_at":"2025-12-19T13:25:11.739068+00:00"},
      {"id":"21532296-735c-4349-9ea6-833b34088a59","plan_code":"START","display_name":"Carteira Start","description":"Para investidores iniciantes","price_quarterly":147,"price_note":"Cobrado trimestralmente (R$ 147,00 a cada 3 meses)","stripe_price_id":"price_1SPnQvRyKGDht1PjOco1Y4vh","features":["Acesso completo a plataforma","Análises detalhadas de ativos","Carteiras recomendadas START","Acesso à Conteúdos exclusivos","Suporte por email"],"is_active":true,"sort_order":1,"created_at":"2025-12-19T13:07:24.990413+00:00","updated_at":"2025-12-19T20:09:37.282721+00:00"},
      {"id":"22cc35d6-9d91-4e3b-ab8c-b2d273bc1dcb","plan_code":"PRO","display_name":"Carteira Pro","description":"Para investidores experientes","price_quarterly":297,"price_note":"Cobrado trimestralmente (R$ 297,00 a cada 3 meses)","stripe_price_id":"price_1SPnT8RyKGDht1PjyyTAXXaQ","features":["Todos os benefícios do START","Análises avançadas de ativos","Carteiras recomendadas PRO","Suporte por chat","Consultoria com Especialista"],"is_active":true,"sort_order":2,"created_at":"2025-12-19T13:07:24.990413+00:00","updated_at":"2025-12-19T20:09:37.282721+00:00"},
      {"id":"98c9557b-ca03-4f8f-9844-10e5cfdc0a01","plan_code":"SPECIALIST","display_name":"Carteira Specialist","description":"Para investidores Profissionais","price_quarterly":597,"price_note":"Cobrado trimestralmente (R$ 597,00 a cada 3 meses)","stripe_price_id":"price_1Sg2VXRyKGDht1Pj2cow0LgQ","features":["Todos os benefícios do PRO","Análises personalizadas de ativos","Carteiras recomendadas SPECIALIST","Suporte prioritário","Método X Valuation","Mentoria THE SPECIALISTS"],"is_active":true,"sort_order":3,"created_at":"2025-12-19T13:07:24.990413+00:00","updated_at":"2025-12-19T20:09:37.282721+00:00"}
    ];
    const { error: e1 } = await supabase.from("subscription_plans").upsert(subscriptionPlans, { onConflict: "id" });
    results.subscription_plans = e1 ? `ERROR: ${e1.message}` : `OK: ${subscriptionPlans.length}`;

    // 2. blog_authors
    const blogAuthors = [
      {"id":"376ffdb7-746e-4a97-8a2d-8237cf329df1","name":"Ana Silva","email":"Ana Silva","avatar_url":null,"bio":null,"created_at":"2025-11-19T16:09:03.990114+00:00","updated_at":"2025-11-19T16:09:03.990114+00:00"},
      {"id":"68a12177-4435-44f7-8c29-75f0f75812eb","name":"franklin.silvah@gmail.com","email":"franklin.silvah@gmail.com","avatar_url":null,"bio":null,"created_at":"2025-11-19T16:09:03.990114+00:00","updated_at":"2025-11-19T16:09:03.990114+00:00"},
      {"id":"4a2a7caf-a50f-47a8-a77a-e27de64967d8","name":"Carlos Mendes","email":"Carlos Mendes","avatar_url":null,"bio":null,"created_at":"2025-11-19T16:09:03.990114+00:00","updated_at":"2025-11-19T16:09:03.990114+00:00"},
      {"id":"a92307d0-e63c-4e68-9461-f6515593dfac","name":"Pedro Costa","email":"Pedro Costa","avatar_url":null,"bio":null,"created_at":"2025-11-19T16:09:03.990114+00:00","updated_at":"2025-11-19T16:09:03.990114+00:00"}
    ];
    const { error: e2 } = await supabase.from("blog_authors").upsert(blogAuthors, { onConflict: "id" });
    results.blog_authors = e2 ? `ERROR: ${e2.message}` : `OK: ${blogAuthors.length}`;

    // 3. categories
    const categories = [
      {"id":"2c033e5e-e4d7-4d37-88d0-2eeebb92712f","name":"Estratégia","slug":"estrategia","created_at":"2025-11-19T15:56:39.023791+00:00"},
      {"id":"76a6c833-c894-4efb-9d40-7d514d0bf6f5","name":"Análise de Mercado","slug":"analise-de-mercado","created_at":"2025-11-19T15:56:39.023791+00:00"},
      {"id":"433251f2-faf9-425b-ac14-aad0e895ee5a","name":"Educação","slug":"educacao","created_at":"2025-11-19T15:56:39.023791+00:00"},
      {"id":"05430a54-176c-4131-a945-11f5e8c4b28e","name":"Comparativo","slug":"comparativo","created_at":"2025-11-19T15:56:39.023791+00:00"},
      {"id":"9a121b82-d074-47a3-8cd4-169a5e5aa029","name":"Notícias","slug":"noticias","created_at":"2025-11-19T15:56:39.023791+00:00"}
    ];
    const { error: e3 } = await supabase.from("categories").upsert(categories, { onConflict: "id" });
    results.categories = e3 ? `ERROR: ${e3.message}` : `OK: ${categories.length}`;

    // 4. blog_posts
    const blogPosts = [
      {"id":"50a70864-b563-4db4-b7c4-4fb6d63ceca3","title":"FIIs ou Ações: Qual é a Melhor Opção para Você?","slug":"fiis-ou-acoes-qual-melhor-opcao","content":"# FIIs ou Ações: Qual é a Melhor Opção para Você?\n\nUma das dúvidas mais comuns entre investidores iniciantes é: devo investir em **Fundos Imobiliários (FIIs)** ou em **Ações**? A resposta depende de diversos fatores, incluindo seu perfil de investidor, objetivos financeiros e horizonte de investimento.\n\n## Fundos Imobiliários (FIIs)\n\n### Vantagens\n- **Renda passiva mensal**: Distribuição obrigatória de pelo menos 95% dos lucros\n- **Menor volatilidade**: Geralmente mais estáveis que ações\n- **Isenção de IR**: Rendimentos isentos para pessoas físicas\n- **Diversificação**: Acesso a múltiplos imóveis com baixo capital\n\n### Desvantagens\n- **Menor potencial de valorização**: Focados em distribuição, não em crescimento\n- **Risco setorial**: Dependem do mercado imobiliário\n- **Liquidez variável**: Alguns FIIs têm baixo volume de negociação\n\n## Ações\n\n### Vantagens\n- **Alto potencial de valorização**: Empresas podem multiplicar de valor\n- **Dividendos**: Algumas empresas pagam bons proventos\n- **Participação societária**: Você é dono da empresa\n- **Alta liquidez**: Fácil compra e venda\n\n### Desvantagens\n- **Alta volatilidade**: Preços podem variar muito\n- **Requer mais estudo**: Necessário analisar resultados das empresas\n- **Risco maior**: Empresas podem falir\n\n## Como Escolher?\n\n**Invista em FIIs se você**:\n- Busca renda passiva regular\n- Tem perfil conservador ou moderado\n- Quer menor volatilidade\n- Busca isenção de IR nos rendimentos\n\n**Invista em Ações se você**:\n- Busca crescimento patrimonial\n- Tem perfil mais arrojado\n- Pode suportar maior volatilidade\n- Tem horizonte de longo prazo\n\n## Conclusão\n\nNão precisa escolher apenas um! A melhor estratégia é combinar ambos em sua carteira, ajustando as proporções de acordo com seu perfil e objetivos.","excerpt":"Análise comparativa entre Fundos Imobiliários e Ações, considerando perfil de risco, liquidez e potencial de retorno.","cover_image":"https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=800&q=80","author":"Carlos Mendes","author_id":null,"published_at":"2025-11-14T15:51:53.896302+00:00","created_at":"2025-11-19T15:51:53.896302+00:00","updated_at":"2025-11-19T16:09:24.195079+00:00","status":"published","views":0,"seo_title":"FIIs ou Ações: Qual é a Melhor Opção para Você?","seo_description":"Análise comparativa entre FIIs e Ações para investidores","seo_keywords":["fiis","ações","investimentos","comparativo"],"og_image":"https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=800&q=80","scheduled_for":null,"blog_author_id":null,"featured":false},
      {"id":"c47e2b9a-264c-491a-aeef-720ba10d3fb7","title":"Tendências do Mercado Brasileiro para 2025","slug":"tendencias-mercado-brasileiro-2025","content":"# Tendências do Mercado Brasileiro para 2025\n\nO mercado financeiro brasileiro enfrenta um ano de transformações e oportunidades.","excerpt":"Nossa análise sobre as principais tendências macroeconômicas e setoriais que devem impactar a B3 no último trimestre.","cover_image":"https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80","author":"Pedro Costa","author_id":null,"published_at":"2025-11-11T15:51:53.896302+00:00","created_at":"2025-11-19T15:51:53.896302+00:00","updated_at":"2025-11-19T16:09:24.195079+00:00","status":"published","views":1,"seo_title":"Tendências do Mercado Brasileiro para 2025","seo_description":"Análise das tendências do mercado brasileiro","seo_keywords":["mercado","brasileiro","2025","tendências"],"og_image":"https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80","scheduled_for":null,"blog_author_id":null,"featured":false},
      {"id":"e45d9680-c439-4a0e-8504-99b2a2bd7f1d","title":"Como Diversificar sua Carteira de Investimentos em 2025","slug":"como-diversificar-carteira-investimentos-2025","content":"# Como Diversificar sua Carteira de Investimentos em 2025\n\nA diversificação é um dos princípios mais importantes do investimento inteligente.","excerpt":"Entenda as melhores estratégias para diversificar seus investimentos e reduzir riscos em um cenário de incertezas econômicas.","cover_image":"https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80","author":"Ana Silva","author_id":null,"published_at":"2025-11-17T15:51:53.896302+00:00","created_at":"2025-11-19T15:51:53.896302+00:00","updated_at":"2025-11-19T17:04:00.067009+00:00","status":"published","views":2,"seo_title":"Como Diversificar sua Carteira de Investimentos em 2025","seo_description":"Estratégias de diversificação de carteira","seo_keywords":["diversificação","carteira","investimentos","2025"],"og_image":"https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80","scheduled_for":null,"blog_author_id":null,"featured":false}
    ];
    const { error: e4 } = await supabase.from("blog_posts").upsert(blogPosts, { onConflict: "id" });
    results.blog_posts = e4 ? `ERROR: ${e4.message}` : `OK: ${blogPosts.length}`;

    // 5. app_config
    const appConfig = [
      {"id":"dd96ca08-df7e-4fb8-8cbe-8950c5e2b75c","key":"backup_enabled","value":"true","created_at":"2026-02-09T21:09:01.27225+00:00","updated_at":"2026-02-09T21:09:01.27225+00:00"},
      {"id":"fc340f32-2e95-4680-b128-582f68daa310","key":"admin_email","value":"franklin.silvah@gmail.com","created_at":"2025-11-05T19:44:16.384708+00:00","updated_at":"2025-12-19T00:28:00.140545+00:00"},
      {"id":"f5b958d9-86ca-428b-8015-cd9f7983db78","key":"backup_retention_days","value":"30","created_at":"2026-02-09T21:09:01.27225+00:00","updated_at":"2026-02-09T21:09:01.27225+00:00"},
      {"id":"17242a90-c916-4359-bcde-545059c952ac","key":"community_whatsapp_link","value":"https://chat.whatsapp.com/placeholder","created_at":"2025-11-04T22:08:43.628144+00:00","updated_at":"2025-11-26T17:09:21.214359+00:00"},
      {"id":"0636b48a-ebe0-4fd6-accc-617d577cd08c","key":"vapid_public_key","value":"REDACTED","created_at":"2026-01-06T19:12:29.034592+00:00","updated_at":"2026-01-06T19:12:29.034592+00:00"}
    ];
    const { error: e5 } = await supabase.from("app_config").upsert(appConfig, { onConflict: "id" });
    results.app_config = e5 ? `ERROR: ${e5.message}` : `OK: ${appConfig.length}`;

    // 6. smtp_config (without password - needs manual reconfiguration)
    const smtpConfig = [
      {"id":"eb28117a-2cad-4bae-9482-6e6eab642f64","smtp_server":"mail.valuationit.com.br","smtp_port":587,"smtp_user":"noreply@valuationit.com.br","smtp_password":"NEEDS_RECONFIGURATION","sender_name":"Franklin Silva","sender_email":"noreply@valuationit.com.br","security_type":"TLS","created_at":"2025-11-05T15:58:55.888201+00:00","updated_at":"2026-01-20T22:08:46.0487+00:00"}
    ];
    const { error: e6 } = await supabase.from("smtp_config").upsert(smtpConfig, { onConflict: "id" });
    results.smtp_config = e6 ? `ERROR: ${e6.message}` : `OK: ${smtpConfig.length} (password needs reconfiguration)`;

    // 7. tracking_scripts
    const trackingScripts = [
      {"id":"c0f8fe18-649c-4e31-b572-11496f85d039","name":"Meta","type":"facebook_pixel","script_id":"1129002725673618","script_content":null,"location":"head","is_active":true,"created_at":"2025-11-14T18:41:27.974334+00:00","updated_at":"2025-11-14T18:41:27.974334+00:00","created_by":"1be2fe0c-ce15-4fa4-85df-0cc1d39ac546"},
      {"id":"323a0ecd-1fca-4e73-bbeb-7485518697ff","name":"Analytics","type":"google_analytics","script_id":"G-QK7VNZPK38","script_content":null,"location":"head","is_active":true,"created_at":"2025-11-14T18:57:32.520659+00:00","updated_at":"2025-12-11T22:15:47.7141+00:00","created_by":"1be2fe0c-ce15-4fa4-85df-0cc1d39ac546"},
      {"id":"a6e0613c-fd6b-45ea-a342-285d8174c67f","name":"Google Tag Manager","type":"google_tag_manager","script_id":"GTM-52HNRMJB","script_content":null,"location":"head","is_active":true,"created_at":"2025-12-11T21:52:34.613024+00:00","updated_at":"2025-12-11T22:56:13.111408+00:00","created_by":"1be2fe0c-ce15-4fa4-85df-0cc1d39ac546"}
    ];
    const { error: e7 } = await supabase.from("tracking_scripts").upsert(trackingScripts, { onConflict: "id" });
    results.tracking_scripts = e7 ? `ERROR: ${e7.message}` : `OK: ${trackingScripts.length}`;

    // 8. profile_questions
    const profileQuestions = [
      {"id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","order_num":1,"text":"QUAL SEU NÍVEL DE CONHECIMENTO SOBRE INVESTIMENTOS?","type":"single_choice","created_at":"2025-11-11T17:14:23.913408+00:00"},
      {"id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","order_num":2,"text":"QUAL SEU OBJETIVO PARA INVESTIR AGORA?","type":"single_choice","created_at":"2025-11-11T17:14:23.913408+00:00"},
      {"id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","order_num":3,"text":"QUAL O VALOR QUE PRETENDE INVESTIR?","type":"single_choice","created_at":"2025-11-11T17:14:23.913408+00:00"}
    ];
    const { error: e8 } = await supabase.from("profile_questions").upsert(profileQuestions, { onConflict: "id" });
    results.profile_questions = e8 ? `ERROR: ${e8.message}` : `OK: ${profileQuestions.length}`;

    // 9. profile_options
    const profileOptions = [
      {"id":"4e74963c-5405-4696-82d4-b861c898a16c","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","text":"SÓ INVISTO EM RENDA FIXA (POUPANÇA, CDB, LCI, CRI, ETC)","weight_start":1,"weight_pro":0,"weight_specialist":0,"created_at":"2025-11-11T17:14:23.913408+00:00"},
      {"id":"b6861f72-0829-4554-a381-ee6a957dcecf","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","text":"INVISTO EM RENDA FIXA COM ISENÇÃO DE IMPOSTO DE RENDA","weight_start":1,"weight_pro":0,"weight_specialist":0,"created_at":"2025-11-11T17:14:23.913408+00:00"},
      {"id":"5426087c-12de-4288-987c-125373b3b0eb","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","text":"INVISTO FUNDO IMOBILIÁRIOS E EM ALGUMAS AÇÕES OU CRIPTOS","weight_start":0,"weight_pro":1,"weight_specialist":0,"created_at":"2025-11-11T17:14:23.913408+00:00"},
      {"id":"bfe8123e-585f-445b-b63a-85dc6d078f2a","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","text":"INVISTO EM AÇÕES, FIIs, BDRs, ETFs e CRIPTOMOEDAS","weight_start":0,"weight_pro":0,"weight_specialist":1,"created_at":"2025-11-11T17:14:23.913408+00:00"},
      {"id":"4195c419-6cdd-4601-b282-f06334be5e87","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","text":"REALIZAR UM SONHO IMEDIATO (VIAGENS, COMPRAR UM BEM, ETC...)","weight_start":1,"weight_pro":0,"weight_specialist":0,"created_at":"2025-11-11T17:14:23.913408+00:00"},
      {"id":"368040b9-2e26-469b-9333-8f146b2ec9ad","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","text":"GERAR RENDA EXTRA","weight_start":1,"weight_pro":0,"weight_specialist":0,"created_at":"2025-11-11T17:14:23.913408+00:00"},
      {"id":"23a566c3-9916-4a61-8367-47fd62f8125b","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","text":"CONSTRUIR RESERVA FINANCEIRA E PATRIMÔNIO","weight_start":0,"weight_pro":1,"weight_specialist":0,"created_at":"2025-11-11T17:14:23.913408+00:00"},
      {"id":"25d2995b-d2dd-4c6a-b55d-92e0018f3823","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","text":"MULTIPLICAR PATRIMÔNIO E INDEPENDÊNCIA FINANCEIRA","weight_start":0,"weight_pro":0,"weight_specialist":1,"created_at":"2025-11-11T17:14:23.913408+00:00"},
      {"id":"e9cb11fd-d6cb-4a11-8c69-c0aee5529fc9","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","text":"DE R$ 1.000 A R$ 9.999","weight_start":1,"weight_pro":0,"weight_specialist":0,"created_at":"2025-11-11T17:14:23.913408+00:00"},
      {"id":"a35f74d8-ef9b-452d-9ace-886c4d67aab7","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","text":"DE R$ 10.000 A R$ 49.999","weight_start":0,"weight_pro":1,"weight_specialist":0,"created_at":"2025-11-11T17:14:23.913408+00:00"},
      {"id":"93b839fd-58fc-414f-86ed-adc3b52a1f3a","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","text":"DE R$ 50.000 A R$ 99.999","weight_start":0,"weight_pro":0,"weight_specialist":1,"created_at":"2025-11-11T17:14:23.913408+00:00"},
      {"id":"fcb6c381-3baf-4d1f-ae56-5a92a1d0a0b9","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","text":"ACIMA DE R$ 100.000,00","weight_start":0,"weight_pro":0,"weight_specialist":1,"created_at":"2025-11-11T17:14:23.913408+00:00"}
    ];
    const { error: e9 } = await supabase.from("profile_options").upsert(profileOptions, { onConflict: "id" });
    results.profile_options = e9 ? `ERROR: ${e9.message}` : `OK: ${profileOptions.length}`;

    // 10. profile_answers (57 records)
    const profileAnswers = [
      {"id":"f8284196-95d2-43dd-a054-1f8f08df1ee3","user_id":"c2c8d2da-de14-4464-8e30-076359ca5632","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"bfe8123e-585f-445b-b63a-85dc6d078f2a","cycle":1,"created_at":"2025-11-11T17:15:27.097459+00:00"},
      {"id":"6205a08e-fb10-405e-a69a-8b1c5ede9dea","user_id":"c2c8d2da-de14-4464-8e30-076359ca5632","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"368040b9-2e26-469b-9333-8f146b2ec9ad","cycle":1,"created_at":"2025-11-11T17:15:27.097459+00:00"},
      {"id":"a446ec65-7011-45db-8695-be92d830489c","user_id":"c2c8d2da-de14-4464-8e30-076359ca5632","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"a35f74d8-ef9b-452d-9ace-886c4d67aab7","cycle":1,"created_at":"2025-11-11T17:15:27.097459+00:00"},
      {"id":"ef4bc74e-ede1-459e-983c-8be0b88aedd1","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"4e74963c-5405-4696-82d4-b861c898a16c","cycle":1,"created_at":"2025-11-11T23:21:41.225645+00:00"},
      {"id":"4a691988-1493-4094-926d-b067e2cf115b","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"368040b9-2e26-469b-9333-8f146b2ec9ad","cycle":1,"created_at":"2025-11-11T23:21:41.225645+00:00"},
      {"id":"a943f87a-f29d-479d-afcf-508bc2d6002c","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"e9cb11fd-d6cb-4a11-8c69-c0aee5529fc9","cycle":1,"created_at":"2025-11-11T23:21:41.225645+00:00"},
      {"id":"e3cc7e43-dfd3-4646-90f3-c54aca4e63da","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"bfe8123e-585f-445b-b63a-85dc6d078f2a","cycle":2,"created_at":"2025-11-11T23:22:10.14916+00:00"},
      {"id":"8cc05f4a-a533-4873-8f58-5e3d871b209e","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"25d2995b-d2dd-4c6a-b55d-92e0018f3823","cycle":2,"created_at":"2025-11-11T23:22:10.14916+00:00"},
      {"id":"0057d296-6838-48f8-bd78-9e1510eeab46","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"93b839fd-58fc-414f-86ed-adc3b52a1f3a","cycle":2,"created_at":"2025-11-11T23:22:10.14916+00:00"},
      {"id":"632b86b4-00bd-4197-9b0e-9f128c23383c","user_id":"b1261c5a-94ed-4a00-adff-473888885907","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"4e74963c-5405-4696-82d4-b861c898a16c","cycle":1,"created_at":"2025-11-13T17:13:08.7858+00:00"},
      {"id":"94b22ec8-ee05-482f-a093-d303e68fb70c","user_id":"b1261c5a-94ed-4a00-adff-473888885907","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"23a566c3-9916-4a61-8367-47fd62f8125b","cycle":1,"created_at":"2025-11-13T17:13:08.7858+00:00"},
      {"id":"e34f8ebd-0073-47cc-9680-ad7d8c1a4de3","user_id":"b1261c5a-94ed-4a00-adff-473888885907","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"93b839fd-58fc-414f-86ed-adc3b52a1f3a","cycle":1,"created_at":"2025-11-13T17:13:08.7858+00:00"},
      {"id":"e00be5b3-7efa-411e-ba51-5a3bc614b6a5","user_id":"f9ad01ea-bd2b-4a93-af1c-9f4b57aa9b54","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"4e74963c-5405-4696-82d4-b861c898a16c","cycle":1,"created_at":"2025-11-14T12:51:12.462775+00:00"},
      {"id":"1c6fd5e9-f1df-4dae-9de4-5efd45a9f040","user_id":"f9ad01ea-bd2b-4a93-af1c-9f4b57aa9b54","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"368040b9-2e26-469b-9333-8f146b2ec9ad","cycle":1,"created_at":"2025-11-14T12:51:12.462775+00:00"},
      {"id":"61981f2c-b3ec-4f63-8265-4047af5e554d","user_id":"f9ad01ea-bd2b-4a93-af1c-9f4b57aa9b54","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"e9cb11fd-d6cb-4a11-8c69-c0aee5529fc9","cycle":1,"created_at":"2025-11-14T12:51:12.462775+00:00"},
      {"id":"5ad8b14b-f39d-4afe-b3b6-1a77ab2790a9","user_id":"32f0e94f-ecdc-4e85-804e-9bd477db6f6f","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"4e74963c-5405-4696-82d4-b861c898a16c","cycle":1,"created_at":"2025-11-23T22:57:17.55437+00:00"},
      {"id":"33c9b222-6450-422c-bd44-6dccc9454b1f","user_id":"32f0e94f-ecdc-4e85-804e-9bd477db6f6f","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"368040b9-2e26-469b-9333-8f146b2ec9ad","cycle":1,"created_at":"2025-11-23T22:57:17.55437+00:00"},
      {"id":"c85579eb-da91-4d6e-b5db-5a1dcd83539d","user_id":"32f0e94f-ecdc-4e85-804e-9bd477db6f6f","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"e9cb11fd-d6cb-4a11-8c69-c0aee5529fc9","cycle":1,"created_at":"2025-11-23T22:57:17.55437+00:00"},
      {"id":"9518edf2-0483-42be-83e6-e2d652e7a689","user_id":"fd3642e0-afb7-41ce-90f9-f0beddd69f5d","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"b6861f72-0829-4554-a381-ee6a957dcecf","cycle":1,"created_at":"2025-11-29T00:28:01.933596+00:00"},
      {"id":"ccc9a810-ac92-48d3-b87c-bec05ce77f75","user_id":"fd3642e0-afb7-41ce-90f9-f0beddd69f5d","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"23a566c3-9916-4a61-8367-47fd62f8125b","cycle":1,"created_at":"2025-11-29T00:28:01.933596+00:00"},
      {"id":"a553f949-0000-46c9-84ee-c2efe821bf6a","user_id":"fd3642e0-afb7-41ce-90f9-f0beddd69f5d","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"e9cb11fd-d6cb-4a11-8c69-c0aee5529fc9","cycle":1,"created_at":"2025-11-29T00:28:01.933596+00:00"},
      {"id":"fd8d6651-71a1-4738-983f-bde99eb2b314","user_id":"e16f3da6-a5a5-4749-9286-1452ee6cf6e5","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"bfe8123e-585f-445b-b63a-85dc6d078f2a","cycle":1,"created_at":"2025-12-02T23:41:11.123139+00:00"},
      {"id":"1f327e5a-7942-4589-b007-de340bdd4523","user_id":"e16f3da6-a5a5-4749-9286-1452ee6cf6e5","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"25d2995b-d2dd-4c6a-b55d-92e0018f3823","cycle":1,"created_at":"2025-12-02T23:41:11.123139+00:00"},
      {"id":"53eb96eb-1175-4519-b3b7-bd9fa310cc25","user_id":"e16f3da6-a5a5-4749-9286-1452ee6cf6e5","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"e9cb11fd-d6cb-4a11-8c69-c0aee5529fc9","cycle":1,"created_at":"2025-12-02T23:41:11.123139+00:00"},
      {"id":"72fb4f8c-499f-4bc4-ba47-bbda972b6f82","user_id":"3d4f0970-16b1-494e-be1e-6f2aee52ec59","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"5426087c-12de-4288-987c-125373b3b0eb","cycle":1,"created_at":"2025-12-05T18:44:30.972787+00:00"},
      {"id":"d03756ab-b2a8-4745-974f-4b173db3d0de","user_id":"3d4f0970-16b1-494e-be1e-6f2aee52ec59","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"25d2995b-d2dd-4c6a-b55d-92e0018f3823","cycle":1,"created_at":"2025-12-05T18:44:30.972787+00:00"},
      {"id":"8fa672be-bf34-4af7-bb73-f03a2137909d","user_id":"3d4f0970-16b1-494e-be1e-6f2aee52ec59","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"e9cb11fd-d6cb-4a11-8c69-c0aee5529fc9","cycle":1,"created_at":"2025-12-05T18:44:30.972787+00:00"},
      {"id":"8220153e-073b-4b54-ae21-6cafff2c177a","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"4e74963c-5405-4696-82d4-b861c898a16c","cycle":1,"created_at":"2025-12-07T23:34:21.204559+00:00"},
      {"id":"236b0451-2ae1-4e12-8968-d3daea319064","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"25d2995b-d2dd-4c6a-b55d-92e0018f3823","cycle":1,"created_at":"2025-12-07T23:34:21.204559+00:00"},
      {"id":"9050b28d-9c9f-45b4-a2c5-86affa16f476","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"93b839fd-58fc-414f-86ed-adc3b52a1f3a","cycle":1,"created_at":"2025-12-07T23:34:21.204559+00:00"},
      {"id":"c0f36da0-9d64-4d05-9c52-a27ed333225c","user_id":"d0822fc1-2c9c-4166-83fa-9e4b7fe12370","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"b6861f72-0829-4554-a381-ee6a957dcecf","cycle":1,"created_at":"2025-12-13T15:53:30.516673+00:00"},
      {"id":"a016109b-4610-423b-9696-1c0d3e416e3d","user_id":"d0822fc1-2c9c-4166-83fa-9e4b7fe12370","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"23a566c3-9916-4a61-8367-47fd62f8125b","cycle":1,"created_at":"2025-12-13T15:53:30.516673+00:00"},
      {"id":"43e3ade1-8734-47fc-9508-6120fdca030a","user_id":"d0822fc1-2c9c-4166-83fa-9e4b7fe12370","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"a35f74d8-ef9b-452d-9ace-886c4d67aab7","cycle":1,"created_at":"2025-12-13T15:53:30.516673+00:00"},
      {"id":"5956b785-3595-40d7-a12d-2f0ed1078c8d","user_id":"d0822fc1-2c9c-4166-83fa-9e4b7fe12370","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"5426087c-12de-4288-987c-125373b3b0eb","cycle":2,"created_at":"2025-12-13T15:54:04.104514+00:00"},
      {"id":"b31f6c31-841b-4b82-9087-4ff0021f767a","user_id":"d0822fc1-2c9c-4166-83fa-9e4b7fe12370","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"23a566c3-9916-4a61-8367-47fd62f8125b","cycle":2,"created_at":"2025-12-13T15:54:04.104514+00:00"},
      {"id":"518858bb-822d-4d7c-a905-8ad96fff8897","user_id":"d0822fc1-2c9c-4166-83fa-9e4b7fe12370","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"fcb6c381-3baf-4d1f-ae56-5a92a1d0a0b9","cycle":2,"created_at":"2025-12-13T15:54:04.104514+00:00"},
      {"id":"f65ca77f-254d-4b59-8386-cf1fb8a978db","user_id":"5ff6bc6d-bfca-41d5-b46f-bee2fbdcdd6b","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"4e74963c-5405-4696-82d4-b861c898a16c","cycle":1,"created_at":"2026-01-02T23:25:50.507818+00:00"},
      {"id":"52470b08-ac49-4a87-a09d-14c4e1d262df","user_id":"5ff6bc6d-bfca-41d5-b46f-bee2fbdcdd6b","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"368040b9-2e26-469b-9333-8f146b2ec9ad","cycle":1,"created_at":"2026-01-02T23:25:50.507818+00:00"},
      {"id":"89cc2e18-2f0c-40dd-a917-d0e497a815dd","user_id":"5ff6bc6d-bfca-41d5-b46f-bee2fbdcdd6b","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"e9cb11fd-d6cb-4a11-8c69-c0aee5529fc9","cycle":1,"created_at":"2026-01-02T23:25:50.507818+00:00"},
      {"id":"28089f69-195b-4f54-8094-618b0adf2eaf","user_id":"31da3015-6bb7-4eb9-8b9b-94eb02139259","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"4e74963c-5405-4696-82d4-b861c898a16c","cycle":1,"created_at":"2026-01-20T20:05:23.007986+00:00"},
      {"id":"05327bb4-4445-4f3a-8600-3f389a3100cf","user_id":"31da3015-6bb7-4eb9-8b9b-94eb02139259","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"368040b9-2e26-469b-9333-8f146b2ec9ad","cycle":1,"created_at":"2026-01-20T20:05:23.007986+00:00"},
      {"id":"19cee294-e4f1-42c1-934a-869f256bfae3","user_id":"31da3015-6bb7-4eb9-8b9b-94eb02139259","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"e9cb11fd-d6cb-4a11-8c69-c0aee5529fc9","cycle":1,"created_at":"2026-01-20T20:05:23.007986+00:00"},
      {"id":"9b001466-a307-4ece-8847-158d93c8e1db","user_id":"bf3da3ee-9564-4d0c-a54a-2c40d6513a2f","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"4e74963c-5405-4696-82d4-b861c898a16c","cycle":1,"created_at":"2026-01-26T14:46:00.76167+00:00"},
      {"id":"2f7ea6d0-a7f0-4f9b-b6c2-fbb6f13b8315","user_id":"bf3da3ee-9564-4d0c-a54a-2c40d6513a2f","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"368040b9-2e26-469b-9333-8f146b2ec9ad","cycle":1,"created_at":"2026-01-26T14:46:00.76167+00:00"},
      {"id":"0f3069ac-d4a8-42aa-8379-3583f8eaad35","user_id":"bf3da3ee-9564-4d0c-a54a-2c40d6513a2f","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"a35f74d8-ef9b-452d-9ace-886c4d67aab7","cycle":1,"created_at":"2026-01-26T14:46:00.76167+00:00"},
      {"id":"012d861b-0c70-4c51-8993-0d54b614b86e","user_id":"a9cb8650-e54b-40eb-b72a-34df1a69459f","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"bfe8123e-585f-445b-b63a-85dc6d078f2a","cycle":1,"created_at":"2026-01-27T18:14:38.365806+00:00"},
      {"id":"7093a9b4-bf08-4886-b38e-0b22ef93c673","user_id":"a9cb8650-e54b-40eb-b72a-34df1a69459f","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"25d2995b-d2dd-4c6a-b55d-92e0018f3823","cycle":1,"created_at":"2026-01-27T18:14:38.365806+00:00"},
      {"id":"740f5c8c-3da6-49bb-ab61-ffe074830b68","user_id":"a9cb8650-e54b-40eb-b72a-34df1a69459f","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"a35f74d8-ef9b-452d-9ace-886c4d67aab7","cycle":1,"created_at":"2026-01-27T18:14:38.365806+00:00"},
      {"id":"7d6298d0-7b71-4e8a-9a32-78b9d7a81a97","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"4e74963c-5405-4696-82d4-b861c898a16c","cycle":2,"created_at":"2026-01-31T12:37:31.110024+00:00"},
      {"id":"60568e72-8d41-4f47-918d-0d2e072c01c1","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"368040b9-2e26-469b-9333-8f146b2ec9ad","cycle":2,"created_at":"2026-01-31T12:37:31.110024+00:00"},
      {"id":"dc09fd34-4089-405e-a24f-3893ff2e5bd5","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"a35f74d8-ef9b-452d-9ace-886c4d67aab7","cycle":2,"created_at":"2026-01-31T12:37:31.110024+00:00"},
      {"id":"0f465e94-07d6-4ed9-b859-22b6de5bea87","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"bfe8123e-585f-445b-b63a-85dc6d078f2a","cycle":3,"created_at":"2026-02-10T02:05:26.880067+00:00"},
      {"id":"c18cbc49-8438-48ed-98d6-07f7595cb6de","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"25d2995b-d2dd-4c6a-b55d-92e0018f3823","cycle":3,"created_at":"2026-02-10T02:05:26.880067+00:00"},
      {"id":"26dc84ea-6794-4f75-bd04-6b216a10e8ce","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"fcb6c381-3baf-4d1f-ae56-5a92a1d0a0b9","cycle":3,"created_at":"2026-02-10T02:05:26.880067+00:00"},
      {"id":"a4fe9460-0f06-4e56-ab51-3859aaab73eb","user_id":"a97ad1b9-8b24-4599-92b5-ba46aac3e962","question_id":"0b52aa8a-676c-4af8-9787-9dbe1de7cb90","option_id":"4e74963c-5405-4696-82d4-b861c898a16c","cycle":1,"created_at":"2026-02-10T20:09:24.442066+00:00"},
      {"id":"15f9bf3a-b0b4-40a4-af0b-cb9486931046","user_id":"a97ad1b9-8b24-4599-92b5-ba46aac3e962","question_id":"a33891cb-5d1f-4af9-a3df-d38f6267b1eb","option_id":"23a566c3-9916-4a61-8367-47fd62f8125b","cycle":1,"created_at":"2026-02-10T20:09:24.442066+00:00"},
      {"id":"c7beb36d-7d4d-47f4-9503-f06b7fe9ade1","user_id":"a97ad1b9-8b24-4599-92b5-ba46aac3e962","question_id":"d8bda8d9-8b45-461e-b47e-f9e51994141c","option_id":"e9cb11fd-d6cb-4a11-8c69-c0aee5529fc9","cycle":1,"created_at":"2026-02-10T20:09:24.442066+00:00"}
    ];
    // Insert in batches of 20
    for (let i = 0; i < profileAnswers.length; i += 20) {
      const batch = profileAnswers.slice(i, i + 20);
      const { error } = await supabase.from("profile_answers").upsert(batch, { onConflict: "id" });
      if (error) {
        results.profile_answers = `ERROR at batch ${i}: ${error.message}`;
        break;
      }
    }
    if (!results.profile_answers) results.profile_answers = `OK: ${profileAnswers.length}`;

    // 11. asset_favorites (31 records)
    const assetFavorites = [
      {"id":"4c9322c7-d863-4051-a8f1-621514345621","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"ca2cac9b-a1d2-4fcd-a9b8-99f4ece18221","created_at":"2026-02-09T20:16:32.769966+00:00"},
      {"id":"188f51b6-dadb-4a8f-ad92-e8597f4940fa","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"247c5bfc-ec6f-4e66-b8d8-18e5f0a02e96","created_at":"2026-02-09T20:18:45.883448+00:00"},
      {"id":"0e3d98bd-33cf-453b-9eda-23ae4bde3b27","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"75e24684-64b5-4b03-873e-d1f496051af7","created_at":"2026-02-09T20:18:46.939876+00:00"},
      {"id":"ff23b415-c202-47a3-8d8b-634df2a13f40","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"b586ea9a-299b-4474-b86e-4771a086bf18","created_at":"2026-02-09T20:20:26.235037+00:00"},
      {"id":"e7d7b485-f571-4967-b79a-511e192b4172","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"ba7fe1f9-e53b-417f-92dd-9b51a7863ff5","created_at":"2026-02-09T20:20:42.884541+00:00"},
      {"id":"d69107f9-6fe7-4d21-a39b-552b37d74ca8","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"24d3c40d-24f4-4866-a1d5-d58b03416030","created_at":"2026-02-09T20:21:04.155591+00:00"},
      {"id":"1aaccada-c22d-486d-aff8-395c907e7de9","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"6a43b370-419d-41ee-9eb8-de303b1b1097","created_at":"2026-02-09T20:21:05.228398+00:00"},
      {"id":"b1233509-dfbf-42eb-82b0-5c84335eaf9e","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"d0e52411-d1c1-4619-9f76-1ad82b4332d6","created_at":"2026-02-09T20:21:23.812694+00:00"},
      {"id":"639dbf91-91f5-4cbb-b5ce-c95421928ba7","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"0d6137b8-4c32-4b02-a87c-a20552c44926","created_at":"2026-02-09T20:21:35.250706+00:00"},
      {"id":"533edfc0-bc2e-4e16-a14b-b252f82a8a6f","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"ccb565c9-140c-4a4d-8568-0c3add365759","created_at":"2026-02-09T20:21:49.017912+00:00"},
      {"id":"c30b4d72-00fd-434d-bf55-47a3829560ac","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"90ddd519-6ff6-4898-a987-8a79539f73b7","created_at":"2026-02-09T20:22:02.768071+00:00"},
      {"id":"df1c6727-4a29-4488-853b-c150721c82ed","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"2367e0d8-2b91-4308-a315-964560cd393b","created_at":"2026-02-09T20:22:18.666473+00:00"},
      {"id":"ad79fc37-fc14-4793-a05e-0a394cee27b4","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"b16719c2-8543-4ecd-93c2-a68317a70533","created_at":"2026-02-09T20:22:29.291859+00:00"},
      {"id":"d11d0bf5-fa28-44be-8db4-423377567a04","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"090300d6-61cf-46dd-b75f-ebfd5090cc46","created_at":"2026-02-09T20:22:48.37574+00:00"},
      {"id":"bec208cb-6388-4ad8-bec0-81550471aaef","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","asset_id":"03007e4c-3a10-421e-8474-d7a668ab0c62","created_at":"2026-02-09T20:23:04.565698+00:00"},
      {"id":"d98d6df8-c34e-4d92-9472-ea29cbef5900","user_id":"3d4f0970-16b1-494e-be1e-6f2aee52ec59","asset_id":"96527003-8911-40fb-b1dd-23727f762716","created_at":"2026-02-11T20:01:42.434182+00:00"},
      {"id":"8dd88005-d038-473d-aed9-0f71a717d809","user_id":"3d4f0970-16b1-494e-be1e-6f2aee52ec59","asset_id":"bd7d4156-f83c-4682-b65a-429c1289ea94","created_at":"2026-02-11T20:02:23.612161+00:00"},
      {"id":"29344ecf-898e-4188-9892-0cac43081cf1","user_id":"3d4f0970-16b1-494e-be1e-6f2aee52ec59","asset_id":"aa8cc201-2432-4a75-a759-b9a5d8723824","created_at":"2026-02-11T20:03:43.757971+00:00"},
      {"id":"7f39e06b-20aa-4a74-aedf-e9e926f48b2a","user_id":"3d4f0970-16b1-494e-be1e-6f2aee52ec59","asset_id":"2ac96058-a113-48f9-8829-c00010af3af1","created_at":"2026-02-11T20:04:47.075858+00:00"},
      {"id":"095e96e8-1861-44b9-b7ec-6ab46b37f4ac","user_id":"3d4f0970-16b1-494e-be1e-6f2aee52ec59","asset_id":"80393bdc-0f7b-4436-8d83-809a34a9c21f","created_at":"2026-02-11T20:05:18.643818+00:00"},
      {"id":"070254a0-fcf7-4846-894a-3d4211b7afe4","user_id":"3d4f0970-16b1-494e-be1e-6f2aee52ec59","asset_id":"75e24684-64b5-4b03-873e-d1f496051af7","created_at":"2026-02-11T20:05:41.368914+00:00"},
      {"id":"4f7e4d39-8c50-4cfe-95dd-0023e1c593ea","user_id":"3d4f0970-16b1-494e-be1e-6f2aee52ec59","asset_id":"be4426ad-1679-4f41-bb3c-7c618851e759","created_at":"2026-02-11T20:06:15.678593+00:00"},
      {"id":"cd9977b2-1bd8-4baf-a714-07efb48062e3","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","asset_id":"d0e52411-d1c1-4619-9f76-1ad82b4332d6","created_at":"2026-02-12T20:54:35.215906+00:00"},
      {"id":"ac983c6b-1b43-4260-8ad2-40e10e779c3c","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","asset_id":"0d6137b8-4c32-4b02-a87c-a20552c44926","created_at":"2026-02-12T20:56:12.319704+00:00"},
      {"id":"bc246e84-fab6-48b3-8bf0-df260e629889","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","asset_id":"ff70e513-670a-4915-bce0-dc8a19e99b94","created_at":"2026-02-12T20:56:28.753168+00:00"},
      {"id":"0fa57542-6f62-46b8-ac68-3b2c5c78837a","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","asset_id":"ccb565c9-140c-4a4d-8568-0c3add365759","created_at":"2026-02-12T20:58:09.173898+00:00"},
      {"id":"9aaf06fb-b26d-4afb-a608-f19b9b23801f","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","asset_id":"03007e4c-3a10-421e-8474-d7a668ab0c62","created_at":"2026-02-12T20:58:11.574304+00:00"},
      {"id":"58935625-e415-4e7b-81ca-76f4794e6a99","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","asset_id":"7c9b60d9-ef30-4f87-920d-456293462811","created_at":"2026-02-12T21:22:45.32045+00:00"},
      {"id":"d7ec826c-2313-4305-aef5-b6ae4cd3218c","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","asset_id":"247c5bfc-ec6f-4e66-b8d8-18e5f0a02e96","created_at":"2026-02-12T21:28:51.944844+00:00"},
      {"id":"b1d2b2e1-293a-438c-b898-581a35c5dfb6","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","asset_id":"b586ea9a-299b-4474-b86e-4771a086bf18","created_at":"2026-02-12T21:35:23.679554+00:00"},
      {"id":"4a5ff6dc-d0a9-4e29-a732-be7e90b5dbfd","user_id":"b6e10ed9-f2ca-435e-a96c-ce9bec03e0f5","asset_id":"522b8f6a-d9ef-4ee6-9c99-ec856f552b12","created_at":"2026-02-12T21:35:41.200773+00:00"}
    ];
    for (let i = 0; i < assetFavorites.length; i += 20) {
      const batch = assetFavorites.slice(i, i + 20);
      const { error } = await supabase.from("asset_favorites").upsert(batch, { onConflict: "id" });
      if (error) {
        results.asset_favorites = `ERROR at batch ${i}: ${error.message}`;
        break;
      }
    }
    if (!results.asset_favorites) results.asset_favorites = `OK: ${assetFavorites.length}`;

    // 12. affiliates
    const affiliates = [
      {"id":"0a7944e4-b2b8-4505-a2c0-ee5dc7511ab0","user_id":"d0822fc1-2c9c-4166-83fa-9e4b7fe12370","affiliate_code":"87067ED6","commission_rate":10,"status":"active","total_referrals":0,"total_earnings":0,"created_at":"2025-12-18T23:39:23.518541+00:00","updated_at":"2025-12-18T23:39:23.518541+00:00","last_revenue_at":null,"last_inactivity_notification":null,"rejection_reason":null},
      {"id":"3c9abcb0-8bfb-4d09-8a17-180d176a2c4e","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","affiliate_code":"7ECD3A58","commission_rate":10,"status":"active","total_referrals":0,"total_earnings":0,"created_at":"2026-01-05T16:11:06.723802+00:00","updated_at":"2026-01-09T14:18:46.99436+00:00","last_revenue_at":null,"last_inactivity_notification":null,"rejection_reason":null},
      {"id":"3cc7b214-cda3-4a8f-ac4f-bedf28d69592","user_id":"32f0e94f-ecdc-4e85-804e-9bd477db6f6f","affiliate_code":"1A1B2F41","commission_rate":10,"status":"active","total_referrals":0,"total_earnings":0,"created_at":"2026-01-19T13:13:44.459061+00:00","updated_at":"2026-01-19T13:15:13.732986+00:00","last_revenue_at":null,"last_inactivity_notification":null,"rejection_reason":null},
      {"id":"1c6ebd2e-7c06-4dac-86f3-e60d021ded1a","user_id":"1be2fe0c-ce15-4fa4-85df-0cc1d39ac546","affiliate_code":"060323F0","commission_rate":10,"status":"active","total_referrals":0,"total_earnings":0,"created_at":"2026-01-20T19:33:46.865078+00:00","updated_at":"2026-01-20T19:35:39.685479+00:00","last_revenue_at":null,"last_inactivity_notification":null,"rejection_reason":null},
      {"id":"d6a37ed7-5162-4a6c-9226-5e8d9e677d9b","user_id":"f9ad01ea-bd2b-4a93-af1c-9f4b57aa9b54","affiliate_code":"3D87132D","commission_rate":10,"status":"active","total_referrals":0,"total_earnings":0,"created_at":"2026-01-21T12:18:39.381992+00:00","updated_at":"2026-01-21T12:19:57.378573+00:00","last_revenue_at":null,"last_inactivity_notification":null,"rejection_reason":null}
    ];
    const { error: e12 } = await supabase.from("affiliates").upsert(affiliates, { onConflict: "id" });
    results.affiliates = e12 ? `ERROR: ${e12.message}` : `OK: ${affiliates.length}`;

    // 13. notification_groups
    const notificationGroups = [
      {"id":"9b0ff3aa-8bf2-4852-a0bb-7a7211ba2711","name":"Admin teste","description":null,"created_at":"2026-01-06T18:45:23.114829+00:00","updated_at":"2026-01-06T18:45:23.114829+00:00"}
    ];
    const { error: e13 } = await supabase.from("notification_groups").upsert(notificationGroups, { onConflict: "id" });
    results.notification_groups = e13 ? `ERROR: ${e13.message}` : `OK: ${notificationGroups.length}`;

    // 14. notification_group_members
    const notificationGroupMembers = [
      {"id":"eb43b8c1-7c00-4071-adab-8e9c285ff5c2","group_id":"9b0ff3aa-8bf2-4852-a0bb-7a7211ba2711","user_id":"1be2fe0c-ce15-4fa4-85df-0cc1d39ac546","created_at":"2026-01-06T18:45:34.688728+00:00"},
      {"id":"560f5ae0-7939-4620-80b7-4578c3de764f","group_id":"9b0ff3aa-8bf2-4852-a0bb-7a7211ba2711","user_id":"ef8aec0a-bfef-4751-a2b1-2f304460c1c7","created_at":"2026-01-06T18:51:23.534579+00:00"}
    ];
    const { error: e14 } = await supabase.from("notification_group_members").upsert(notificationGroupMembers, { onConflict: "id" });
    results.notification_group_members = e14 ? `ERROR: ${e14.message}` : `OK: ${notificationGroupMembers.length}`;

    // 15. push_notifications
    const pushNotifications = [
      {"id":"b11cd97e-4d4b-419c-ba94-c6ae9120aaca","title":"Teste","message":"testando mensagem","icon":"https://valuationit.com.br/favicon.png","url":"https://valuationit.com.br/","target_audience":"group","target_plan":null,"is_active":true,"sent_at":"2026-01-06T19:13:35.581+00:00","sent_count":0,"created_at":"2026-01-06T14:20:59.114807+00:00","updated_at":"2026-01-06T19:13:35.663492+00:00","created_by":null,"target_group_id":"9b0ff3aa-8bf2-4852-a0bb-7a7211ba2711"}
    ];
    const { error: e15 } = await supabase.from("push_notifications").upsert(pushNotifications, { onConflict: "id" });
    results.push_notifications = e15 ? `ERROR: ${e15.message}` : `OK: ${pushNotifications.length}`;

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
