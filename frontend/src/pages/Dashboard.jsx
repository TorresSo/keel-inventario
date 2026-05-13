import { useEffect, useState } from 'react';

import { stockApi } from '../api/stockApi';
import { notifyError } from '../store/uiStore';

function Stat({ label, value, accent, variant }) {
  const variantClasses = {
    success: 'border-emerald-500/30',
    danger: 'border-red-500/40',
  };
  return (
    <div
      className={`rounded-lg border ${variantClasses[variant] || 'border-slate-700'} bg-slate-950 p-4`}
    >
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={`mt-1 font-mono text-3xl font-bold ${accent ? 'text-emerald-400' : 'text-slate-100'}`}
      >
        {value}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [stock, setStock] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([stockApi.listCurrent(), stockApi.listAlerts()])
      .then(([s, a]) => {
        setStock(s);
        setAlerts(a);
      })
      .catch((err) =>
        notifyError(err.response?.data?.detail || 'Error cargando dashboard')
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-slate-400">Cargando...</p>;
  }

  const totalProducts = stock.length;
  const totalBoxes = stock.reduce((sum, s) => sum + s.quantity_boxes, 0);
  const belowMin = stock.filter((s) => s.is_below_minimum).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Productos activos" value={totalProducts} />
        <Stat label="Cajas totales" value={totalBoxes} accent />
        <Stat
          label="Bajo mínimo"
          value={belowMin}
          variant={belowMin > 0 ? 'danger' : 'success'}
        />
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Alertas de stock
        </h3>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">
            Todos los productos están por encima de su mínimo.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-400">
                    Código
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-400">
                    Nombre
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-400">
                    Stock
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-400">
                    Mínimo
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-400">
                    Faltan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {alerts.map((a) => (
                  <tr key={a.product_id}>
                    <td className="px-3 py-2 font-mono text-sm text-emerald-300">
                      {a.product_code}
                    </td>
                    <td className="px-3 py-2 text-sm">{a.product_name}</td>
                    <td className="px-3 py-2 text-right font-mono text-sm">
                      {a.quantity_boxes}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-500">
                      {a.min_stock_boxes}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-sm font-semibold text-red-300">
                      {a.shortage_boxes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
