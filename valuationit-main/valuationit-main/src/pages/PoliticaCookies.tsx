import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead, { createBreadcrumbSchema, createWebPageSchema } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";

const PoliticaCookies = () => {
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "https://valuationit.com.br/" },
    { name: "Política de Cookies", url: "https://valuationit.com.br/politica-cookies" },
  ]);

  const webPageSchema = createWebPageSchema(
    "Política de Cookies - VALUATION Invest Tech",
    "Entenda como utilizamos cookies e tecnologias de rastreamento em nosso site. Saiba como gerenciar suas preferências de privacidade.",
    "https://valuationit.com.br/politica-cookies"
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Política de Cookies - Uso de Cookies e Rastreadores"
        description="Entenda como utilizamos cookies e tecnologias de rastreamento em nosso site. Saiba como gerenciar suas preferências de privacidade."
        canonical="https://valuationit.com.br/politica-cookies"
        keywords={["cookies", "política de cookies", "rastreamento", "privacidade online"]}
        jsonLd={[breadcrumbSchema, webPageSchema]}
      />
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="gradient-hero py-12">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
                Política de Cookies
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
              <CardContent className="p-8 md:p-12 prose prose-slate max-w-none">
                <h2>1. O que são Cookies?</h2>
                <p>
                  Cookies são pequenos arquivos de texto que são armazenados no seu navegador ou 
                  dispositivo quando você visita nosso site. Eles nos ajudam a fornecer uma melhor 
                  experiência de navegação, analisar o uso do site e personalizar conteúdo.
                </p>

                <h2>2. Tipos de Cookies que Utilizamos</h2>
                
                <h3>2.1 Cookies Essenciais</h3>
                <p>
                  Necessários para o funcionamento básico do site. Sem esses cookies, partes do 
                  site podem não funcionar corretamente.
                </p>
                <ul>
                  <li>Cookies de autenticação e segurança</li>
                  <li>Cookies de preferências do usuário</li>
                  <li>Cookies de carrinho de compras</li>
                </ul>

                <h3>2.2 Cookies de Desempenho</h3>
                <p>
                  Coletam informações sobre como os visitantes usam nosso site, permitindo-nos 
                  melhorar o desempenho e a funcionalidade.
                </p>
                <ul>
                  <li>Google Analytics</li>
                  <li>Análise de velocidade de carregamento</li>
                  <li>Monitoramento de erros</li>
                </ul>

                <h3>2.3 Cookies de Funcionalidade</h3>
                <p>
                  Permitem que o site lembre suas escolhas (como idioma, região ou preferências) 
                  e forneça recursos aprimorados e personalizados.
                </p>
                <ul>
                  <li>Preferências de idioma</li>
                  <li>Configurações de exibição</li>
                  <li>Histórico de navegação</li>
                </ul>

                <h3>2.4 Cookies de Marketing</h3>
                <p>
                  Usados para rastrear visitantes em sites e exibir anúncios relevantes e envolventes. 
                  Esses cookies requerem seu consentimento.
                </p>
                <ul>
                  <li>Publicidade direcionada</li>
                  <li>Rastreamento de conversões</li>
                  <li>Remarketing</li>
                </ul>

                <h2>3. Duração dos Cookies</h2>
                
                <h3>3.1 Cookies de Sessão</h3>
                <p>
                  Temporários e são excluídos quando você fecha o navegador. Usados principalmente 
                  para manter sua sessão ativa durante a navegação.
                </p>

                <h3>3.2 Cookies Persistentes</h3>
                <p>
                  Permanecem no seu dispositivo por um período específico ou até serem excluídos manualmente. 
                  Usados para lembrar suas preferências entre visitas.
                </p>

                <h2>4. Cookies de Terceiros</h2>
                <p>
                  Além dos nossos próprios cookies, podemos usar cookies de terceiros de parceiros 
                  confiáveis para os seguintes fins:
                </p>
                <ul>
                  <li><strong>Google Analytics:</strong> Para análise de tráfego e comportamento do usuário</li>
                  <li><strong>Stripe:</strong> Para processamento seguro de pagamentos</li>
                  <li><strong>Supabase:</strong> Para autenticação e gerenciamento de dados</li>
                </ul>

                <h2>5. Como Gerenciar Cookies</h2>
                <p>
                  Você pode controlar e/ou excluir cookies conforme desejar. Você pode excluir todos 
                  os cookies que já estão no seu computador e configurar a maioria dos navegadores 
                  para impedir que sejam colocados.
                </p>

                <h3>5.1 Configurações do Navegador</h3>
                <ul>
                  <li><strong>Chrome:</strong> Configurações → Privacidade e segurança → Cookies</li>
                  <li><strong>Firefox:</strong> Opções → Privacidade e Segurança → Cookies</li>
                  <li><strong>Safari:</strong> Preferências → Privacidade → Cookies</li>
                  <li><strong>Edge:</strong> Configurações → Cookies e permissões de site</li>
                </ul>

                <h3>5.2 Ferramentas de Opt-out</h3>
                <p>Para opt-out de cookies de análise e publicidade:</p>
                <ul>
                  <li>
                    <a 
                      href="https://tools.google.com/dlpage/gaoptout" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Google Analytics Opt-out
                    </a>
                  </li>
                </ul>

                <h2>6. Impacto de Desabilitar Cookies</h2>
                <p>
                  Se você optar por desabilitar cookies, algumas funcionalidades do nosso site 
                  podem não funcionar corretamente:
                </p>
                <ul>
                  <li>Você pode precisar fazer login novamente em cada visita</li>
                  <li>Suas preferências não serão salvas</li>
                  <li>Alguns recursos personalizados podem não estar disponíveis</li>
                  <li>O desempenho do site pode ser afetado</li>
                </ul>

                <h2>7. Atualizações desta Política</h2>
                <p>
                  Podemos atualizar esta Política de Cookies periodicamente para refletir mudanças 
                  em nossas práticas ou por outros motivos operacionais, legais ou regulatórios. 
                  Recomendamos que você revise esta página regularmente.
                </p>

                <h2>8. Consentimento</h2>
                <p>
                  Ao continuar a usar nosso site, você concorda com o uso de cookies conforme 
                  descrito nesta política. Você pode retirar seu consentimento a qualquer momento 
                  através das configurações do seu navegador.
                </p>

                <h2>9. Contato</h2>
                <p>
                  Se você tiver dúvidas sobre nossa Política de Cookies, entre em contato:
                </p>
                <ul>
                  <li>E-mail: consultoria@valuationit.com.br</li>
                  <li>Telefone: (31) 9.9328-7761</li>
                </ul>

                <p className="mt-8">
                  Para mais informações sobre como tratamos seus dados pessoais, consulte nossa{" "}
                  <a href="/politica-privacidade" className="text-primary hover:underline">
                    Política de Privacidade
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

export default PoliticaCookies;