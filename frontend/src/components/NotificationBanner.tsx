import { useEffect } from 'react';
import { useUIStore } from '../stores';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

const ICON_MAP = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
} as const;

const STYLE_MAP = {
  success: 'bg-green-50 border-green-400 text-green-800',
  error: 'bg-red-50 border-red-400 text-red-800',
  info: 'bg-blue-50 border-blue-400 text-blue-800',
} as const;

const ICON_STYLE_MAP = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-blue-500',
} as const;

/**
 * 全域通知橫幅 — 由 useUIStore.notification 驅動
 * 自動在 5 秒後消失（錯誤型態 8 秒）
 */
export default function NotificationBanner() {
  const { notification, clearNotification } = useUIStore();

  useEffect(() => {
    if (!notification) return;
    const ms = notification.type === 'error' ? 8000 : 5000;
    const timer = setTimeout(clearNotification, ms);
    return () => clearTimeout(timer);
  }, [notification, clearNotification]);

  if (!notification) return null;

  const Icon = ICON_MAP[notification.type];
  const style = STYLE_MAP[notification.type];
  const iconStyle = ICON_STYLE_MAP[notification.type];

  return (
    <div
      role="alert"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 border rounded-lg shadow-lg max-w-lg w-full animate-slide-down ${style}`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${iconStyle}`} />
      <p className="text-sm font-medium flex-1">{notification.message}</p>
      <button
        onClick={clearNotification}
        className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
        aria-label="關閉通知"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
