import { useEffect, useMemo, useState } from 'react';

import { stockApi } from '../api/stockApi';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { selectIsGerencia, useAuthStore } from '../store/authStore';
import { notifyError, notifySuccess } from '../store/uiStore';

const MOVEMENT_TYPES = [
  { value: 'INGRESO_PRODUCCION', label: 'Ingreso · Producción', sign: 1 },
  { value: 'INGRESO_RECEPCION', label: 'Ingreso · Recepción', sign: 1 },
  { value: 'EGRESO_DESPACHO', label: 'Egreso · Despacho', sign: -1 },
  { value: 'EGRESO_MERMA', label: 'Egreso · Merma', sign: -1 },
  { value: 'AJUSTE', label: 'Ajuste manual', sign: 1 },
];

export default function Stock() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [movementOpen, setMovementOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);

  const loadStock = () => {
    setLoading(true);
    stockApi
      .listCurrent()
      .then(setStock)
      .catch((err) =>
        notifyError(err.response?.data?.detail || 'Error al cargar stock')
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStock();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {stock.length} productos activos
        </p>
        <button
          onClick={() => setMovementOpen(true)}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Registrar movimiento
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : (
        <StockTable rows={stock} onRowClick={setHistoryProduct} />
      )}

      <MovementModal
        open={movementOpen}
        onClose={() => setMovementOpen(false)}
        products={stock}
        onCreated={() => {
          setMovementOpen(false);
          loadStock();
        }}
      />

      <HistoryModal
        product={historyProduct}
        onClose={() => setHistoryProduct(null)}
        onAfterChange={() => loadStock()}
      />
    </div>
  );
}

function StockTable({ rows, onRowClick }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="min-w-full divide-y divide-slate-700">
        <thead className="bg-slate-800">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              Código
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              Producto
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              Categoría
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
              Cajas
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
              Mínimo
            </th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              Alerta
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700 bg-slate-900">
          {rows.map((r) => (
            <tr
              key={r.product_id}
              onClick={() => onRowClick(r)}
              className="cursor-pointer hover:bg-slate-800/50"
            >
              <td className="px-3 py-2 font-mono text-sm text-emerald-300">
                {r.product_code}
              </td>
              <td className="px-3 py-2 text-sm">{r.product_name}</td>
              <td className="px-3 py-2 text-xs text-slate-500">
                {r.category}
              </td>
              <td
                className={`px-3 py-2 text-right font-mono text-sm ${r.quantity_boxes < 0 ? 'text-red-300 font-semibold' : ''}`}
              >
                {r.quantity_boxes}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-slate-500">
                {r.min_stock_boxes}
              </td>
              <td className="px-3 py-2 text-center">
                {r.is_below_minimum ? (
                  <Badge variant="danger">Bajo</Badge>
                ) : (
                  <Badge variant="success">OK</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function MovementModal({ open, onClose, products, onCreated }) {
  const [productId, setProductId] = useState('');
  const [type, setType] = useState('INGRESO_PRODUCCION');
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const typeMeta = MOVEMENT_TYPES.find((t) => t.value === type);
  const isEgreso = typeMeta?.sign === -1;

  const submit = async (e) => {
    e.preventDefault();
    if (!productId || quantity <= 0) return;
    setSubmitting(true);
    try {
      const signedQty = isEgreso ? -Math.abs(quantity) : Math.abs(quantity);
      await stockApi.createMovement({
        product_id: productId,
        movement_type: type,
        quantity_boxes: signedQty,
        quantity_units: 0,
        notes: notes || null,
      });
      notifySuccess('Movimiento registrado');
      setProductId('');
      setQuantity(0);
      setNotes('');
      onCreated();
    } catch (err) {
      notifyError(err.response?.data?.detail || 'No se pudo registrar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo movimiento de stock">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Producto">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="">— Seleccionar —</option>
            {products.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {p.product_code} — {p.product_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            {MOVEMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Cantidad en cajas${isEgreso ? ' (se restará)' : ''}`}>
          <input
            type="number"
            min="1"
            value={quantity || ''}
            onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
            required
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-right font-mono text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Notas (opcional)">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {submitting ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ product, onClose, onAfterChange }) {
  const isGerencia = useAuthStore(selectIsGerencia);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reversingId, setReversingId] = useState(null);
  const [pendingReverse, setPendingReverse] = useState(null);

  const load = () => {
    if (!product) return;
    setLoading(true);
    stockApi
      .listMovements(product.product_id, { limit: 50 })
      .then(setMovements)
      .catch((err) =>
        notifyError(err.response?.data?.detail || 'Error al cargar historial')
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.product_id]);

  const reversedIds = useMemo(() => {
    const s = new Set();
    movements.forEach((m) => {
      if (m.reversed_movement_id) s.add(m.reversed_movement_id);
    });
    return s;
  }, [movements]);

  const doReverse = async (movementId, confirmNegative = false) => {
    setReversingId(movementId);
    try {
      await stockApi.reverseMovement(movementId, {
        confirm_negative: confirmNegative,
      });
      notifySuccess('Movimiento revertido');
      setPendingReverse(null);
      load();
      onAfterChange();
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

  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      title={
        product
          ? `Historial · ${product.product_code} ${product.product_name}`
          : ''
      }
      className="max-w-3xl"
    >
      <div className="max-h-[60vh] overflow-y-auto">
        {loading ? (
          <p className="text-slate-400">Cargando...</p>
        ) : movements.length === 0 ? (
          <p className="text-sm text-slate-500">
            Sin movimientos registrados para este producto.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs uppercase text-slate-400">
                  Fecha
                </th>
                <th className="px-3 py-2 text-left text-xs uppercase text-slate-400">
                  Tipo
                </th>
                <th className="px-3 py-2 text-right text-xs uppercase text-slate-400">
                  Δ
                </th>
                <th className="px-3 py-2 text-right text-xs uppercase text-slate-400">
                  Luego
                </th>
                {isGerencia && (
                  <th className="px-3 py-2 text-center text-xs uppercase text-slate-400"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {movements.map((m) => {
                const alreadyReversed = reversedIds.has(m.id);
                const isReversa = m.movement_type === 'REVERSA';
                return (
                  <tr key={m.id} className={isReversa ? 'bg-amber-900/10' : ''}>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {m.movement_type}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-sm ${m.quantity_boxes < 0 ? 'text-red-300' : 'text-emerald-300'}`}
                    >
                      {m.quantity_boxes > 0 ? '+' : ''}
                      {m.quantity_boxes}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono text-sm ${m.stock_after_boxes < 0 ? 'text-red-300 font-semibold' : ''}`}
                    >
                      {m.stock_after_boxes}
                    </td>
                    {isGerencia && (
                      <td className="px-3 py-2 text-center">
                        {!isReversa && (
                          <button
                            disabled={
                              alreadyReversed || reversingId === m.id
                            }
                            onClick={() => doReverse(m.id)}
                            title={
                              alreadyReversed
                                ? 'Ya revertido'
                                : 'Revertir movimiento'
                            }
                            className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            ↶
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pendingReverse && (
        <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-900/20 p-3 text-sm">
          <p className="font-semibold text-amber-200">
            Esta reversión deja el stock en negativo
          </p>
          <p className="mt-1 text-xs text-amber-300">
            Stock actual: {pendingReverse.detail.current_boxes} → resultará en{' '}
            {pendingReverse.detail.boxes_after_reversal} cajas
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setPendingReverse(null)}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs"
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
  );
}
