import { useUiStore } from '../../store/uiStore';

const TYPE_CLASSES = {
  success: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100',
  error: 'border-red-500/40 bg-red-500/15 text-red-100',
  info: 'border-slate-600 bg-slate-800 text-slate-100',
};

export default function Notifications() {
  const notifications = useUiStore((s) => s.notifications);
  const dismiss = useUiStore((s) => s.dismiss);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] flex max-w-sm flex-col gap-2">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`flex items-start gap-3 rounded-md border px-4 py-3 shadow-xl ${TYPE_CLASSES[n.type] || TYPE_CLASSES.info}`}
        >
          <p className="flex-1 text-sm">{n.message}</p>
          <button
            onClick={() => dismiss(n.id)}
            className="opacity-60 hover:opacity-100"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
