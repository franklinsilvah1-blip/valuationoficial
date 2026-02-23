import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, User } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import OptimizedImage from "@/components/OptimizedImage";
import logo from "@/assets/logo.webp";
import { Helmet } from "react-helmet";
import { createSiteNavigationElementSchema } from "@/components/SEOHead";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState<string>("");

  const isActive = (path: string) => {
    if (path === "/mercado" || path === "/app/mercado") {
      return location.pathname === "/mercado" || location.pathname === "/app/mercado";
    }
    return location.pathname === path;
  };

  useEffect(() => {
    // Check if user is logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        // Get user profile
        supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            setUserName(data?.name || user.email || "Usuário");
          });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase
          .from("profiles")
          .select("name")
          .eq("id", session.user.id)
          .single()
          .then(({ data }) => {
            setUserName(data?.name || session.user.email || "Usuário");
          });
      } else {
        setUserName("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const navLinks = [
    { to: "/", label: "Início" },
    { to: user ? "/app/mercado" : "/mercado", label: "Mercado" },
    { to: "/assinatura", label: "Assinatura" },
    { to: "/consultoria", label: "Consultoria" },
    { to: "/blog", label: "Blog" },
  ];

  // SiteNavigationElement schema for SEO
  const siteUrl = "https://valuationit.com.br";
  const navSchema = createSiteNavigationElementSchema(
    navLinks.map((link) => ({
      name: link.label,
      url: `${siteUrl}${link.to}`,
    }))
  );

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(navSchema)}</script>
      </Helmet>
      <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <OptimizedImage 
            src={logo} 
            alt="VALUATION Invest Tech - Logo" 
            className="h-10 md:h-14 w-auto"
            lazy={false}
            priority={true}
            width={120}
            height={56}
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                isActive(link.to) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:flex items-center gap-2"
              onClick={() => navigate("/app/dashboard")}
            >
              <User className="h-4 w-4" />
              {userName}
            </Button>
          ) : (
            <>
              <Link to="/auth" className="hidden md:block">
                <Button variant="ghost" size="sm">
                  Entrar
                </Button>
              </Link>
              <Link to="/assinatura" className="hidden md:block">
                <Button size="sm" className="gradient-cta text-accent-foreground font-semibold hover:opacity-90">
                  Assinar Agora
                </Button>
              </Link>
            </>
          )}

          {/* Mobile Menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <div className="flex flex-col gap-4 mt-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={`text-base font-medium transition-colors hover:text-primary ${
                      isActive(link.to) ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                  {user ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setOpen(false);
                        navigate("/app/dashboard");
                      }}
                    >
                      <User className="mr-2 h-4 w-4" />
                      {userName}
                    </Button>
                  ) : (
                    <>
                      <Link to="/auth" onClick={() => setOpen(false)}>
                        <Button variant="outline" className="w-full">
                          Entrar
                        </Button>
                      </Link>
                      <Link to="/assinatura" onClick={() => setOpen(false)}>
                        <Button className="w-full gradient-cta text-accent-foreground font-semibold">
                          Assinar Agora
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
    </>
  );
};

export default Navbar;
