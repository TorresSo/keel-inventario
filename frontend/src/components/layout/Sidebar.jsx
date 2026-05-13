import { NavLink } from 'react-router-dom';

import { useAuthStore } from '../../store/authStore';

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/stock', label: 'Stock' },
  { to: '/orders', label: 'Pedidos' },
];

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col border-r border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 px-5 py-5">
        <p className="font-mono text-base font-bold text-emerald-500">KEEL</p>
        <p className="text-xs text-slate-500">Mapuche · Inventario</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-800 px-4 py-3 text-xs">
        <p className="truncate font-semibold text-slate-200">{user?.full_name}</p>
        <p className="truncate text-slate-500">{user?.email}</p>
        <p className="mt-1 font-mono text-emerald-400">{user?.role}</p>
        <button
          onClick={logout}
          className="mt-3 w-full rounded-md bg-slate-800 px-3 py-1.5 text-slate-300 hover:bg-slate-700"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
