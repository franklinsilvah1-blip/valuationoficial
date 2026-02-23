import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead, { createBreadcrumbSchema, createWebPageSchema, createSpeakableSchema } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, AlertTriangle, FileText, Scale, Users, Ban, Clock, Mail } from "lucide-react";

const TermosUso = () => {
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "https://valuationit.com.br/" },
    { name: "Termos de Uso", url: "https://valuationit.com.br/termos-uso" },
  ]);

  const webPageSchema = createWebPageSchema(
    "Termos de Uso - VALUATION Invest Tech",
    "Termos de Uso da plataforma VALUATION Invest Tech. Conheça as condições de uso dos nossos serviços de consultoria de valores mobiliários.",
    "https://valuationit.com.br/termos-uso"
  );

  const speakableSchema = createSpeakableSchema("https://valuationit.com.br/termos-uso", [
    "[data-speakable='termos-title']",
    "[data-speakable='termos-intro']",
  ]);

  return (
    <>
      <SEOHead
        title="Termos de Uso | VALUATION Invest Tech"
        description="Termos de Uso da plataforma VALUATION Invest Tech. Conheça as condições de uso dos nossos serviços de consultoria de valores mobiliários."
        canonical="https://valuationit.com.br/termos-uso"
        keywords={["termos de uso", "condições de uso", "consultoria valores mobiliários", "CVM", "regulamentação"]}
        jsonLd={[breadcrumbSchema, webPageSchema, speakableSchema]}
      />
      <Navbar />
      
      <main className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-16">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-6">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl font-bold mb-4" data-speakable="termos-title">Termos de Uso</h1>
              <p className="text-lg text-muted-foreground">
                Última atualização: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-12">
          <div className="container max-w-4xl">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8 md:p-12 space-y-10">
                
                {/* Introdução */}
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed" data-speakable="termos-intro">
                    Bem-vindo à plataforma VALUATION Invest Tech. Ao acessar e utilizar nossos serviços, você concorda 
                    com os termos e condições descritos neste documento. Por favor, leia atentamente antes de utilizar 
                    nossa plataforma.
                  </p>
                </div>

                {/* Identificação do Responsável */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold">1. Identificação do Responsável</h2>
                  </div>
                  <div className="pl-12 space-y-3">
                    <p className="text-muted-foreground leading-relaxed">
                      A plataforma VALUATION Invest Tech é operada por:
                    </p>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="font-medium">Franklin Silvah</p>
                      <p className="text-muted-foreground">Consultor de Valores Mobiliários</p>
                      <p className="text-muted-foreground">Registro CVM nº <span className="font-semibold text-primary">004246-3</span></p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Você pode verificar o registro no site oficial da CVM:{" "}
                      <a 
                        href="https://www.cvm.gov.br/menu/regulados/consultores/consulta.html" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        www.cvm.gov.br
                      </a>
                    </p>
                  </div>
                </div>

                {/* Natureza dos Serviços */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Scale className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold">2. Natureza dos Serviços</h2>
                  </div>
                  <div className="pl-12 space-y-3">
                    <p className="text-muted-foreground leading-relaxed">
                      Os serviços prestados pela VALUATION Invest Tech consistem em:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-2">
                      <li>Análise e recomendação de ativos financeiros (ações, FIIs, BDRs, ETFs, entre outros)</li>
                      <li>Elaboração de carteiras recomendadas conforme perfil do investidor</li>
                      <li>Conteúdo educacional sobre investimentos</li>
                      <li>Consultoria personalizada de valores mobiliários</li>
                      <li>Ferramentas de simulação e acompanhamento de carteira</li>
                    </ul>
                    <p className="text-muted-foreground leading-relaxed">
                      Todos os serviços são prestados em conformidade com a regulamentação da Comissão de Valores 
                      Mobiliários (CVM), especialmente as Resoluções CVM nº 19 e nº 20.
                    </p>
                  </div>
                </div>

                {/* Isenção de Responsabilidade */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    </div>
                    <h2 className="text-2xl font-semibold">3. Isenção de Responsabilidade e Riscos</h2>
                  </div>
                  <div className="pl-12 space-y-4">
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg">
                      <p className="font-medium text-amber-700 dark:text-amber-400 mb-2">Aviso Importante:</p>
                      <p className="text-muted-foreground leading-relaxed">
                        Investimentos em valores mobiliários envolvem riscos e podem resultar em perdas financeiras. 
                        Rentabilidade passada não é garantia de rentabilidade futura.
                      </p>
                    </div>
                    <ul className="list-disc list-inside text-muted-foreground space-y-2">
                      <li>As análises e recomendações são baseadas em metodologias proprietárias e informações públicas disponíveis no mercado</li>
                      <li>As decisões de investimento são de responsabilidade exclusiva do usuário</li>
                      <li>Não garantimos resultados ou retornos específicos</li>
                      <li>O usuário deve avaliar seu próprio perfil de risco antes de investir</li>
                      <li>Recomendamos diversificação e acompanhamento profissional</li>
                    </ul>
                  </div>
                </div>

                {/* Obrigações do Usuário */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold">4. Obrigações do Usuário</h2>
                  </div>
                  <div className="pl-12 space-y-3">
                    <p className="text-muted-foreground leading-relaxed">
                      Ao utilizar nossa plataforma, você se compromete a:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-2">
                      <li>Fornecer informações verdadeiras e atualizadas</li>
                      <li>Manter a confidencialidade de suas credenciais de acesso</li>
                      <li>Não compartilhar ou reproduzir o conteúdo exclusivo para assinantes</li>
                      <li>Utilizar a plataforma apenas para fins lícitos e pessoais</li>
                      <li>Respeitar a propriedade intelectual de todo o conteúdo</li>
                    </ul>
                  </div>
                </div>

                {/* Condutas Proibidas */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-destructive/10">
                      <Ban className="h-5 w-5 text-destructive" />
                    </div>
                    <h2 className="text-2xl font-semibold">5. Condutas Proibidas</h2>
                  </div>
                  <div className="pl-12 space-y-3">
                    <p className="text-muted-foreground leading-relaxed">
                      É expressamente vedado ao usuário:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-2">
                      <li>Copiar, modificar ou distribuir o conteúdo sem autorização</li>
                      <li>Utilizar robôs, scrapers ou ferramentas automatizadas para coletar dados</li>
                      <li>Compartilhar acesso da conta com terceiros</li>
                      <li>Utilizar as informações para manipulação de mercado</li>
                      <li>Realizar engenharia reversa da plataforma</li>
                    </ul>
                    <p className="text-muted-foreground leading-relaxed">
                      O descumprimento destas regras pode resultar em suspensão ou cancelamento da conta, 
                      sem direito a reembolso, além de medidas legais cabíveis.
                    </p>
                  </div>
                </div>

                {/* Propriedade Intelectual */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold">6. Propriedade Intelectual</h2>
                  </div>
                  <div className="pl-12 space-y-3">
                    <p className="text-muted-foreground leading-relaxed">
                      Todo o conteúdo disponibilizado na plataforma, incluindo mas não limitado a textos, 
                      análises, gráficos, metodologias, logos e software, é de propriedade exclusiva da 
                      VALUATION Invest Tech ou de seus licenciadores.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      O acesso à plataforma não confere ao usuário qualquer direito de propriedade sobre 
                      o conteúdo, sendo permitido apenas o uso pessoal e não comercial.
                    </p>
                  </div>
                </div>

                {/* Assinaturas e Pagamentos */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold">7. Assinaturas e Pagamentos</h2>
                  </div>
                  <div className="pl-12 space-y-3">
                    <p className="text-muted-foreground leading-relaxed">
                      Os planos de assinatura são cobrados trimestralmente, conforme valores disponíveis 
                      na página de planos. O usuário pode:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-2">
                      <li>Cancelar a assinatura a qualquer momento pelo painel do cliente</li>
                      <li>Solicitar reembolso em até 7 dias após a contratação, conforme Código de Defesa do Consumidor</li>
                      <li>Fazer upgrade ou downgrade de plano a qualquer momento</li>
                    </ul>
                    <p className="text-muted-foreground leading-relaxed">
                      Os pagamentos são processados de forma segura através de processadores de pagamento 
                      certificados (Stripe).
                    </p>
                  </div>
                </div>

                {/* Modificações */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold">8. Modificações dos Termos</h2>
                  </div>
                  <div className="pl-12 space-y-3">
                    <p className="text-muted-foreground leading-relaxed">
                      A VALUATION Invest Tech reserva-se o direito de modificar estes Termos de Uso a qualquer 
                      momento. As alterações entrarão em vigor imediatamente após sua publicação na plataforma.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      Recomendamos que você revise periodicamente estes termos. O uso continuado da plataforma 
                      após alterações constitui aceitação das novas condições.
                    </p>
                  </div>
                </div>

                {/* Foro e Legislação */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Scale className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold">9. Foro e Legislação Aplicável</h2>
                  </div>
                  <div className="pl-12 space-y-3">
                    <p className="text-muted-foreground leading-relaxed">
                      Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. 
                      Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias 
                      decorrentes deste instrumento, com renúncia expressa a qualquer outro, por mais 
                      privilegiado que seja.
                    </p>
                  </div>
                </div>

                {/* Contato */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold">10. Contato</h2>
                  </div>
                  <div className="pl-12 space-y-3">
                    <p className="text-muted-foreground leading-relaxed">
                      Para dúvidas, sugestões ou reclamações sobre estes Termos de Uso, entre em contato:
                    </p>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-muted-foreground">
                        <strong>E-mail:</strong>{" "}
                        <a href="mailto:contato@valuationit.com.br" className="text-primary hover:underline">
                          contato@valuationit.com.br
                        </a>
                      </p>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default TermosUso;