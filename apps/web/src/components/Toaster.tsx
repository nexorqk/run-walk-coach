import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

type ToastMessage = {
  id: number;
  type: ToastType;
  text: string;
};

let toastId = 0;
let listeners: Array<(toast: ToastMessage) => void> = [];

export function showToast(text: string, type: ToastType = "info") {
  const toast: ToastMessage = { id: ++toastId, type, text };
  for (const listener of listeners) {
    listener(toast);
  }
}

function ToastIcon({ type }: { type: ToastType }) {
  if (type === "success") return <CheckCircle2 aria-hidden="true" size={18} />;
  if (type === "error") return <AlertTriangle aria-hidden="true" size={18} />;
  return null;
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (toast: ToastMessage) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3500);
    };

    listeners.push(handler);
    return () => {
      listeners = listeners.filter((l) => l !== handler);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <ToastIcon type={toast.type} />
          <span>{toast.text}</span>
          <button
            className="toast-close"
            type="button"
            aria-label="Dismiss"
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          >
            <X aria-hidden="true" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
