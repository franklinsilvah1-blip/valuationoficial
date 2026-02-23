import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { initGTMVerification } from "@/utils/gtmTracking";
import Index from "./pages/Index";
import Mercado from "./pages/Mercado";
import Assinatura from "./pages/Assinatura";
import AssinaturaSucesso from "./pages/AssinaturaSucesso";
import AssinaturaErro from "./pages/AssinaturaErro";
import Consultoria from "./pages/Consultoria";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import BlogCategory from "./pages/BlogCategory";
import Sobre from "./pages/Sobre";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Contato from "./pages/Contato";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import PoliticaCookies from "./pages/PoliticaCookies";
import TermosAfiliado from "./pages/TermosAfiliado";
import TermosUso from "./pages/TermosUso";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/app/Dashboard";
import MercadoApp from "./pages/app/MercadoApp";
import Carteira from "./pages/app/Carteira";
import Perfil from "./pages/app/Perfil";
import Historico from "./pages/app/Historico";
import Admin from "./pages/app/Admin";
import AdminUsers from "./pages/app/AdminUsers";
import AdminReports from "./pages/app/AdminReports";
import AdminClients from "./pages/app/AdminClients";
import AdminSMTP from "./pages/app/AdminSMTP";
import AdminSync from "./pages/app/AdminSync";

import AdminDebug from "./pages/app/AdminDebug";
import AdminTracking from "./pages/app/AdminTracking";
import AdminEmails from "./pages/app/AdminEmails";
import AdminBlog from "./pages/app/AdminBlog";
import AdminCancellations from "./pages/app/AdminCancellations";
import AdminSubscriptionsPanel from "./pages/app/AdminSubscriptionsPanel";
import AdminSubscribers from "./pages/app/AdminSubscribers";
import AdminPlans from "./pages/app/AdminPlans";
import AdminAffiliates from "./pages/app/AdminAffiliates";
import AdminAffiliatesPanel from "./pages/app/AdminAffiliatesPanel";
import AdminAffiliatesAnalytics from "./pages/app/AdminAffiliatesAnalytics";
import AdminAffiliatesCommissions from "./pages/app/AdminAffiliatesCommissions";
import AdminAffiliatesPerformance from "./pages/app/AdminAffiliatesPerformance";
import Afiliado from "./pages/app/Afiliado";
import ConteudosExclusivos from "./pages/app/ConteudosExclusivos";
import RMC from "./pages/app/RMC";
import AdminVideos from "./pages/app/AdminVideos";
import AdminBackups from "./pages/app/AdminBackups";
import AdminNotifications from "./pages/app/AdminNotifications";
import AdminLeads from "./pages/app/AdminLeads";
import AdminMigration from "./pages/app/AdminMigration";
import EditorDashboard from "./pages/app/EditorDashboard";
import ModeratorDashboard from "./pages/app/ModeratorDashboard";
import NotFound from "./pages/NotFound";
import ServerError from "./pages/ServerError";
import LandingPage from "./pages/LandingPage";
import LandingPageObrigado from "./pages/LandingPageObrigado";
import CadastroObrigado from "./pages/CadastroObrigado";
import AtendeFlowAuth from "./pages/AtendeFlowAuth";
import { AuthProvider } from "./contexts/AuthContext";
import AuthLoadingScreen from "./components/AuthLoadingScreen";
import TrackingScripts from "./components/TrackingScripts";
import AffiliateTracker from "./components/AffiliateTracker";
import ResourceHints from "./components/ResourceHints";
import PWAPrompt from "./components/PWAPrompt";
import ErrorBoundary from "./components/ErrorBoundary";
import ScrollToTop from "./components/ScrollToTop";
import { AnonymousNotificationPrompt } from "./components/AnonymousNotificationPrompt";
import { AutoPushSubscription } from "./components/AutoPushSubscription";

const queryClient = new QueryClient();

const App = () => {
  // Initialize GTM verification on app mount
  useEffect(() => {
    initGTMVerification();
  }, []);

  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthLoadingScreen>
          <TooltipProvider>
            <TrackingScripts />
            <Toaster />
            <Sonner />
            <AnonymousNotificationPrompt delay={8000} />
            <AutoPushSubscription />
          <BrowserRouter>
              <PWAPrompt />
              <ScrollToTop />
              <ResourceHints />
              <AffiliateTracker />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/mercado" element={<Mercado />} />
            <Route path="/assinatura" element={<Assinatura />} />
            <Route path="/assinatura-sucesso" element={<AssinaturaSucesso />} />
            <Route path="/assinatura-erro" element={<AssinaturaErro />} />
            <Route path="/sobre" element={<Sobre />} />
            <Route path="/consultoria" element={<Consultoria />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/categoria/:slug" element={<BlogCategory />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/contato" element={<Contato />} />
            <Route path="/politica-privacidade" element={<PoliticaPrivacidade />} />
            <Route path="/politica-cookies" element={<PoliticaCookies />} />
            <Route path="/termos-afiliado" element={<TermosAfiliado />} />
            <Route path="/termos-uso" element={<TermosUso />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/lp" element={<LandingPage />} />
            <Route path="/lp/obrigado" element={<LandingPageObrigado />} />
            <Route path="/cadastro/obrigado" element={<CadastroObrigado />} />
            <Route path="/erro" element={<ServerError />} />
            <Route path="/atendeflow" element={<AtendeFlowAuth />} />
          
          {/* Protected Routes */}
          <Route
            path="/app/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/mercado"
            element={
              <ProtectedRoute>
                <MercadoApp />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/carteira"
            element={
              <ProtectedRoute>
                <Carteira />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/perfil"
            element={
              <ProtectedRoute>
                <Perfil />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/historico"
            element={
              <ProtectedRoute>
                <Historico />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/afiliado"
            element={
              <ProtectedRoute>
                <Afiliado />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/conteudos"
            element={
              <ProtectedRoute>
                <ConteudosExclusivos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/rmc"
            element={
              <ProtectedRoute>
                <RMC />
              </ProtectedRoute>
            }
          />
          {/* Editor Dashboard - For editors */}
          <Route
            path="/app/editor"
            element={
              <ProtectedRoute requiredPermission="blog">
                <EditorDashboard />
              </ProtectedRoute>
            }
          />
          {/* Moderator Dashboard - For moderators */}
          <Route
            path="/app/moderator"
            element={
              <ProtectedRoute requiredPermission="reports">
                <ModeratorDashboard />
              </ProtectedRoute>
            }
          />
          {/* Admin Panel - Only for admins */}
          <Route
            path="/app/admin"
            element={
              <ProtectedRoute requiredPermission="all">
                <Admin />
              </ProtectedRoute>
            }
          />
          
          {/* Users Management - Only admins */}
          <Route
            path="/app/admin/users"
            element={
              <ProtectedRoute requiredPermission="users">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/clients"
            element={
              <ProtectedRoute requiredPermission="users">
                <AdminClients />
              </ProtectedRoute>
            }
          />
          
          {/* Subscriptions - Admins and Moderators */}
          <Route
            path="/app/admin/subscriptions"
            element={
              <ProtectedRoute requiredPermission="reports">
                <AdminSubscriptionsPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/plans"
            element={
              <ProtectedRoute requiredPermission="all">
                <AdminPlans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/subscribers"
            element={
              <ProtectedRoute requiredPermission="reports">
                <AdminSubscribers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/reports"
            element={
              <ProtectedRoute requiredPermission="reports">
                <AdminReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/cancellations"
            element={
              <ProtectedRoute requiredPermission="reports">
                <AdminCancellations />
              </ProtectedRoute>
            }
          />
          
          {/* Blog - Admins and Editors */}
          <Route
            path="/app/admin/blog"
            element={
              <ProtectedRoute requiredPermission="blog">
                <AdminBlog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/emails"
            element={
              <ProtectedRoute requiredPermission="blog">
                <AdminEmails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/videos"
            element={
              <ProtectedRoute requiredPermission="blog">
                <AdminVideos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/notifications"
            element={
              <ProtectedRoute requiredPermission="blog">
                <AdminNotifications />
              </ProtectedRoute>
            }
          />
          
          {/* Affiliates - Only admins */}
          <Route
            path="/app/admin/affiliates/panel"
            element={
              <ProtectedRoute requiredPermission="affiliates">
                <AdminAffiliatesPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/affiliates"
            element={
              <ProtectedRoute requiredPermission="affiliates">
                <AdminAffiliates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/affiliates/analytics"
            element={
              <ProtectedRoute requiredPermission="affiliates">
                <AdminAffiliatesAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/affiliates/commissions"
            element={
              <ProtectedRoute requiredPermission="affiliates">
                <AdminAffiliatesCommissions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/affiliates/performance"
            element={
              <ProtectedRoute requiredPermission="affiliates">
                <AdminAffiliatesPerformance />
              </ProtectedRoute>
            }
          />
          
          {/* System - Only admins */}
          <Route
            path="/app/admin/smtp"
            element={
              <ProtectedRoute requiredPermission="system">
                <AdminSMTP />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/sync"
            element={
              <ProtectedRoute requiredPermission="system">
                <AdminSync />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/debug"
            element={
              <ProtectedRoute requiredPermission="system">
                <AdminDebug />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/tracking"
            element={
              <ProtectedRoute requiredPermission="system">
                <AdminTracking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/backups"
            element={
              <ProtectedRoute requiredPermission="system">
                <AdminBackups />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/leads"
            element={
              <ProtectedRoute requiredPermission="all">
                <AdminLeads />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/migration-tool"
            element={
              <ProtectedRoute requiredPermission="all">
                <AdminMigration />
              </ProtectedRoute>
            }
          />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </TooltipProvider>
      </AuthLoadingScreen>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
