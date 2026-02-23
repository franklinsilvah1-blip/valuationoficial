import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Phone, MessageSquare, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import SEOHead, { createBreadcrumbSchema, createContactPageSchema, createSpeakableSchema } from "@/components/SEOHead";
import { useRateLimit, formatTimeRemaining } from "@/hooks/useRateLimit";
import TurnstileWidget from "@/components/TurnstileWidget";

const contactSchema = z.object({
  name: z.string().trim().min(1, { message: "Nome é obrigatório" }).max(100, { message: "Nome muito longo" }),
  email: z.string().trim().email({ message: "Email inválido" }).max(255, { message: "Email muito longo" }),
  phone: z.string().trim().max(20, { message: "Telefone muito longo" }).optional(),
  subject: z.string().trim().min(1, { message: "Assunto é obrigatório" }).max(200, { message: "Assunto muito longo" }),
  message: z.string().trim().min(10, { message: "Mensagem deve ter pelo menos 10 caracteres" }).max(1000, { message: "Mensagem muito longa" }),
});

type ContactFormData = z.infer<typeof contactSchema>;

const Contato = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>("");

  // Rate limiting for contact form: 3 attempts per 10 minutes, block for 5 minutes
  const contactRateLimit = useRateLimit('contact_form', {
    maxAttempts: 3,
    windowMs: 10 * 60 * 1000, // 10 minutes
    blockDurationMs: 5 * 60 * 1000, // 5 minutes block
  });

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    },
  });

  const breadcrumbItems = [
    { name: "Home", href: "/" },
    { name: "Contato" },
  ];

  const jsonLdSchemas = [
    createBreadcrumbSchema([
      { name: "Home", url: "https://valuationit.com.br/" },
      { name: "Contato", url: "https://valuationit.com.br/contato" },
    ]),
    createContactPageSchema(),
    createSpeakableSchema("https://valuationit.com.br/contato", [
      "h1",
      "[data-speakable='contact-description']",
    ]),
  ];

  const handleTurnstileVerify = (token: string) => {
    setTurnstileToken(token);
  };

  const onSubmit = async (data: ContactFormData) => {
    // Check rate limit before proceeding
    if (!contactRateLimit.checkLimit()) {
      toast({
        title: "Muitas tentativas",
        description: `Aguarde ${formatTimeRemaining(contactRateLimit.state.blockTimeRemaining)} antes de enviar outra mensagem.`,
        variant: "destructive",
      });
      return;
    }

    if (!turnstileToken) {
      toast({
        title: "Verificação necessária",
        description: "Por favor, complete a verificação de segurança.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    contactRateLimit.recordAttempt();
    
    try {
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: {
          ...data,
          turnstileToken,
        },
      });

      if (error) throw error;

      toast({
        title: "Mensagem enviada com sucesso!",
        description: "Em breve entraremos em contato.",
      });

      form.reset();
      setTurnstileToken("");
    } catch (error) {
      console.error("Error sending contact message:", error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Ocorreu um erro ao enviar sua mensagem. Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <SEOHead
        title="Contato - Fale com a Equipe VALUATION"
        description="Entre em contato com a equipe VALUATION Invest Tech. Envie suas dúvidas sobre investimentos, planos ou consultoria. Respondemos rapidamente!"
        canonical="https://valuationit.com.br/contato"
        keywords={["contato", "suporte", "atendimento", "dúvidas investimentos"]}
        ogImage="https://valuationit.com.br/og-image.png"
        jsonLd={jsonLdSchemas}
      />
      <Navbar />
      
      <main className="container max-w-4xl py-16 px-4">
        {/* Breadcrumbs */}
        <Breadcrumbs items={breadcrumbItems} className="mb-8" />

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Entre em Contato
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-speakable="contact-description">
            Fale com a equipe VALUATION! Envie sua mensagem abaixo e responderemos o mais rápido possível.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="border-primary/20">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Email</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Envie suas dúvidas diretamente
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Telefone</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Atendimento personalizado
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Chat</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Suporte rápido e direto
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-xl border-primary/20">
          <CardHeader>
            <CardTitle>Envie sua mensagem</CardTitle>
            <CardDescription>
              Preencha o formulário abaixo com suas informações e mensagem
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Seu nome" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="seu@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="(00) 00000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assunto *</FormLabel>
                        <FormControl>
                          <Input placeholder="Assunto da mensagem" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mensagem *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Digite sua mensagem aqui..."
                          className="min-h-[150px] resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Cloudflare Turnstile CAPTCHA */}
                <TurnstileWidget
                  onVerify={handleTurnstileVerify}
                  theme="light"
                />

                {contactRateLimit.state.isBlocked && (
                  <div className="flex items-center justify-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    <Clock size={16} />
                    <span>Bloqueado por {formatTimeRemaining(contactRateLimit.state.blockTimeRemaining)}</span>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full gradient-cta text-accent-foreground font-semibold"
                  disabled={isSubmitting || !turnstileToken || contactRateLimit.state.isBlocked}
                >
                  {isSubmitting ? "Enviando..." : contactRateLimit.state.isBlocked ? "Aguarde..." : "Enviar Mensagem"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default Contato;
