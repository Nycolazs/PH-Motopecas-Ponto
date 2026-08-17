const RETRYABLE_TRANSACTION_CODES = new Set(['P2002', 'P2034']);

function isRetryableTransactionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    RETRYABLE_TRANSACTION_CODES.has(error.code)
  );
}

export async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableTransactionError(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError;
}
