export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  onRetry: () => {},
};

/**
 * Executes a function with exponential backoff retry logic
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the function or throws the last error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on these errors
      const isNonRetryableError =
        error.message?.includes("autenticação") ||
        error.message?.includes("authentication") ||
        error.message?.includes("unauthorized") ||
        error.message?.includes("forbidden") ||
        error.message?.includes("validation") ||
        error.message?.includes("invalid");

      if (isNonRetryableError || attempt === opts.maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(opts.baseDelay * Math.pow(2, attempt), opts.maxDelay);

      console.log(`[RETRY] Attempt ${attempt + 1}/${opts.maxRetries} failed. Retrying in ${delay}ms...`, error);
      opts.onRetry(attempt + 1, error);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Categorizes error types for better error handling
 */
export function categorizeError(error: any): {
  type: "network" | "auth" | "rate_limit" | "server" | "validation" | "unknown";
  message: string;
  retryable: boolean;
} {
  const message = error.message?.toLowerCase() || "";

  if (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("timeout")
  ) {
    return {
      type: "network",
      message: "Problema de conexão. Verifique sua internet e tente novamente.",
      retryable: true,
    };
  }

  if (
    message.includes("auth") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("session")
  ) {
    return {
      type: "auth",
      message: "Sessão expirada. Faça login novamente.",
      retryable: false,
    };
  }

  if (message.includes("rate") || message.includes("too many")) {
    return {
      type: "rate_limit",
      message: "Muitas requisições. Aguarde 1 minuto e tente novamente.",
      retryable: false,
    };
  }

  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("internal")
  ) {
    return {
      type: "server",
      message: "Erro no servidor. Tente novamente em alguns minutos.",
      retryable: true,
    };
  }

  if (message.includes("validation") || message.includes("invalid") || message.includes("required")) {
    return {
      type: "validation",
      message: error.message || "Dados inválidos no arquivo CSV.",
      retryable: false,
    };
  }

  return {
    type: "unknown",
    message: error.message || "Erro desconhecido. Tente novamente.",
    retryable: true,
  };
}
