/**
 * AES-256-GCM encryption utilities for securing sensitive data
 * Uses Web Crypto API available in Deno
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 128; // bits

/**
 * Derives an AES-256 key from the encryption secret
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("smtp_credential_salt_v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * Returns base64-encoded string: iv:ciphertext
 */
export async function encryptPassword(plaintext: string): Promise<string> {
  const encryptionKey = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!encryptionKey) {
    throw new Error("SMTP_ENCRYPTION_KEY not configured");
  }

  const key = await deriveKey(encryptionKey);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    encoder.encode(plaintext)
  );

  // Combine IV and ciphertext, then base64 encode
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a base64-encoded encrypted string
 * Input format: base64(iv + ciphertext)
 */
export async function decryptPassword(encrypted: string): Promise<string> {
  const encryptionKey = Deno.env.get("SMTP_ENCRYPTION_KEY");
  if (!encryptionKey) {
    throw new Error("SMTP_ENCRYPTION_KEY not configured");
  }

  // Check if the value looks like it's already plaintext (for backward compatibility)
  // Encrypted values are base64 and typically longer than most passwords
  if (!isEncrypted(encrypted)) {
    console.warn("[CRYPTO] Password appears to be plaintext, returning as-is for backward compatibility");
    return encrypted;
  }

  try {
    const key = await deriveKey(encryptionKey);
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    // If decryption fails, it might be a plaintext password from before encryption was implemented
    console.warn("[CRYPTO] Decryption failed, treating as plaintext for backward compatibility:", error);
    return encrypted;
  }
}

/**
 * Checks if a string appears to be encrypted (base64 with expected length)
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  
  // Encrypted values should be base64 and at least IV_LENGTH + some ciphertext
  // A typical password encrypted would be at least 40+ characters in base64
  try {
    const decoded = atob(value);
    return decoded.length >= IV_LENGTH + 8; // IV + at least 8 bytes of ciphertext
  } catch {
    return false;
  }
}
