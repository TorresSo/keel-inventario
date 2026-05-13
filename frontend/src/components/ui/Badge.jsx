const VARIANTS = {
  success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  warning: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  danger: 'bg-red-500/20 text-red-300 border-red-500/40',
  info: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
  ocr: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
};

export default function Badge({ variant = 'info', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${VARIANTS[variant] || VARIANTS.info} ${className}`}
    >
      {children}
    </span>
  );
}
