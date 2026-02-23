import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead, { createBreadcrumbSchema, createWebPageSchema } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";

const PoliticaPrivacidade = () => {
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "https://valuationit.com.br/" },
    { name: "Política de Privacidade", url: "https://valuationit.com.br/politica-privacidade" },
  ]);

  const webPageSchema = createWebPageSchema(
    "Política de Privacidade - VALUATION Invest Tech",
    "Conheça nossa Política de Privacidade. Saiba como coletamos, usamos e protegemos suas informações pessoais de acordo com a LGPD.",
    "https://valuationit.com.br/politica-privacidade"
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Política de Privacidade - Proteção de Dados"
        description="Conheça nossa Política de Privacidade. Saiba como coletamos, usamos e protegemos suas informações pessoais de acordo com a LGPD."
        canonical="https://valuationit.com.br/politica-privacidade"
        keywords={["política de privacidade", "LGPD", "proteção de dados", "privacidade"]}
        jsonLd={[breadcrumbSchema, webPageSchema]}
      />
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="gradient-hero py-12">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
                Política de Privacidade
              </h1>
              <p className="text-lg text-primary-foreground/90">
                Última atualização: {new Date().toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-12">
          <div className="container">
            <Card className="max-w-4xl mx-auto">
              <CardContent className="p-8 md:p-12 prose prose-slate dark:prose-invert max-w-none">
                {/* Seção Controlador de Dados - LGPD */}
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-8 not-prose">
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="text-primary">⚖️</span> Controlador de Dados
                  </h2>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p><strong className="text-foreground">Responsável:</strong> Franklin Silvah</p>
                    <p>
                      <strong className="text-foreground">Registro CVM:</strong>{" "}
                      <span className="text-primary font-semibold">004246-3</span>
                    </p>
                    <p>
                      Consultor de Valores Mobiliários devidamente registrado e autorizado pela 
                      Comissão de Valores Mobiliários (CVM) para exercer atividade de consultoria 
                      de investimentos no Brasil.
                    </p>
                    <p>
                      <a 
                        href="https://www.cvm.gov.br/menu/regulados/consultores/consulta.html"
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Verificar registro na CVM →
                      </a>
                    </p>
                  </div>
                </div>

                <h2>1. Introdução</h2>
                <p>
                  A VALUATION Invest tech ("nós", "nosso" ou "nossa"), sob responsabilidade de 
                  Franklin Silvah, Consultor de Valores Mobiliários registrado na CVM sob o nº 004246-3, 
                  está comprometida em proteger a privacidade e segurança das informações pessoais de 
                  nossos usuários. Esta Política de Privacidade descreve como coletamos, usamos, 
                  armazenamos e protegemos suas informações em conformidade com a Lei Geral de Proteção 
                  de Dados (LGPD - Lei nº 13.709/2018).
                </p>

                <h2>2. Informações que Coletamos</h2>
                <h3>2.1 Informações Fornecidas por Você</h3>
                <ul>
                  <li>Nome completo</li>
                  <li>Endereço de e-mail</li>
                  <li>Número de telefone</li>
                  <li>Informações de pagamento (processadas por terceiros seguros)</li>
                  <li>Preferências de investimento e perfil de investidor</li>
                </ul>

                <h3>2.2 Informações Coletadas Automaticamente</h3>
                <ul>
                  <li>Endereço IP</li>
                  <li>Tipo de navegador e dispositivo</li>
                  <li>Páginas visitadas e tempo de navegação</li>
                  <li>Cookies e tecnologias similares</li>
                </ul>

                <h2>3. Como Usamos suas Informações</h2>
                <p>Utilizamos suas informações para:</p>
                <ul>
                  <li>Fornecer e melhorar nossos serviços de consultoria de investimentos</li>
                  <li>Processar transações e assinaturas</li>
                  <li>Enviar comunicações importantes sobre sua conta</li>
                  <li>Personalizar sua experiência na plataforma</li>
                  <li>Enviar newsletters e materiais educativos (com seu consentimento)</li>
                  <li>Cumprir obrigações legais e regulatórias perante a CVM e demais órgãos</li>
                </ul>

                <h2>4. Compartilhamento de Informações</h2>
                <p>
                  Não vendemos suas informações pessoais. Podemos compartilhar suas informações apenas com:
                </p>
                <ul>
                  <li>Prestadores de serviços que nos auxiliam em operações (processamento de pagamentos, 
                      hospedagem, análise de dados)</li>
                  <li>Autoridades governamentais quando exigido por lei (incluindo CVM e Receita Federal)</li>
                  <li>Parceiros comerciais com seu consentimento explícito</li>
                </ul>

                <h2>5. Segurança dos Dados</h2>
                <p>
                  Implementamos medidas de segurança técnicas e organizacionais apropriadas para proteger 
                  suas informações contra acesso não autorizado, alteração, divulgação ou destruição, incluindo:
                </p>
                <ul>
                  <li>Criptografia de dados em trânsito e em repouso</li>
                  <li>Controles de acesso rigorosos</li>
                  <li>Monitoramento contínuo de segurança</li>
                  <li>Auditorias regulares de segurança</li>
                </ul>

                <h2>6. Seus Direitos (LGPD)</h2>
                <p>De acordo com a LGPD (Lei Geral de Proteção de Dados), você tem direito a:</p>
                <ul>
                  <li>Acessar suas informações pessoais</li>
                  <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
                  <li>Solicitar a exclusão de seus dados (anonimização)</li>
                  <li>Revogar seu consentimento a qualquer momento</li>
                  <li>Solicitar a portabilidade de seus dados</li>
                  <li>Obter informações sobre o uso compartilhado de seus dados</li>
                  <li>Ser informado sobre a possibilidade de não fornecer consentimento e suas consequências</li>
                </ul>

                <h2>7. Retenção de Dados</h2>
                <p>
                  Mantemos suas informações pessoais apenas pelo tempo necessário para cumprir as 
                  finalidades descritas nesta política, a menos que um período de retenção maior seja 
                  exigido ou permitido por lei, incluindo obrigações regulatórias da CVM.
                </p>

                <h2>8. Cookies</h2>
                <p>
                  Utilizamos cookies e tecnologias similares para melhorar sua experiência. 
                  Para mais informações, consulte nossa{" "}
                  <a href="/politica-cookies" className="text-primary hover:underline">
                    Política de Cookies
                  </a>.
                </p>

                <h2>9. Alterações nesta Política</h2>
                <p>
                  Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você 
                  sobre mudanças significativas por e-mail ou através de um aviso em nosso site.
                </p>

                <h2>10. Contato e Encarregado de Dados</h2>
                <p>
                  Para exercer seus direitos, esclarecer dúvidas sobre esta política ou entrar em 
                  contato com nosso Encarregado de Proteção de Dados (DPO):
                </p>
                <ul>
                  <li><strong>Responsável:</strong> Franklin Silvah</li>
                  <li><strong>E-mail:</strong> consultoria@valuationit.com.br</li>
                  <li><strong>Telefone:</strong> (31) 9.9328-7761</li>
                  <li><strong>Registro CVM:</strong> 004246-3</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-4">
                  Você também pode verificar nosso registro profissional diretamente no{" "}
                  <a 
                    href="https://www.cvm.gov.br/menu/regulados/consultores/consulta.html"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-primary hover:underline"
                  >
                    site da CVM
                  </a>.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default PoliticaPrivacidade;