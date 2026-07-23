import React from 'react';
import { CheckCircle2, ShieldAlert, AlertCircle, Info, X } from 'lucide-react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertBannerProps {
  type: AlertType;
  message: string | React.ReactNode;
  onClose?: () => void;
  className?: string;
  id?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type,
  message,
  onClose,
  className = '',
  id
}) => {
  if (!message) return null;

  const styles = {
    success: {
      container: 'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300',
      icon: <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
    },
    error: {
      container: 'bg-red-50 dark:bg-red-950/25 border-red-200 dark:border-red-900/40 text-red-800 dark:text-red-400',
      icon: <ShieldAlert size={16} className="text-red-600 dark:text-red-400 shrink-0" />
    },
    warning: {
      container: 'bg-amber-50 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300',
      icon: <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
    },
    info: {
      container: 'bg-blue-50 dark:bg-blue-950/25 border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300',
      icon: <Info size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
    }
  };

  const currentStyle = styles[type] || styles.info;

  return (
    <div
      id={id}
      className={`p-3.5 border rounded-lg text-xs md:text-sm font-medium flex items-center justify-between gap-3 shadow-2xs transition-all duration-200 no-print ${currentStyle.container} ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {currentStyle.icon}
        <div className="leading-snug truncate">{message}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition cursor-pointer shrink-0 opacity-70 hover:opacity-100"
          title="Cerrar notificación"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default AlertBanner;
