/**
 * Script Sanitizer Utility
 * Validates and sanitizes tracking scripts to prevent malicious code execution.
 * 
 * SECURITY NOTE: While admin access is required to add scripts, this provides
 * defense-in-depth by detecting potentially dangerous patterns that could:
 * - Steal user credentials or session tokens
 * - Exfiltrate sensitive data
 * - Modify page content maliciously
 */

// Dangerous patterns that should be blocked in custom scripts
const DANGEROUS_PATTERNS = [
  // Direct eval and code execution
  { pattern: /\beval\s*\(/gi, name: "eval()", severity: "critical" },
  { pattern: /\bFunction\s*\(/gi, name: "Function constructor", severity: "critical" },
  { pattern: /\bnew\s+Function\s*\(/gi, name: "new Function()", severity: "critical" },
  
  // Document manipulation that could be used for XSS
  { pattern: /document\.write\s*\(/gi, name: "document.write()", severity: "high" },
  { pattern: /document\.writeln\s*\(/gi, name: "document.writeln()", severity: "high" },
  { pattern: /\.innerHTML\s*=/gi, name: "innerHTML assignment", severity: "medium" },
  { pattern: /\.outerHTML\s*=/gi, name: "outerHTML assignment", severity: "medium" },
  
  // Cookie/storage access patterns that could steal data
  { pattern: /document\.cookie\s*=/gi, name: "cookie modification", severity: "high" },
  { pattern: /localStorage\s*\.\s*(setItem|removeItem|clear)/gi, name: "localStorage modification", severity: "medium" },
  { pattern: /sessionStorage\s*\.\s*(setItem|removeItem|clear)/gi, name: "sessionStorage modification", severity: "medium" },
  
  // Credential/sensitive data extraction
  { pattern: /\.password/gi, name: "password access", severity: "high" },
  { pattern: /auth\.?token/gi, name: "auth token access", severity: "high" },
  { pattern: /access_?token/gi, name: "access token access", severity: "high" },
  { pattern: /supabase/gi, name: "Supabase reference", severity: "high" },
  
  // Network requests to external domains (exfiltration risk)
  { pattern: /XMLHttpRequest/gi, name: "XMLHttpRequest", severity: "medium" },
  { pattern: /\bfetch\s*\(/gi, name: "fetch()", severity: "medium" },
  { pattern: /navigator\.sendBeacon/gi, name: "sendBeacon()", severity: "medium" },
  
  // Form hijacking
  { pattern: /\.submit\s*\(\s*\)/gi, name: "form.submit()", severity: "high" },
  { pattern: /onsubmit\s*=/gi, name: "onsubmit handler", severity: "medium" },
  
  // Event listener hijacking
  { pattern: /addEventListener\s*\(\s*['"]keypress['"]/gi, name: "keypress listener", severity: "high" },
  { pattern: /addEventListener\s*\(\s*['"]keydown['"]/gi, name: "keydown listener", severity: "high" },
  { pattern: /addEventListener\s*\(\s*['"]keyup['"]/gi, name: "keyup listener", severity: "high" },
  
  // Base64 obfuscation (commonly used to hide malicious payloads)
  { pattern: /atob\s*\(/gi, name: "atob() (base64 decode)", severity: "medium" },
  { pattern: /btoa\s*\(/gi, name: "btoa() (base64 encode)", severity: "low" },
  
  // WebSocket connections (could be used for data exfiltration)
  { pattern: /new\s+WebSocket/gi, name: "WebSocket connection", severity: "medium" },
];

// Known safe tracking script patterns (allowlist)
const SAFE_PATTERNS = [
  // Google Analytics/Tag Manager patterns
  /gtag\s*\(\s*['"]config['"]/i,
  /gtag\s*\(\s*['"]js['"]/i,
  /googletagmanager\.com/i,
  /www\.google-analytics\.com/i,
  /google\.com\/gtag/i,
  
  // Facebook Pixel patterns
  /fbq\s*\(/i,
  /connect\.facebook\.net/i,
  
  // Common analytics platforms
  /analytics\.js/i,
  /gtm\.js/i,
];

export interface ValidationResult {
  isValid: boolean;
  warnings: Array<{
    pattern: string;
    severity: string;
    message: string;
  }>;
  errors: Array<{
    pattern: string;
    severity: string;
    message: string;
  }>;
}

/**
 * Validates a tracking script for potentially dangerous patterns
 * @param scriptContent The script content to validate
 * @returns ValidationResult with any warnings/errors found
 */
export function validateTrackingScript(scriptContent: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
  };

  if (!scriptContent || scriptContent.trim() === "") {
    return result;
  }

  // Check for dangerous patterns
  for (const dangerousPattern of DANGEROUS_PATTERNS) {
    if (dangerousPattern.pattern.test(scriptContent)) {
      const issue = {
        pattern: dangerousPattern.name,
        severity: dangerousPattern.severity,
        message: `Script contém padrão potencialmente perigoso: ${dangerousPattern.name}`,
      };

      if (dangerousPattern.severity === "critical" || dangerousPattern.severity === "high") {
        result.errors.push(issue);
        result.isValid = false;
      } else {
        result.warnings.push(issue);
      }
    }
  }

  // Check if it looks like a legitimate tracking script
  const looksLegitimate = SAFE_PATTERNS.some(pattern => pattern.test(scriptContent));
  
  // If it has dangerous patterns AND doesn't look like a known tracking script, be more strict
  if (!looksLegitimate && result.warnings.length > 0) {
    result.warnings.push({
      pattern: "unknown_script",
      severity: "low",
      message: "Script não corresponde a padrões conhecidos de rastreamento (Google, Facebook, etc.)",
    });
  }

  return result;
}

/**
 * Sanitizes script ID inputs to prevent injection
 * @param scriptId The script ID to sanitize
 * @returns Sanitized script ID or null if invalid
 */
export function sanitizeScriptId(scriptId: string): string | null {
  if (!scriptId) return null;
  
  // Script IDs should only contain alphanumeric characters, hyphens, and underscores
  const sanitized = scriptId.trim();
  
  // Validate common ID formats:
  // - Google Analytics: G-XXXXXXXXXX, UA-XXXXXXXXX-X
  // - GTM: GTM-XXXXXXX
  // - Google Ads: AW-XXXXXXXXXX
  // - Facebook Pixel: Numeric only
  const validPatterns = [
    /^G-[A-Z0-9]+$/i,           // GA4
    /^UA-\d+-\d+$/i,            // Universal Analytics
    /^GTM-[A-Z0-9]+$/i,         // Google Tag Manager
    /^AW-\d+$/i,                // Google Ads
    /^\d+$/,                     // Facebook Pixel (numeric)
    /^[A-Z0-9_-]+$/i,           // Generic alphanumeric ID
  ];

  if (!validPatterns.some(pattern => pattern.test(sanitized))) {
    return null;
  }

  return sanitized;
}

/**
 * Get a human-readable summary of validation issues
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.isValid && result.warnings.length === 0) {
    return "Script validado com sucesso.";
  }

  const parts: string[] = [];
  
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} erro(s) crítico(s) encontrado(s)`);
  }
  
  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} aviso(s)`);
  }

  return parts.join(", ");
}
