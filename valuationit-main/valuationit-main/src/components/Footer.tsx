import { Link } from "react-router-dom";
import { ExternalLink, Shield, Mail, Linkedin, Instagram, Youtube } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";
import logo from "@/assets/logo.webp";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card border-t mt-auto" role="contentinfo">
      {/* Main Footer Content */}
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Link to="/" className="inline-block mb-4">
              <OptimizedImage 
                src={logo} 
                alt="VALUATION Invest Tech - Logo" 
                className="h-10 w-auto"
                lazy={true}
                width={100}
                height={40}
              />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Tecnologia e inteligência para seus investimentos
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://www.linkedin.com/in/franklinsilvah/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com/franklinsilvah/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://www.youtube.com/@valuationit"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Navigation Columns */}
          <nav aria-label="Links institucionais">
            <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-foreground">
              Institucional
            </h3>
            <ul className="space-y-3">
              <li>
                <Link to="/sobre" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Sobre Nós
                </Link>
              </li>
              <li>
                <Link to="/contato" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Contato
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Links de serviços">
            <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-foreground">
              Serviços
            </h3>
            <ul className="space-y-3">
              <li>
                <Link to="/mercado" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Mercado
                </Link>
              </li>
              <li>
                <Link to="/assinatura" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Planos
                </Link>
              </li>
              <li>
                <Link to="/consultoria" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Consultoria
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <nav aria-label="Links legais">
              <h3 className="font-semibold text-sm uppercase tracking-wider mb-4 text-foreground">
                Legal
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/politica-privacidade" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Política de Privacidade
                  </Link>
                </li>
                <li>
                  <Link to="/politica-cookies" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Política de Cookies
                  </Link>
                </li>
                <li>
                  <Link to="/termos-uso" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Termos de Uso
                  </Link>
                </li>
              </ul>
            </nav>
            
            <address className="mt-6 not-italic">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <a 
                  href="mailto:contato@valuationit.com.br" 
                  className="hover:text-primary transition-colors break-all"
                >
                  contato@valuationit.com.br
                </a>
              </div>
            </address>
          </div>
        </div>
      </div>

      {/* CVM Regulation Section */}
      <div className="border-t bg-muted/30">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground">Regulamentação CVM</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-border" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Franklin Silva</span>
              <span className="mx-2">•</span>
              <span>Consultor de Valores Mobiliários</span>
              <span className="mx-2">•</span>
              <span>Registro nº <span className="font-semibold text-primary">004246-3</span></span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-border" />
            <a
              href="https://sistemas.cvm.gov.br/?CadGeral"
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Verificar registro
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t">
        <div className="container py-4">
          <p className="text-xs text-muted-foreground text-center">
            © <time dateTime={currentYear.toString()}>{currentYear}</time> VALUATION Invest Tech. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
