import { useEffect, useMemo, useState } from 'react';

import { stockApi } from '../api/stockApi';
import { notifyError } from '../store/uiStore';

const CATEGORY_LABEL = {
  ESCOBILLONES: 'Escobillones',
  ESCOBAS: 'Escobas',
  CEPILLOS: 'Cepillos',
  SECADORES: 'Secadores',
  BASES_Y_CABOS: 'Bases y cabos',
  BALDES_Y_ACCESORIOS: 'Varios',
  ESPONJAS: 'Esponjas',
  ANDENES: 'Andenes',
  INSUMOS: 'Insumos',
  MATERIA_PRIMA: 'Materia prima',
  FIBRA: 'Fibra',
};

const CATEGORY_ORDER = [
  'ESCOBILLONES',
  'ESCOBAS',
  'CEPILLOS',
  'SECADORES',
  'ESPONJAS',
  'BASES_Y_CABOS',
  'BALDES_Y_ACCESORIOS',
  'ANDENES',
  'MATERIA_PRIMA',
  'INSUMOS',
  'FIBRA',
];

const ORIGIN_LABEL = {
  FABRICACION_PROPIA: 'Fabricación propia',
  IMPORTADO_BRASIL: 'Bettanin (Brasil)',
  IMPORTADO_CHINA: 'Importado (China)',
};

function Stat({ label, value, accent, variant }) {
  const cls = {
    success: 'border-emerald-500/30',
    danger: 'border-red-500/40',
    info: 'border-slate-700',
  }[variant || 'info'];
  return (
    <div className={`rounded-lg border ${cls} bg-slate-950 p-4`}>
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p
        className={`mt-1 font-mono text-2xl sm:text-3xl font-bold ${accent ? 'text-emerald-400' : 'text-slate-100'}`}
      >
        {value}
      </p>
    </div>
  );
}

function CategoryCard({ category, data }) {
  const hasAlert = data.below > 0;
  return (
    <div
      className={`rounded-lg border bg-slate-950 p-4 ${hasAlert ? 'border-red-500/30' : 'border-slate-700'}`}
    >
      <p className="text-xs uppercase tracking-wider text-slate-400">
        {CATEGORY_LABEL[category] || category}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold text-emerald-400">
        {data.boxes.toLocaleString('es-AR')}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {data.count} productos
        {hasAlert && (
          <>
            {' · '}
            <span className="text-red-400">{data.below} bajo mín.</span>
          </>
        )}
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

  const stats = useMemo(() => {
    const totalProducts = stock.length;
    const totalBoxes = stock.reduce((s, p) => s + p.quantity_boxes, 0);
    const belowMin = stock.filter((p) => p.is_below_minimum).length;

    const byCategory = {};
    for (const p of stock) {
      const c = byCategory[p.category] || { count: 0, boxes: 0, below: 0 };
      c.count += 1;
      c.boxes += p.quantity_boxes;
      if (p.is_below_minimum) c.below += 1;
      byCategory[p.category] = c;
    }

    return { totalProducts, totalBoxes, belowMin, byCategory };
  }, [stock]);

  if (loading) {
    return <p className="text-slate-400">Cargando...</p>;
  }

  const orderedCategories = CATEGORY_ORDER.filter(
    (c) => stats.byCategory[c]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="SKUs activos" value={stats.totalProducts} />
        <Stat
          label="Cajas totales"
          value={stats.totalBoxes.toLocaleString('es-AR')}
          accent
        />
        <Stat label="Categorías" value={orderedCategories.length} />
        <Stat
          label="Bajo mínimo"
          value={stats.belowMin}
          variant={stats.belowMin > 0 ? 'danger' : 'success'}
        />
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Totales por categoría
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orderedCategories.map((cat) => (
            <CategoryCard
              key={cat}
              category={cat}
              data={stats.byCategory[cat]}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Alertas de stock {alerts.length > 0 && `(${alerts.length})`}
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
