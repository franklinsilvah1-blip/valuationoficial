// GTM DataLayer utility for custom event tracking with robust initialization verification

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

interface GTMEvent {
  event: string;
  [key: string]: unknown;
}

// GTM State Management
let gtmReady = false;
let gtmCheckAttempts = 0;
const MAX_GTM_CHECK_ATTEMPTS = 10;
const GTM_CHECK_INTERVAL = 500; // ms
const pendingEvents: GTMEvent[] = [];

/**
 * Verifica se o GTM está carregado e funcionando
 */
export const isGTMReady = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return Array.isArray(window.dataLayer) && 
         window.dataLayer.some(item => 
           item && typeof item === 'object' && 'gtm.start' in item
         );
};

/**
 * Aguarda o GTM estar pronto (com timeout)
 */
export const waitForGTM = (timeout = 5000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (isGTMReady()) {
      resolve(true);
      return;
    }
    
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isGTMReady()) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        console.warn('⚠️ GTM: Timeout aguardando inicialização (possível ad-blocker)');
        resolve(false);
      }
    }, 100);
  });
};

/**
 * Processa eventos que foram enfileirados antes do GTM carregar
 */
const processPendingEvents = (): void => {
  if (!window.dataLayer) return;
  
  const eventsToProcess = [...pendingEvents];
  pendingEvents.length = 0; // Clear the queue
  
  eventsToProcess.forEach(event => {
    window.dataLayer.push(event);
    console.log('📊 GTM Event (da fila):', event.event);
  });
  
  if (eventsToProcess.length > 0) {
    console.log(`✅ GTM: ${eventsToProcess.length} eventos pendentes processados`);
  }
};

/**
 * Inicializa verificação do GTM e processa fila quando pronto
 */
export const initGTMVerification = (): void => {
  if (typeof window === 'undefined') return;
  
  // Ensure dataLayer exists
  window.dataLayer = window.dataLayer || [];
  
  const checkGTM = () => {
    if (isGTMReady()) {
      gtmReady = true;
      console.log('✅ GTM: Inicializado com sucesso');
      processPendingEvents();
      return;
    }
    
    gtmCheckAttempts++;
    if (gtmCheckAttempts < MAX_GTM_CHECK_ATTEMPTS) {
      setTimeout(checkGTM, GTM_CHECK_INTERVAL);
    } else {
      console.warn('⚠️ GTM: Não foi possível verificar inicialização após', MAX_GTM_CHECK_ATTEMPTS, 'tentativas');
      // Still process pending events to dataLayer (GTM might load later)
      gtmReady = true; // Allow events to flow even without confirmation
      processPendingEvents();
    }
  };
  
  // Start checking after a small delay to allow GTM script to initialize
  setTimeout(checkGTM, 100);
};

/**
 * Push a custom event to GTM dataLayer with verification and queue fallback
 */
export const pushGTMEvent = (eventData: GTMEvent): void => {
  if (typeof window === 'undefined') return;
  
  // Ensure dataLayer exists
  window.dataLayer = window.dataLayer || [];
  
  // If GTM not ready yet, queue the event
  if (!gtmReady && !isGTMReady()) {
    console.log('📋 GTM Event enfileirado:', eventData.event);
    pendingEvents.push(eventData);
    return;
  }
  
  // Mark as ready if we detected it
  if (!gtmReady && isGTMReady()) {
    gtmReady = true;
  }
  
  window.dataLayer.push(eventData);
  console.log('📊 GTM Event:', eventData.event, eventData);
};

// Pre-defined event helpers for common actions

export const trackButtonClick = (buttonName: string, location: string, additionalData?: Record<string, unknown>) => {
  pushGTMEvent({
    event: 'button_click',
    button_name: buttonName,
    click_location: location,
    ...additionalData,
  });
};

export const trackSubscriptionClick = (planName: string, planPrice: string, source: string) => {
  pushGTMEvent({
    event: 'subscription_click',
    plan_name: planName,
    plan_price: planPrice,
    click_source: source,
  });
};

export const trackSubscriptionSuccess = (planName: string, planPrice: string) => {
  pushGTMEvent({
    event: 'purchase',
    transaction_type: 'subscription',
    plan_name: planName,
    plan_price: planPrice,
  });
};

export const trackLogin = (method: string) => {
  pushGTMEvent({
    event: 'login',
    login_method: method,
  });
};

export const trackSignup = (method: string) => {
  pushGTMEvent({
    event: 'sign_up',
    signup_method: method,
  });
};

export const trackAssetView = (assetCode: string, assetType: string, assetName: string) => {
  pushGTMEvent({
    event: 'view_item',
    item_id: assetCode,
    item_category: assetType,
    item_name: assetName,
  });
};

export const trackSearch = (searchTerm: string, resultsCount: number) => {
  pushGTMEvent({
    event: 'search',
    search_term: searchTerm,
    results_count: resultsCount,
  });
};

export const trackContactForm = (formType: string) => {
  pushGTMEvent({
    event: 'generate_lead',
    form_type: formType,
  });
};

export const trackPageView = (pagePath: string, pageTitle: string) => {
  pushGTMEvent({
    event: 'page_view',
    page_path: pagePath,
    page_title: pageTitle,
  });
};

export const trackAddToWallet = (assetCode: string, assetType: string) => {
  pushGTMEvent({
    event: 'add_to_cart',
    item_id: assetCode,
    item_category: assetType,
  });
};

export const trackUpgradePrompt = (requiredPlan: string, currentPlan: string, assetCode: string) => {
  pushGTMEvent({
    event: 'upgrade_prompt_shown',
    required_plan: requiredPlan,
    current_plan: currentPlan,
    trigger_asset: assetCode,
  });
};
