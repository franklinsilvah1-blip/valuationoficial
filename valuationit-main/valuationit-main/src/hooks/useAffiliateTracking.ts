import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AFFILIATE_STORAGE_KEY = "valuation_affiliate_id";
const AFFILIATE_EXPIRY_KEY = "valuation_affiliate_expiry";
const AFFILIATE_SESSION_KEY = "valuation_affiliate_session";
const EXPIRY_DAYS = 30; // Affiliate cookie expires after 30 days

// Generate a unique session ID for click deduplication
const generateSessionId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

// Get or create session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem(AFFILIATE_SESSION_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(AFFILIATE_SESSION_KEY, sessionId);
  }
  return sessionId;
};

// Track affiliate click in the database
const trackAffiliateClick = async (affiliateCode: string, landingPage: string) => {
  try {
    const referrer = document.referrer || null;

    console.log(`[Affiliate] Tracking click for code: ${affiliateCode}`);

    const { data, error } = await supabase.functions.invoke("track-affiliate-click", {
      body: {
        affiliateCode,
        landingPage,
        referrer,
      },
    });

    if (error) {
      console.error("[Affiliate] Error tracking click:", error);
    } else {
      console.log("[Affiliate] Click tracked successfully:", data);
    }
  } catch (error) {
    console.error("[Affiliate] Error tracking click:", error);
  }
};

// Check if user is admin (to block tracking for admins)
const checkIsAdmin = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    return !!roles;
  } catch {
    return false;
  }
};

export const useAffiliateTracking = () => {
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const refCode = searchParams.get("ref");

    if (refCode) {
      // Check if user is admin - admins should not be tracked
      // This prevents admin navigation from interfering with affiliate metrics
      checkIsAdmin().then((isAdmin) => {
        if (isAdmin) {
          console.log("[Affiliate] Admin user detected, skipping affiliate tracking");
          return;
        }

        // Check if this is a new click (not already tracked in this session)
        const lastTrackedCode = sessionStorage.getItem("last_tracked_affiliate");
        const landingPage = window.location.href;

        // Only track if this is a different code or first visit
        if (lastTrackedCode !== refCode) {
          // Track the click in the database
          trackAffiliateClick(refCode, landingPage);
          sessionStorage.setItem("last_tracked_affiliate", refCode);
        }

        // Save affiliate code to localStorage
        // This is used later when the user signs up to attribute the referral
        localStorage.setItem(AFFILIATE_STORAGE_KEY, refCode);
        
        // Set expiry date (30 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + EXPIRY_DAYS);
        localStorage.setItem(AFFILIATE_EXPIRY_KEY, expiryDate.toISOString());

        console.log(`[Affiliate] Tracking code saved: ${refCode}`);
      });
    }
  }, [location.search]);
};

// Utility function to get stored affiliate code (checks expiry)
export const getStoredAffiliateCode = (): string | null => {
  const code = localStorage.getItem(AFFILIATE_STORAGE_KEY);
  const expiry = localStorage.getItem(AFFILIATE_EXPIRY_KEY);

  if (!code || !expiry) {
    return null;
  }

  // Check if expired
  if (new Date() > new Date(expiry)) {
    // Clean up expired data
    localStorage.removeItem(AFFILIATE_STORAGE_KEY);
    localStorage.removeItem(AFFILIATE_EXPIRY_KEY);
    return null;
  }

  return code;
};

// Utility function to clear affiliate tracking (after successful referral registration)
export const clearAffiliateTracking = () => {
  localStorage.removeItem(AFFILIATE_STORAGE_KEY);
  localStorage.removeItem(AFFILIATE_EXPIRY_KEY);
};
