import { log } from "./logger";
import { CONFIG } from "./config";

// Exponential backoff retry mechanism
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxAttempts: number = CONFIG.limits.maxReconnectAttempts
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        log.error(`${operationName} failed after ${maxAttempts} attempts`, error);
        throw error;
      }
      
      const delay = Math.min(
        CONFIG.timing.reconnectBackoff.initial * Math.pow(CONFIG.timing.reconnectBackoff.multiplier, attempt - 1),
        CONFIG.timing.reconnectBackoff.max
      );
      
      log.warn(`${operationName} failed, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`, {
        attempt,
        delay,
        error: error instanceof Error ? error.message : String(error),
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
