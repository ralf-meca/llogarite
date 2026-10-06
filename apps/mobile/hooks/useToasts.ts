import { useCallback, useRef, useState } from 'react';

export type ToastType = 'error' | 'success';

export type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

// A success is a passing acknowledgement and clears itself. An error is
// something the reader has to take in and may have to act on, so it stays
// until they close it.
const SUCCESS_DURATION_MS = 4000;
// Errors no longer leave on their own, so they are kept from piling up: the
// same message shown again replaces its earlier self, and only the newest few
// are kept.
const MAX_TOASTS = 3;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType) => {
      const id = String(nextId.current++);
      setToasts((current) =>
        [...current.filter((toast) => toast.message !== message), { id, message, type }].slice(-MAX_TOASTS),
      );
      if (type === 'success') {
        setTimeout(() => dismissToast(id), SUCCESS_DURATION_MS);
      }
    },
    [dismissToast],
  );

  const showError = useCallback((message: string) => showToast(message, 'error'), [showToast]);
  const showSuccess = useCallback((message: string) => showToast(message, 'success'), [showToast]);

  return { toasts, showError, showSuccess, dismissToast };
}
