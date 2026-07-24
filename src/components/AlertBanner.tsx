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
      container: 'bg-app-success/10 border-app-success/30 text-app-success',
      icon: <CheckCircle2 size={16} className="text-app-success shrink-0" />
    },
    error: {
      container: 'bg-app-error/10 border-app-error/30 text-app-error',
      icon: <ShieldAlert size={16} className="text-app-error shrink-0" />
    },
    warning: {
      container: 'bg-app-warning/10 border-app-warning/30 text-app-warning',
      icon: <AlertCircle size={16} className="text-app-warning shrink-0" />
    },
    info: {
      container: 'bg-app-info/10 border-app-info/30 text-app-info',
      icon: <Info size={16} className="text-app-info shrink-0" />
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
