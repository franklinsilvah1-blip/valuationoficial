import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead, { createBreadcrumbSchema, createWebPageSchema } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Users, 
  UserCheck, 
  DollarSign, 
  Ban, 
  ClipboardCheck, 
  Shield, 
  Clock, 
  FileText, 
  AlertTriangle, 
  XCircle, 
  Mail, 
  Scale,
  CheckCircle2
} from "lucide-react";

const TermosAfiliado = () => {
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "https://valuationit.com.br/" },
    { name: "Termos do Programa de Afiliados", url: "https://valuationit.com.br/termos-afiliado" },
  ]);

  const webPageSchema = createWebPageSchema(
    "Termos do Programa de Afiliados - VALUATION Invest Tech",
    "Conheça os termos e condições do Programa de Afiliados da Valuation Invest Tech. Regras, comissões, proibições e diretrizes para afiliados.",
    "https://valuationit.com.br/termos-afiliado"
  );

  const formatDate = () => {
    return new Date().toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Termos do Programa de Afiliados"
        description="Conheça os termos e condições do Programa de Afiliados da Valuation Invest Tech. Regras, comissões, proibições e diretrizes para afiliados."
        canonical="https://valuationit.com.br/termos-afiliado"
        keywords={["programa de afiliados", "termos afiliados", "comissões", "marketing de afiliados"]}
        jsonLd={[breadcrumbSchema, webPageSchema]}
      />
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-16">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <div className="flex justify-center mb-6">
                <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                  <Users className="h-10 w-10 text-primary" />
                </div>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                Termos do Programa de Afiliados
              </h1>
              <p className="text-muted-foreground">
                Última atualização: {formatDate()}
              </p>
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="py-12">
          <div className="container">
            <Card className="max-w-4xl mx-auto border-0 shadow-lg">
              <CardContent className="p-8 md:p-12 space-y-10">
                
                {/* 1. Visão Geral */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">1. Visão Geral do Programa</h2>
                  </div>
                  <div className="pl-12">
                    <p className="text-muted-foreground leading-relaxed">
                      O Programa de Afiliados da VALUATION Invest Tech permite que usuários cadastrados 
                      indiquem novos clientes para a plataforma e recebam comissões sobre as assinaturas 
                      realizadas através de seus links de indicação exclusivos.
                    </p>
                  </div>
                </div>

                {/* 2. Elegibilidade */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <UserCheck className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">2. Elegibilidade</h2>
                  </div>
                  <div className="pl-12 space-y-4">
                    <p className="text-muted-foreground">Para participar do Programa de Afiliados, você deve:</p>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span>Ser maior de 18 anos</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span>Possuir uma conta ativa na plataforma VALUATION Invest Tech</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span>Concordar integralmente com estes Termos</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span>Fornecer informações bancárias válidas para recebimento de comissões</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span>Residir em território brasileiro</span>
                      </li>
                    </ul>
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm text-muted-foreground">
                        A Valuation Invest Tech reserva-se o direito de deferir ou indeferir solicitações 
                        de participação que não atendam aos termos deste contrato, independentemente de 
                        justificativa prévia.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Comissões e Pagamentos */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">3. Comissões e Pagamentos</h2>
                  </div>
                  <div className="pl-12 space-y-6">
                    
                    {/* 3.1 */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-foreground">3.1 Estrutura de Comissões</h3>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400">•</span>
                          <span>A taxa de comissão padrão é de <strong className="text-foreground">10% sobre o valor da primeira assinatura</strong> de cada cliente indicado</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400">•</span>
                          <span>A comissão é calculada sobre o valor líquido da transação (excluindo impostos e taxas de processamento)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400">•</span>
                          <span>Taxas especiais podem ser negociadas individualmente para afiliados de alto desempenho</span>
                        </li>
                      </ul>
                    </div>

                    {/* 3.2 */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-foreground">3.2 Processamento de Pagamentos</h3>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400">•</span>
                          <span>As comissões são processadas <strong className="text-foreground">mensalmente</strong>, até o dia 15 do mês subsequente</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400">•</span>
                          <span>O valor mínimo para saque é de R$ 50,00 (cinquenta reais)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400">•</span>
                          <span>Pagamentos são realizados via transferência bancária (PIX ou TED)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400">•</span>
                          <span>Comissões de vendas reembolsadas ou estornadas serão <strong className="text-foreground">automaticamente canceladas</strong></span>
                        </li>
                      </ul>
                    </div>

                    {/* 3.3 */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-foreground">3.3 Período de Atribuição</h3>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400">•</span>
                          <span>O cookie de rastreamento tem validade de <strong className="text-foreground">30 dias</strong></span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400">•</span>
                          <span>Se o cliente indicado realizar a compra dentro deste período, a comissão será atribuída ao afiliado</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-600 dark:text-green-400">•</span>
                          <span>Após os 30 dias, o cliente não será mais vinculado ao afiliado</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 4. Proibições */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-destructive/10">
                      <Ban className="h-5 w-5 text-destructive" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">4. Proibições</h2>
                  </div>
                  <div className="pl-12 space-y-6">
                    
                    <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                      <p className="text-destructive font-semibold text-sm">
                        ⚠️ O descumprimento de qualquer item abaixo resultará em banimento imediato 
                        do programa e perda de todas as comissões pendentes.
                      </p>
                    </div>

                    {/* 4.1 */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-foreground">4.1 Uso de Anúncios Pagos com a Marca</h3>
                      <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                        <p className="text-destructive font-semibold mb-3">
                          É ESTRITAMENTE PROIBIDO utilizar anúncios pagos que:
                        </p>
                        <ul className="space-y-2 text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                            <span>Utilizem o nome "Valuation Invest Tech", "VALUATION", ou variações similares</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                            <span>Utilizem termos de marca registrada ou nomes de produtos da empresa</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                            <span>Compitam diretamente com campanhas oficiais da VALUATION Invest Tech</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                            <span>Utilizem logotipos, imagens ou materiais oficiais sem autorização prévia por escrito</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                            <span>Criem confusão quanto à origem oficial do anúncio</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    {/* 4.2 */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-foreground">4.2 Práticas de Spam</h3>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <span>Envio de e-mails não solicitados em massa</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <span>Mensagens automáticas em redes sociais</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <span>Comentários spam em fóruns, blogs ou vídeos</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <span>Qualquer forma de comunicação em massa não autorizada</span>
                        </li>
                      </ul>
                    </div>

                    {/* 4.3 */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-foreground">4.3 Fraude e Auto-Indicação</h3>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <span><strong className="text-foreground">Auto-indicação é expressamente proibida</strong>: você não pode usar seu próprio link para realizar compras</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <span>Criar múltiplas contas para gerar comissões fictícias</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <span>Manipular cliques ou tráfego artificialmente</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <span>Utilizar bots ou scripts automatizados</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <span>Fornecer informações falsas sobre produtos ou serviços</span>
                        </li>
                      </ul>
                    </div>

                    {/* 4.4 */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-foreground">4.4 Conteúdo Inadequado</h3>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <span>Associar a marca a conteúdo adulto, violento, discriminatório ou ilegal</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <span>Fazer declarações falsas ou enganosas sobre os serviços</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <span>Prometer resultados financeiros garantidos</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          <span>Violar direitos autorais ou propriedade intelectual de terceiros</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 5. Obrigações do Afiliado */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <ClipboardCheck className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">5. Obrigações do Afiliado</h2>
                  </div>
                  <div className="pl-12">
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span>Manter suas informações cadastrais sempre atualizadas</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span>Divulgar claramente a relação de afiliado em suas promoções</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span>Utilizar apenas materiais promocionais aprovados pela empresa</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span>Respeitar as leis de proteção ao consumidor e publicidade</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span>Reportar imediatamente qualquer suspeita de fraude</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* 6. Direitos da VALUATION */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">6. Direitos da VALUATION Invest Tech</h2>
                  </div>
                  <div className="pl-12">
                    <p className="text-muted-foreground mb-3">A empresa reserva-se o direito de:</p>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Modificar a estrutura de comissões com aviso prévio de 30 dias</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Suspender ou encerrar a conta de afiliado por violação dos termos</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Reter comissões em caso de suspeita de fraude até investigação</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Cancelar comissões de vendas reembolsadas ou estornadas</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>Alterar estes termos a qualquer momento, notificando os afiliados</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* 7. Inatividade */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">7. Inatividade</h2>
                  </div>
                  <div className="pl-12">
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-400">•</span>
                        <span>Afiliados sem atividade (vendas ou cliques) por <strong className="text-foreground">60 dias consecutivos</strong> receberão notificações de alerta</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-400">•</span>
                        <span>Após 90 dias de inatividade, a conta de afiliado poderá ser suspensa</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-400">•</span>
                        <span>Comissões pendentes de contas suspensas permanecerão disponíveis por 12 meses</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* 8. Propriedade Intelectual */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">8. Propriedade Intelectual</h2>
                  </div>
                  <div className="pl-12">
                    <p className="text-muted-foreground leading-relaxed">
                      Todos os materiais, logotipos, nomes e marcas da VALUATION Invest Tech são de 
                      propriedade exclusiva da empresa. O uso só é permitido conforme as diretrizes 
                      fornecidas e para fins exclusivos de promoção do programa de afiliados.
                    </p>
                  </div>
                </div>

                {/* 9. Limitação de Responsabilidade */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">9. Limitação de Responsabilidade</h2>
                  </div>
                  <div className="pl-12">
                    <p className="text-muted-foreground mb-3">A VALUATION Invest Tech não se responsabiliza por:</p>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-400">•</span>
                        <span>Perdas ou danos resultantes de ações do afiliado</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-400">•</span>
                        <span>Problemas técnicos fora de nosso controle</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-400">•</span>
                        <span>Decisões de investimento tomadas por clientes indicados</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-400">•</span>
                        <span>Conteúdo publicado pelo afiliado em seus canais</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* 10. Rescisão */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-destructive/10">
                      <XCircle className="h-5 w-5 text-destructive" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">10. Rescisão</h2>
                  </div>
                  <div className="pl-12 space-y-3">
                    <p className="text-muted-foreground">
                      Qualquer parte pode encerrar a participação no programa a qualquer momento. 
                      Em caso de rescisão:
                    </p>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <span className="text-destructive">•</span>
                        <span>Comissões aprovadas até a data de rescisão serão pagas normalmente</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-destructive">•</span>
                        <span>O afiliado deve cessar imediatamente o uso de materiais promocionais</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-destructive">•</span>
                        <span>Links de afiliado serão desativados</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* 11. Contato */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">11. Contato</h2>
                  </div>
                  <div className="pl-12">
                    <p className="text-muted-foreground">
                      Para dúvidas sobre o Programa de Afiliados, entre em contato através do e-mail:{" "}
                      <a 
                        href="mailto:afiliados@valuationit.com.br" 
                        className="text-primary hover:underline font-medium"
                      >
                        afiliados@valuationit.com.br
                      </a>
                    </p>
                  </div>
                </div>

                {/* 12. Disposições Gerais */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Scale className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">12. Disposições Gerais</h2>
                  </div>
                  <div className="pl-12">
                    <p className="text-muted-foreground leading-relaxed">
                      Estes termos são regidos pelas leis brasileiras. Qualquer disputa será resolvida 
                      no foro da comarca de Belo Horizonte/MG. A tolerância quanto a qualquer violação não 
                      constituirá renúncia ao direito de exigir o cumprimento dos termos.
                    </p>
                  </div>
                </div>

                {/* Acceptance Box */}
                <div className="mt-10 p-6 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary mt-0.5 shrink-0" />
                    <p className="text-muted-foreground">
                      Ao ativar sua conta de afiliado, você declara ter lido, compreendido e concordado 
                      integralmente com todos os termos e condições aqui estabelecidos.
                    </p>
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default TermosAfiliado;
