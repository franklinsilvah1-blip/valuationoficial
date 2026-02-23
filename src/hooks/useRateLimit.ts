import { useState, useCallback, useRef, useEffect } from 'react';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

interface RateLimitState {
  isBlocked: boolean;
  remainingAttempts: number;
  timeUntilReset: number;
  blockTimeRemaining: number;
}

interface UseRateLimitReturn {
  state: RateLimitState;
  checkLimit: () => boolean;
  recordAttempt: () => void;
  reset: () => void;
}

const STORAGE_KEY_PREFIX = 'rate_limit_';

export const useRateLimit = (
  key: string,
  config: RateLimitConfig
): UseRateLimitReturn => {
  const { maxAttempts, windowMs, blockDurationMs = 60000 } = config;
  
  const getStorageKey = () => `${STORAGE_KEY_PREFIX}${key}`;
  
  const loadFromStorage = (): { attempts: number[]; blockedUntil: number | null } => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore storage errors
    }
    return { attempts: [], blockedUntil: null };
  };
  
  const saveToStorage = (data: { attempts: number[]; blockedUntil: number | null }) => {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  };
  
  const [state, setState] = useState<RateLimitState>(() => {
    const { attempts, blockedUntil } = loadFromStorage();
    const now = Date.now();
    const validAttempts = attempts.filter(t => now - t < windowMs);
    const isBlocked = blockedUntil !== null && now < blockedUntil;
    
    return {
      isBlocked,
      remainingAttempts: Math.max(0, maxAttempts - validAttempts.length),
      timeUntilReset: validAttempts.length > 0 ? Math.max(0, windowMs - (now - validAttempts[0])) : 0,
      blockTimeRemaining: isBlocked ? Math.max(0, blockedUntil - now) : 0,
    };
  });
  
  const attemptsRef = useRef<number[]>([]);
  const blockedUntilRef = useRef<number | null>(null);
  
  // Initialize refs from storage
  useEffect(() => {
    const { attempts, blockedUntil } = loadFromStorage();
    const now = Date.now();
    attemptsRef.current = attempts.filter(t => now - t < windowMs);
    blockedUntilRef.current = blockedUntil && now < blockedUntil ? blockedUntil : null;
  }, [windowMs]);
  
  // Update state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const validAttempts = attemptsRef.current.filter(t => now - t < windowMs);
      attemptsRef.current = validAttempts;
      
      const isBlocked = blockedUntilRef.current !== null && now < blockedUntilRef.current;
      
      if (!isBlocked && blockedUntilRef.current !== null) {
        blockedUntilRef.current = null;
        attemptsRef.current = [];
        saveToStorage({ attempts: [], blockedUntil: null });
      }
      
      setState({
        isBlocked,
        remainingAttempts: Math.max(0, maxAttempts - validAttempts.length),
        timeUntilReset: validAttempts.length > 0 ? Math.max(0, windowMs - (now - validAttempts[0])) : 0,
        blockTimeRemaining: isBlocked ? Math.max(0, blockedUntilRef.current! - now) : 0,
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [maxAttempts, windowMs]);
  
  const checkLimit = useCallback((): boolean => {
    const now = Date.now();
    
    // Check if blocked
    if (blockedUntilRef.current !== null && now < blockedUntilRef.current) {
      return false;
    }
    
    // Clean old attempts
    const validAttempts = attemptsRef.current.filter(t => now - t < windowMs);
    attemptsRef.current = validAttempts;
    
    return validAttempts.length < maxAttempts;
  }, [maxAttempts, windowMs]);
  
  const recordAttempt = useCallback(() => {
    const now = Date.now();
    
    // Clean old attempts first
    const validAttempts = attemptsRef.current.filter(t => now - t < windowMs);
    validAttempts.push(now);
    attemptsRef.current = validAttempts;
    
    // Check if should block
    if (validAttempts.length >= maxAttempts) {
      blockedUntilRef.current = now + blockDurationMs;
    }
    
    saveToStorage({
      attempts: attemptsRef.current,
      blockedUntil: blockedUntilRef.current,
    });
    
    const isBlocked = blockedUntilRef.current !== null && now < blockedUntilRef.current;
    
    setState({
      isBlocked,
      remainingAttempts: Math.max(0, maxAttempts - validAttempts.length),
      timeUntilReset: validAttempts.length > 0 ? Math.max(0, windowMs - (now - validAttempts[0])) : 0,
      blockTimeRemaining: isBlocked ? Math.max(0, blockedUntilRef.current! - now) : 0,
    });
  }, [maxAttempts, windowMs, blockDurationMs]);
  
  const reset = useCallback(() => {
    attemptsRef.current = [];
    blockedUntilRef.current = null;
    saveToStorage({ attempts: [], blockedUntil: null });
    
    setState({
      isBlocked: false,
      remainingAttempts: maxAttempts,
      timeUntilReset: 0,
      blockTimeRemaining: 0,
    });
  }, [maxAttempts]);
  
  return { state, checkLimit, recordAttempt, reset };
};

// Utility function to format remaining time
export const formatTimeRemaining = (ms: number): string => {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};
