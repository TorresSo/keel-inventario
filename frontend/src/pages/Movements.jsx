import { useEffect, useMemo, useState } from 'react';

import { stockApi } from '../api/stockApi';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { selectIsGerencia, useAuthStore } from '../store/authStore';
import { notifyError, notifySuccess } from '../store/uiStore';

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
  const isGerencia = useAuthStore(selectIsGerencia);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pendingReverse, setPendingReverse] = useState(null);
  const [reversingId, setReversingId] = useState(null);

  const loadPage = async (offset = 0) => {
    try {
      const page = await stockApi.listAllMovements({
        limit: PAGE_SIZE,
        offset,
      });
      setHasMore(page.length === PAGE_SIZE);
      setMovements((prev) => (offset === 0 ? page : [...prev, ...page]));
    } catch (err) {
      notifyError(err.response?.data?.detail || 'Error al cargar movimientos');
    }
  };

  const reload = async () => {
    setLoading(true);
    await loadPage(0);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const reversedSet = useMemo(() => {
    const s = new Set();
    for (const m of movements) {
      if (m.reversed_movement_id) s.add(m.reversed_movement_id);
    }
    return s;
  }, [movements]);

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

  const doReverse = async (movementId, confirmNegative = false) => {
    setReversingId(movementId);
    try {
      await stockApi.reverseMovement(movementId, {
        confirm_negative: confirmNegative,
      });
      notifySuccess('Movimiento revertido');
      setPendingReverse(null);
      await reload();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail?.code === 'REVERSAL_WOULD_GO_NEGATIVE') {
        setPendingReverse({ movementId, detail });
      } else {
        notifyError(detail || 'No se pudo revertir');
      }
    } finally {
      setReversingId(null);
    }
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
          <div className="relative my-6 flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-800" />
            <div className="relative flex items-baseline gap-3 rounded-full border border-slate-700 bg-slate-950 px-4 py-1.5">
              <span className="text-sm font-semibold text-slate-100">
                {formatDayHeader(day)}
              </span>
              <span className="font-mono text-xs text-slate-500">
                {day.split('-').reverse().join('/')} · {items.length} mov.
              </span>
            </div>
          </div>
          <ul className="space-y-2">
            {items.map((m) => (
              <MovementRow
                key={m.id}
                movement={m}
                canReverse={
                  isGerencia &&
                  m.movement_type !== 'REVERSA' &&
                  !reversedSet.has(m.id)
                }
                alreadyReversed={reversedSet.has(m.id)}
                reversing={reversingId === m.id}
                onReverse={() => doReverse(m.id, false)}
              />
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

      <Modal
        open={Boolean(pendingReverse)}
        onClose={() => setPendingReverse(null)}
        title="Esta reversión deja stock en negativo"
        className="max-w-md"
      >
        {pendingReverse && (
          <div className="space-y-3 text-sm">
            <p className="text-amber-200">
              Si revertís este movimiento el stock va a quedar negativo.
            </p>
            <div className="rounded-md bg-slate-900 p-3 font-mono text-xs">
              <p>
                <span className="text-slate-500">Stock actual:</span>{' '}
                {pendingReverse.detail.current_boxes} cajas
              </p>
              <p>
                <span className="text-slate-500">Después de revertir:</span>{' '}
                <span className="font-semibold text-red-300">
                  {pendingReverse.detail.boxes_after_reversal} cajas
                </span>
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setPendingReverse(null)}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => doReverse(pendingReverse.movementId, true)}
                className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
              >
                Confirmar igual
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MovementRow({
  movement: m,
  canReverse,
  alreadyReversed,
  reversing,
  onReverse,
}) {
  const variant = TYPE_VARIANT[m.movement_type] || 'info';
  const sign = m.quantity_boxes > 0 ? '+' : '';
  const qtyClass =
    m.quantity_boxes < 0
      ? 'text-red-300'
      : m.quantity_boxes > 0
        ? 'text-emerald-300'
        : 'text-slate-300';

  const isReversa = m.movement_type === 'REVERSA';

  const askConfirm = (e) => {
    e.stopPropagation();
    if (
      window.confirm(
        '¿Revertir este movimiento?\n\nEl asiento original queda en el historial y se crea un movimiento compensatorio (REVERSA) que devuelve el stock a como estaba antes.'
      )
    ) {
      onReverse();
    }
  };

  return (
    <li
      className={`grid grid-cols-12 items-center gap-2 rounded-md border px-3 py-2 text-sm ${
        isReversa
          ? 'border-amber-500/30 bg-amber-900/10'
          : alreadyReversed
            ? 'border-slate-800 bg-slate-950 opacity-60'
            : 'border-slate-800 bg-slate-950'
      }`}
    >
      <span className="col-span-2 sm:col-span-1 font-mono text-xs text-slate-500">
        {formatTime(m.created_at)}
      </span>
      <span className="col-span-10 sm:col-span-3">
        <Badge variant={variant}>
          {TYPE_LABEL[m.movement_type] || m.movement_type}
        </Badge>
        {alreadyReversed && (
          <Badge variant="warning" className="ml-2">
            revertido
          </Badge>
        )}
      </span>
      <span className="col-span-5 sm:col-span-3 truncate">
        <span className="font-mono text-emerald-300">{m.product_code}</span>{' '}
        <span className="text-slate-400">{m.product_name}</span>
      </span>
      <span
        className={`col-span-3 sm:col-span-2 text-right font-mono font-semibold ${qtyClass}`}
      >
        {sign}
        {m.quantity_boxes} caj.
      </span>
      <span className="col-span-3 sm:col-span-2 text-right font-mono text-xs text-slate-500">
        → {m.stock_after_boxes}
      </span>
      <span className="col-span-1 flex justify-end">
        {canReverse && (
          <button
            onClick={askConfirm}
            disabled={reversing}
            title="Revertir este movimiento"
            className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-red-500/30 hover:text-red-200 disabled:opacity-30"
          >
            {reversing ? '...' : '↶'}
          </button>
        )}
      </span>
      {m.notes && (
        <span className="col-span-12 truncate pl-12 text-xs italic text-slate-500">
          {m.notes}
        </span>
      )}
    </li>
  );
}
