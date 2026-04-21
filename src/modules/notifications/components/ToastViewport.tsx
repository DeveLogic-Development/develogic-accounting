import { Button } from '@/design-system/primitives/Button';
import { useNotifications } from '../hooks/useNotifications';

function toneLabel(level: 'success' | 'info' | 'warning' | 'error'): string {
  if (level === 'success') return 'Success';
  if (level === 'warning') return 'Warning';
  if (level === 'error') return 'Error';
  return 'Info';
}

export function ToastViewport() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="dl-toast-viewport" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <article key={toast.id} className={`dl-toast-item ${toast.level}`}>
          <div className="dl-toast-content">
            {toast.title ? (
              <div className="dl-toast-title">
                {toast.title}
              </div>
            ) : (
              <div className="dl-toast-title">{toneLabel(toast.level)}</div>
            )}
            <p>{toast.message}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="dl-toast-dismiss"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
          >
            Dismiss
          </Button>
        </article>
      ))}
    </div>
  );
}
