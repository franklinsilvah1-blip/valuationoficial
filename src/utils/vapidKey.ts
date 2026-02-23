/**
 * VAPID Public Key for Web Push notifications
 * This must match the VAPID_PUBLIC_KEY configured in the backend secrets
 * 
 * IMPORTANT: If you change the VAPID keys in the backend,
 * you must also update this value and all users will need to re-subscribe
 */
export const VAPID_PUBLIC_KEY = 'BCOdMhHnlQC1R5YhdFRcAG3m-qTvLHZqSHj8K8NQBH_YlJX8NNwDgqGC6cSHGVP_lNvR9lqXDPnDqFCFQZVJaF0';

/**
 * Convert a base64url-encoded string to a Uint8Array
 * Required for the applicationServerKey parameter
 */
export function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}
