import { beautifyError } from "./messages";
import { toast } from "sonner";

/**
 * Use this in every catch block instead of toast.error(e.message).
 * It maps ugly technical errors to beautiful, on-brand messages.
 */
export function showError(error: unknown, fallback?: string) {
  const msg = fallback ?? beautifyError(error);
  toast.error(msg);
}

/**
 * Use this for success toasts. Adds consistency.
 */
export function showSuccess(message: string) {
  toast.success(message);
}

/**
 * Wraps an async server function call, catching errors and showing
 * a beautiful toast. Returns null on error.
 */
export async function safeCall<T>(
  fn: () => Promise<T>,
  options?: { success?: string; fallbackError?: string }
): Promise<T | null> {
  try {
    const result = await fn();
    if (options?.success) toast.success(options.success);
    return result;
  } catch (e) {
    showError(e, options?.fallbackError);
    return null;
  }
}
