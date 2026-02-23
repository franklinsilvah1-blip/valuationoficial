export const GENERIC_ERRORS = {
  AUTH_FAILED: "Authentication required",
  INVALID_REQUEST: "Invalid request parameters",
  PAYMENT_ERROR: "Payment processing failed",
  SERVER_ERROR: "An error occurred. Please try again later",
  RATE_LIMIT: "Too many requests. Please try again later",
  SUBSCRIPTION_ERROR: "Unable to process subscription request",
  ADMIN_ONLY: "Administrator access required",
  NETWORK_ERROR: "Network connection failed. Please check your internet connection",
  TIMEOUT_ERROR: "Request timed out. Please try again",
  FILE_TOO_LARGE: "File size exceeds maximum allowed (5MB)",
  INVALID_CSV: "Invalid CSV format. Please check your file",
};

export function mapErrorToUserMessage(error: Error): string {
  const message = error.message.toLowerCase();

  if (message.includes("rate_limit_exceeded") || message.includes("too many")) {
    return GENERIC_ERRORS.RATE_LIMIT;
  }
  if (message.includes("authentication") || message.includes("not authenticated") || message.includes("unauthorized")) {
    return GENERIC_ERRORS.AUTH_FAILED;
  }
  if (message.includes("stripe") || message.includes("payment")) {
    return GENERIC_ERRORS.PAYMENT_ERROR;
  }
  if (message.includes("subscription")) {
    return GENERIC_ERRORS.SUBSCRIPTION_ERROR;
  }
  if (message.includes("admin") || message.includes("forbidden")) {
    return GENERIC_ERRORS.ADMIN_ONLY;
  }
  if (message.includes("invalid") || message.includes("validation")) {
    return GENERIC_ERRORS.INVALID_REQUEST;
  }
  if (message.includes("network") || message.includes("connection") || message.includes("fetch")) {
    return GENERIC_ERRORS.NETWORK_ERROR;
  }
  if (message.includes("timeout") || message.includes("timed out")) {
    return GENERIC_ERRORS.TIMEOUT_ERROR;
  }
  if (message.includes("file") && message.includes("large")) {
    return GENERIC_ERRORS.FILE_TOO_LARGE;
  }
  if (message.includes("csv") || message.includes("format")) {
    return GENERIC_ERRORS.INVALID_CSV;
  }

  return GENERIC_ERRORS.SERVER_ERROR;
}
