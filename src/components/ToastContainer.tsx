import React from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { useToast, ToastItem } from "../context/ToastContext";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-portal-container">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onClose: () => void }> = ({ toast, onClose }) => {
  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return <CheckCircle2 size={18} className="toast-icon success" />;
      case "error":
        return <AlertCircle size={18} className="toast-icon error" />;
      case "warning":
        return <AlertTriangle size={18} className="toast-icon warning" />;
      case "info":
      default:
        return <Info size={18} className="toast-icon info" />;
    }
  };

  return (
    <div className={`modern-toast ${toast.type}`}>
      <div className="toast-main">
        {getIcon()}
        <div className="toast-body">
          {toast.title && <div className="toast-title">{toast.title}</div>}
          <div className="toast-message">{toast.message}</div>
        </div>
        <button className="toast-dismiss-btn" onClick={onClose} title="Dismiss">
          <X size={14} />
        </button>
      </div>
      {toast.duration > 0 && (
        <div
          className="toast-progress-bar"
          style={{ animationDuration: `${toast.duration}ms` }}
        />
      )}
    </div>
  );
};
