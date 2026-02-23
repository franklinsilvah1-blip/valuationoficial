import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requiredPermission?: 'blog' | 'reports' | 'users' | 'system' | 'affiliates' | 'all';
}

const ProtectedRoute = ({ children, requireAdmin = false, requiredPermission }: ProtectedRouteProps) => {
  const { user, loading, isAdmin, userRole, hasPermission } = useAuth();
  const location = useLocation();

  // Don't render children until authentication is confirmed
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check for specific permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    console.warn("[ProtectedRoute] Access denied: User lacks permission:", requiredPermission);
    return <Navigate to="/app/dashboard" replace />;
  }

  // Legacy admin check (now checks if user has any role)
  if (requireAdmin && !userRole) {
    console.warn("[ProtectedRoute] Access denied: User has no admin role");
    return <Navigate to="/app/dashboard" replace />;
  }

  // Only render children after authentication is fully confirmed
  return <>{children}</>;
};

export default ProtectedRoute;
