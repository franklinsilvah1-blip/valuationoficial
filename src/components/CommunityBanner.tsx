import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X, PlayCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const CommunityBanner = () => {
  const { userPlan } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const [communityLink, setCommunityLink] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkIfAdmin();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      loadBannerStatus();
      loadCommunityLink();
    }
  }, [userPlan, isAdmin]);

  const checkIfAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!roles);
  };

  const loadBannerStatus = async () => {
    // Admin or FREE users never see the banner
    if (isAdmin || userPlan === "FREE") {
      setShowBanner(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("hide_community_message")
      .eq("id", user.id)
      .single();

    setShowBanner(!profile?.hide_community_message);
  };

  const loadCommunityLink = async () => {
    const { data } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "community_whatsapp_link")
      .single();

    if (data) setCommunityLink(data.value);
  };

  const handleClose = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ hide_community_message: true })
      .eq("id", user.id);

    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <Alert className="bg-primary/10 border-primary">
      <PlayCircle className="h-5 w-5 text-primary" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-foreground">
          🎬 Acesse nosso conteúdo exclusivo de educação financeira!
        </span>
        <div className="flex gap-2">
          <Button 
            onClick={() => window.open(communityLink, '_blank')}
            size="sm"
          >
            Acessar Conteúdo
          </Button>
          <Button 
            onClick={handleClose}
            variant="ghost"
            size="sm"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default CommunityBanner;
