import { useCallback, useRef, useState } from 'react';

export type ToastType = 'error' | 'success';

export type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

const TOAST_DURATION_MS = 4000;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType) => {
      const id = String(nextId.current++);
      setToasts((current) => [...current, { id, message, type }]);
      setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
    },
    [dismissToast],
  );

  const showError = useCallback((message: string) => showToast(message, 'error'), [showToast]);
  const showSuccess = useCallback((message: string) => showToast(message, 'success'), [showToast]);

  return { toasts, showError, showSuccess, dismissToast };
}
