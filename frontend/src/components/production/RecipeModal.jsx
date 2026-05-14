import { useEffect, useMemo, useState } from 'react';

import { productsApi } from '../../api/productsApi';
import Modal from '../ui/Modal';
import { notifyError, notifySuccess } from '../../store/uiStore';

export default function RecipeModal({ open, onClose, product, products }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Components candidates: anything that's not the product itself.
  // Sorted; raw material / supplies / fiber bubble up first.
  const candidates = useMemo(() => {
    if (!product) return [];
    const priority = (p) =>
      ({ MATERIA_PRIMA: 0, INSUMOS: 1, FIBRA: 2 }[p.category] ?? 3);
    return products
      .filter((p) => p.product_id !== product.product_id)
      .sort((a, b) => {
        const d = priority(a) - priority(b);
        if (d !== 0) return d;
        return a.product_name.localeCompare(b.product_name, 'es');
      });
  }, [products, product]);

  useEffect(() => {
    if (!open || !product) return;
    setLoading(true);
    productsApi
      .getRecipe(product.product_id)
      .then((r) =>
        setItems(
          r.map((x) => ({
            component_id: x.component_id,
            quantity_per_box: x.quantity_per_box,
            component_code: x.component_code,
            component_name: x.component_name,
          }))
        )
      )
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, product]);

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      { component_id: '', quantity_per_box: 1 },
    ]);
  };

  const updateRow = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeRow = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = items
        .filter((it) => it.component_id && it.quantity_per_box > 0)
        .map((it) => ({
          component_id: it.component_id,
          quantity_per_box: Number(it.quantity_per_box),
        }));
      await productsApi.setRecipe(product.product_id, payload);
      notifySuccess('Receta guardada');
      onClose();
    } catch (err) {
      notifyError(err.response?.data?.detail || 'No se pudo guardar la receta');
    } finally {
      setSaving(false);
    }
  };

  if (!product) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Receta · ${product.product_code} ${product.product_name}`}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Definí qué componentes (materia prima, insumos, fibra, etc.) consume
          cada caja producida de este terminado. Cuando registres una producción,
          el sistema descuenta automáticamente las cantidades configuradas.
        </p>

        {loading ? (
          <p className="text-slate-400">Cargando...</p>
        ) : (
          <div className="space-y-2">
            {items.length === 0 && (
              <p className="rounded-md border border-slate-700 bg-slate-900 px-3 py-4 text-center text-xs text-slate-500">
                Sin componentes configurados. Agregá uno para empezar.
              </p>
            )}
            {items.map((it, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5"
              >
                <select
                  value={it.component_id}
                  onChange={(e) =>
                    updateRow(idx, { component_id: e.target.value })
                  }
                  className="col-span-8 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">— Seleccionar componente —</option>
                  {candidates.map((c) => (
                    <option key={c.product_id} value={c.product_id}>
                      [{c.product_code}] {c.product_name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={it.quantity_per_box}
                  onChange={(e) =>
                    updateRow(idx, {
                      quantity_per_box: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  title="Unidades del componente consumidas por caja producida"
                  className="col-span-3 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right font-mono text-sm focus:border-emerald-500 focus:outline-none"
                />
                <button
                  onClick={() => removeRow(idx)}
                  className="col-span-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-red-500/30 hover:text-red-200"
                  title="Quitar"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={addRow}
              className="w-full rounded-md border border-dashed border-slate-700 px-3 py-2 text-sm text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300"
            >
              + Agregar componente
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar receta'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
