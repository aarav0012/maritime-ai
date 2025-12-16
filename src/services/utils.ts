/**
 * Maps complex API/Network errors to user-friendly messages for the UI.
 */
export const getFriendlyErrorMessage = (error: any): string => {
  if (!error) return "Unknown system error.";
  
  const msg = (error.message || error.toString()).toLowerCase();
  const status = error.status || error.response?.status;

  // HTTP Status Codes
  if (status === 401 || msg.includes('api key')) return "Authentication Failed: Invalid API Key.";
  if (status === 403) return "Access Denied: Permissions restricted.";
  if (status === 429) return "System Busy: Rate limit exceeded. Please wait.";
  if (status >= 500) return "Neural Core Offline: Server temporary error.";

  // SDK/Network Specifics
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
    return "Connection Lost: Check network settings.";
  }
  if (msg.includes('safety') || msg.includes('blocked') || msg.includes('finishreason')) {
    return "Safety Protocol: Content flagged and blocked.";
  }
  if (msg.includes('candidate') && msg.includes('empty')) {
    return "Model Error: Received empty response.";
  }
  if (msg.includes('parse')) {
    return "Data Error: Received malformed data.";
  }
  
  // Truncate long technical errors
  return `System Error: ${msg.substring(0, 60)}...`;
};

/**
 * Cleans model output to ensure valid JSON parsing.
 * Removes markdown code blocks usually added by LLMs.
 */
export const cleanJson = (text: string): string => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

/**
 * Executes an async operation with exponential backoff retry logic.
 * Retries on network errors, 5xx server errors, and 429 rate limits.
 * Fails fast on 4xx client errors (except 429).
 */
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>, 
  retries: number = 3, 
  delay: number = 1000,
  operationName: string = 'Operation'
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    if (retries <= 0) throw error;
    
    // Check for status code in various error formats
    const status = error.status || error.response?.status;
    
    // Non-retryable errors: 400-499 (except 429 Too Many Requests)
    if (status && status >= 400 && status < 500 && status !== 429) {
      console.error(`[${operationName}] Non-retryable error (Status ${status}):`, error);
      throw error;
    }

    console.warn(`[${operationName}] Failed. Retrying in ${delay}ms... (${retries} attempts left). Error: ${error.message || 'Unknown'}`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithBackoff(operation, retries - 1, delay * 2, operationName);
  }
};
