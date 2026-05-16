import { useLocation } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';

const TITLES = {
  '/': 'Dashboard',
  '/stock': 'Stock',
  '/production': 'Producción',
  '/movements': 'Movimientos',
  '/orders': 'Pedidos',
};

export default function TopBar() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const title = TITLES[location.pathname] || 'KEEL';

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="md:hidden font-mono text-sm font-bold text-emerald-500">
          KEEL
        </span>
        <h2 className="text-base font-semibold text-slate-100 md:text-lg">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right text-xs sm:block">
          <p className="font-semibold text-slate-200">{user?.full_name}</p>
          <p className="text-slate-500">{user?.role}</p>
        </div>
        <button
          onClick={logout}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 md:hidden"
        >
          Salir
        </button>
      </div>
    </header>
  );
}
