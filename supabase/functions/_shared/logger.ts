/**
 * Secure logging utility that masks PII for LGPD/GDPR compliance
 */

/**
 * Masks an email address to show only first 2 characters and domain
 * Example: john.doe@example.com -> jo***@example.com
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return '***';
  
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  
  const maskedLocal = local.length > 2 
    ? `${local.slice(0, 2)}***` 
    : '***';
  
  return `${maskedLocal}@${domain}`;
}

/**
 * Masks a user ID to show only last 4 characters
 * Example: 550e8400-e29b-41d4-a716-446655440000 -> ***0000
 */
export function maskId(id: string): string {
  if (!id || typeof id !== 'string') return '***';
  
  return id.length > 4 
    ? `***${id.slice(-4)}` 
    : '***';
}

/**
 * Masks a name to show only first name initial and last name initial
 * Example: John Doe -> J*** D***
 */
export function maskName(name: string): string {
  if (!name || typeof name !== 'string') return '***';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].length > 1 ? `${parts[0][0]}***` : '***';
  }
  
  const first = parts[0][0];
  const last = parts[parts.length - 1][0];
  return `${first}*** ${last}***`;
}

/**
 * Secure logger that automatically masks common PII fields
 */
export const secureLog = {
  /**
   * Log with automatic PII masking for common field names
   */
  info: (message: string, data?: Record<string, any>) => {
    if (!data) {
      console.log(message);
      return;
    }
    
    const maskedData = maskPIIFields(data);
    console.log(message, maskedData);
  },
  
  /**
   * Log error with automatic PII masking
   */
  error: (message: string, error?: any, data?: Record<string, any>) => {
    if (!data) {
      console.error(message, error);
      return;
    }
    
    const maskedData = maskPIIFields(data);
    console.error(message, error, maskedData);
  },
  
  /**
   * Log warning with automatic PII masking
   */
  warn: (message: string, data?: Record<string, any>) => {
    if (!data) {
      console.warn(message);
      return;
    }
    
    const maskedData = maskPIIFields(data);
    console.warn(message, maskedData);
  },
};

/**
 * Automatically masks common PII field names in objects
 */
function maskPIIFields(data: Record<string, any>): Record<string, any> {
  const masked: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Check if field name suggests PII
    if (lowerKey.includes('email')) {
      masked[key] = typeof value === 'string' ? maskEmail(value) : value;
    } else if (lowerKey.includes('userid') || lowerKey === 'id' || lowerKey.includes('_id')) {
      masked[key] = typeof value === 'string' ? maskId(value) : value;
    } else if (lowerKey === 'name' || lowerKey.includes('username')) {
      masked[key] = typeof value === 'string' ? maskName(value) : value;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively mask nested objects
      masked[key] = maskPIIFields(value);
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
}
