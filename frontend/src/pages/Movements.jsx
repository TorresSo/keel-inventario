import { useEffect, useMemo, useState } from 'react';

import { stockApi } from '../api/stockApi';
import Badge from '../components/ui/Badge';
import { notifyError } from '../store/uiStore';

const TYPE_LABEL = {
  INGRESO_PRODUCCION: 'Ingreso · Producción',
  INGRESO_RECEPCION: 'Ingreso · Recepción',
  EGRESO_DESPACHO: 'Egreso · Despacho',
  EGRESO_MERMA: 'Egreso · Merma',
  AJUSTE: 'Ajuste',
  REVERSA: 'Reversión',
};

const TYPE_VARIANT = {
  INGRESO_PRODUCCION: 'success',
  INGRESO_RECEPCION: 'success',
  EGRESO_DESPACHO: 'danger',
  EGRESO_MERMA: 'warning',
  AJUSTE: 'info',
  REVERSA: 'warning',
};

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatDayHeader(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.getTime() === today.getTime()) return 'Hoy';
  if (date.getTime() === yesterday.getTime()) return 'Ayer';
  return `${DAYS_ES[date.getDay()]}, ${d} de ${MONTHS_ES[m - 1]} ${y}`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

const PAGE_SIZE = 200;

export default function Movements() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadPage = async (offset = 0) => {
    try {
      const page = await stockApi.listAllMovements({
        limit: PAGE_SIZE,
        offset,
      });
      setHasMore(page.length === PAGE_SIZE);
      setMovements((prev) =>
        offset === 0 ? page : [...prev, ...page]
      );
    } catch (err) {
      notifyError(err.response?.data?.detail || 'Error al cargar movimientos');
    }
  };

  useEffect(() => {
    setLoading(true);
    loadPage(0).finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const byDay = new Map();
    for (const m of movements) {
      const day = m.created_at.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(m);
    }
    return Array.from(byDay.entries()).sort((a, b) =>
      b[0].localeCompare(a[0])
    );
  }, [movements]);

  const onLoadMore = async () => {
    setLoadingMore(true);
    await loadPage(movements.length);
    setLoadingMore(false);
  };

  if (loading) return <p className="text-slate-400">Cargando...</p>;

  if (movements.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aún no hay movimientos registrados. Los ingresos, egresos y despachos
        van a aparecer acá.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([day, items]) => (
        <section key={day}>
          <div className="mb-3 flex items-baseline justify-between border-b border-slate-800 pb-2">
            <h3 className="text-base font-semibold text-slate-100">
              {formatDayHeader(day)}
            </h3>
            <span className="font-mono text-xs text-slate-500">
              {day} · {items.length} mov.
            </span>
          </div>
          <ul className="space-y-2">
            {items.map((m) => (
              <MovementRow key={m.id} movement={m} />
            ))}
          </ul>
        </section>
      ))}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            {loadingMore ? 'Cargando...' : 'Ver más antiguos'}
          </button>
        </div>
      )}
    </div>
  );
}

function MovementRow({ movement: m }) {
  const variant = TYPE_VARIANT[m.movement_type] || 'info';
  const sign = m.quantity_boxes > 0 ? '+' : '';
  const qtyClass =
    m.quantity_boxes < 0
      ? 'text-red-300'
      : m.quantity_boxes > 0
        ? 'text-emerald-300'
        : 'text-slate-300';

  return (
    <li className="grid grid-cols-12 items-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
      <span className="col-span-2 sm:col-span-1 font-mono text-xs text-slate-500">
        {formatTime(m.created_at)}
      </span>
      <span className="col-span-10 sm:col-span-3">
        <Badge variant={variant}>{TYPE_LABEL[m.movement_type] || m.movement_type}</Badge>
      </span>
      <span className="col-span-5 sm:col-span-4 truncate">
        <span className="font-mono text-emerald-300">{m.product_code}</span>{' '}
        <span className="text-slate-400">{m.product_name}</span>
      </span>
      <span
        className={`col-span-3 sm:col-span-2 text-right font-mono font-semibold ${qtyClass}`}
      >
        {sign}
        {m.quantity_boxes} caj.
      </span>
      <span className="col-span-4 sm:col-span-2 text-right font-mono text-xs text-slate-500">
        → {m.stock_after_boxes}
      </span>
      {m.notes && (
        <span className="col-span-12 truncate pl-12 text-xs italic text-slate-500">
          {m.notes}
        </span>
      )}
    </li>
  );
}
