import { useAffiliateTracking } from "@/hooks/useAffiliateTracking";

/**
 * Component that tracks affiliate referral codes from URL.
 * Must be placed inside BrowserRouter context.
 */
const AffiliateTracker = () => {
  useAffiliateTracking();
  return null;
};

export default AffiliateTracker;
