import { useEffect, useMemo, useState } from 'react';

import { productsApi } from '../../api/productsApi';
import { stockApi } from '../../api/stockApi';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import { notifyError, notifySuccess } from '../../store/uiStore';

export default function ProduceModal({
  open,
  onClose,
  products,
  onProduced,
  initialProductId,
  initialQuantity,
}) {
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [recipe, setRecipe] = useState([]);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    if (!open) {
      setProductId('');
      setQty(1);
      setNotes('');
      setRecipe([]);
      setConflict(null);
      return;
    }
    if (initialProductId) setProductId(initialProductId);
    if (initialQuantity && initialQuantity > 0) setQty(initialQuantity);
  }, [open, initialProductId, initialQuantity]);

  // Only finished-good categories make sense as "things to produce"
  const finishedProducts = useMemo(
    () =>
      products
        .filter(
          (p) =>
            !['MATERIA_PRIMA', 'INSUMOS', 'FIBRA'].includes(p.category) &&
            p.origin === 'FABRICACION_PROPIA'
        )
        .sort((a, b) =>
          a.product_name.localeCompare(b.product_name, 'es', {
            sensitivity: 'base',
          })
        ),
    [products]
  );

  useEffect(() => {
    if (!productId) {
      setRecipe([]);
      return;
    }
    setLoadingRecipe(true);
    productsApi
      .getRecipe(productId)
      .then(setRecipe)
      .catch(() => setRecipe([]))
      .finally(() => setLoadingRecipe(false));
  }, [productId]);

  const preview = useMemo(() => {
    return recipe.map((r) => {
      const needed = r.quantity_per_box * qty;
      const after = r.component_current_units - needed;
      return {
        ...r,
        units_needed: needed,
        units_after: after,
        shortage: after < 0 ? -after : 0,
      };
    });
  }, [recipe, qty]);

  const hasShortage = preview.some((p) => p.shortage > 0);

  const submit = async (force = false) => {
    if (!productId || qty <= 0) return;
    setSubmitting(true);
    try {
      const result = await stockApi.produce({
        product_id: productId,
        quantity_boxes: qty,
        notes: notes || null,
        force,
      });
      notifySuccess(
        `Producidas ${result.finished_quantity_boxes} caja(s) de ${result.finished_product_code}`
      );
      setConflict(null);
      onProduced();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail?.code === 'INSUFFICIENT_COMPONENTS') {
        setConflict(detail.shortages);
      } else {
        notifyError(detail || 'No se pudo registrar la producción');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar producción"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-400">
              Producto terminado
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">— Seleccionar —</option>
              {finishedProducts.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} ({p.product_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">
              Cajas producidas
            </label>
            <input
              type="number"
              min="1"
              value={qty || ''}
              onChange={(e) => setQty(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-right font-mono text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {productId && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Componentes a consumir
              </h4>
              {hasShortage && <Badge variant="danger">Stock insuficiente</Badge>}
            </div>
            {loadingRecipe ? (
              <p className="text-xs text-slate-500">Cargando receta...</p>
            ) : recipe.length === 0 ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-900/20 p-3 text-xs text-amber-200">
                Este producto no tiene receta configurada. Click sobre la fila
                del producto en Stock para abrir su historial y agregar
                "Editar receta".
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-slate-800">
                <table className="min-w-full divide-y divide-slate-800 text-xs">
                  <thead className="bg-slate-900">
                    <tr>
                      <th className="px-2 py-1.5 text-left uppercase text-slate-500">
                        Componente
                      </th>
                      <th className="px-2 py-1.5 text-right uppercase text-slate-500">
                        Por caja
                      </th>
                      <th className="px-2 py-1.5 text-right uppercase text-slate-500">
                        Total
                      </th>
                      <th className="px-2 py-1.5 text-right uppercase text-slate-500">
                        Disponible
                      </th>
                      <th className="px-2 py-1.5 text-right uppercase text-slate-500">
                        Queda
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {preview.map((p) => (
                      <tr
                        key={p.id}
                        className={
                          p.shortage > 0
                            ? 'bg-red-900/20'
                            : ''
                        }
                      >
                        <td className="px-2 py-1.5">
                          <span className="font-mono text-emerald-300">
                            {p.component_code}
                          </span>{' '}
                          <span className="text-slate-400">
                            {p.component_name}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-400">
                          {p.quantity_per_box}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-100">
                          {p.units_needed.toLocaleString('es-AR')}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-400">
                          {p.component_current_units.toLocaleString('es-AR')}
                        </td>
                        <td
                          className={`px-2 py-1.5 text-right font-mono font-semibold ${p.units_after < 0 ? 'text-red-300' : 'text-emerald-300'}`}
                        >
                          {p.units_after.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-400">
            Notas (opcional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {conflict && (
          <div className="rounded-md border border-amber-500/40 bg-amber-900/20 p-3 text-xs">
            <p className="font-semibold text-amber-200">
              El stock de componentes no alcanza:
            </p>
            <ul className="mt-1 space-y-0.5 text-amber-300">
              {conflict.map((c) => (
                <li key={c.component_code}>
                  · {c.component_code} {c.component_name}: faltan{' '}
                  {c.shortage} unidades
                </li>
              ))}
            </ul>
            <p className="mt-2 text-amber-200">
              Si igual querés producir (y dejar componentes en negativo), tocá
              "Forzar producción".
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Cancelar
          </button>
          {conflict ? (
            <button
              onClick={() => submit(true)}
              disabled={submitting}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              Forzar producción
            </button>
          ) : (
            <button
              onClick={() => submit(false)}
              disabled={submitting || !productId || qty <= 0}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {submitting ? 'Procesando...' : 'Registrar producción'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
