import { useCallback, useRef, useState } from 'react';

export type ToastItem = {
  id: string;
  message: string;
};

const TOAST_DURATION_MS = 4000;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showError = useCallback(
    (message: string) => {
      const id = String(nextId.current++);
      setToasts((current) => [...current, { id, message }]);
      setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
    },
    [dismissToast],
  );

  return { toasts, showError, dismissToast };
}
