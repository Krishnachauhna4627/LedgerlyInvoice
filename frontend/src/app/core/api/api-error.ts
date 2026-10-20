import { HttpErrorResponse } from '@angular/common/http';

export interface ApiError {
  message: string;
  fieldErrors: Record<string, string>;
}

// Turns a failed HTTP call into a message for the user plus per-field messages from the backend.
export function toApiError(err: unknown): ApiError {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return { message: "Can't reach the server. Please check your connection and try again.", fieldErrors: {} };
    }
    const body = err.error as { message?: string; errors?: Record<string, string> } | null;
    return {
      message: body?.message ?? 'Something went wrong. Please try again.',
      fieldErrors: body?.errors ?? {},
    };
  }
  return { message: 'Something went wrong. Please try again.', fieldErrors: {} };
}
