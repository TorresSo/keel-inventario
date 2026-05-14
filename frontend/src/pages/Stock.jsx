import { useEffect, useMemo, useState } from 'react';

import { productsApi } from '../api/productsApi';
import { stockApi } from '../api/stockApi';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { selectIsGerencia, useAuthStore } from '../store/authStore';
import { notifyError, notifySuccess } from '../store/uiStore';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'ARTICULOS', label: 'Artículos' },
  { key: 'BETTANIN_CHINA', label: 'Bettanin · China' },
  { key: 'BASES', label: 'Bases' },
  { key: 'MATERIA_PRIMA', label: 'Materia Prima' },
  { key: 'INSUMOS', label: 'Insumos' },
  { key: 'FIBRA', label: 'Fibra' },
];

const CATEGORY_LABEL = {
  ESCOBILLONES: 'Escobillón',
  ESCOBAS: 'Escoba',
  CEPILLOS: 'Cepillo',
  SECADORES: 'Secador',
  BALDES_Y_ACCESORIOS: 'Varios',
  ESPONJAS: 'Esponja',
  ANDENES: 'Andén',
  BASES_Y_CABOS: 'Base / Cabo',
  MATERIA_PRIMA: 'Materia prima',
  INSUMOS: 'Insumo',
  FIBRA: 'Fibra',
};

const ORIGIN_LABEL = {
  FABRICACION_PROPIA: 'Propio',
  IMPORTADO_BRASIL: 'Brasil',
  IMPORTADO_CHINA: 'China',
};

const MOVEMENT_TYPES = [
  { value: 'INGRESO_PRODUCCION', label: 'Ingreso · Producción', sign: 1 },
  { value: 'INGRESO_RECEPCION', label: 'Ingreso · Recepción', sign: 1 },
  { value: 'EGRESO_DESPACHO', label: 'Egreso · Despacho', sign: -1 },
  { value: 'EGRESO_MERMA', label: 'Egreso · Merma', sign: -1 },
  { value: 'AJUSTE', label: 'Ajuste manual', sign: 1 },
];

function tabFor(product) {
  if (
    product.origin === 'IMPORTADO_BRASIL' ||
    product.origin === 'IMPORTADO_CHINA'
  )
    return 'BETTANIN_CHINA';
  if (product.category === 'MATERIA_PRIMA') return 'MATERIA_PRIMA';
  if (product.category === 'INSUMOS') return 'INSUMOS';
  if (product.category === 'FIBRA') return 'FIBRA';
  if (product.category === 'BASES_Y_CABOS') return 'BASES';
  return 'ARTICULOS';
}

function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Stock() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ARTICULOS');
  const [search, setSearch] = useState('');
  const [movementOpen, setMovementOpen] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);

  const isGerencia = useAuthStore(selectIsGerencia);

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

  // Pre-bucket by tab (O(N) once instead of O(N) per re-render)
  const buckets = useMemo(() => {
    const out = Object.fromEntries(TABS.map((t) => [t.key, []]));
    for (const p of stock) out[tabFor(p)].push(p);
    return out;
  }, [stock]);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, buckets[t.key].length])),
    [buckets]
  );

  // Filter active tab by search
  const visible = useMemo(() => {
    const list = buckets[tab] || [];
    const q = normalize(search.trim());
    if (!q) return list;
    return list.filter(
      (p) =>
        normalize(p.product_code).includes(q) ||
        normalize(p.product_name).includes(q)
    );
  }, [buckets, tab, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} />
        <div className="flex flex-1 justify-end gap-2">
          <button
            onClick={() => setMovementOpen(true)}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            + Movimiento
          </button>
          {isGerencia && (
            <button
              onClick={() => setNewProductOpen(true)}
              className="rounded-md border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10"
            >
              + Producto
            </button>
          )}
        </div>
      </div>

      <Tabs tabs={TABS} counts={counts} active={tab} onChange={setTab} />

      {loading ? (
        <p className="text-slate-400">Cargando...</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {visible.length} {visible.length === 1 ? 'producto' : 'productos'}
            {search && ` · filtrado por "${search}"`}
          </p>
          <StockTable rows={visible} tab={tab} onRowClick={setHistoryProduct} />
        </>
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

      <NewProductModal
        open={newProductOpen}
        onClose={() => setNewProductOpen(false)}
        onCreated={() => {
          setNewProductOpen(false);
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SearchBar({ value, onChange }) {
  return (
    <div className="relative w-full sm:w-80">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar por código o nombre..."
        className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-slate-500 hover:text-slate-200"
          aria-label="Limpiar"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function Tabs({ tabs, counts, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-800">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative -mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
              isActive
                ? 'border-emerald-500 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-100'
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-mono ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {counts[t.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StockTable({ rows, tab, onRowClick }) {
  const showOrigin = tab === 'BETTANIN_CHINA';

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
            {showOrigin && (
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                Origen
              </th>
            )}
            <th
              className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400"
              title="Fracción: unidades por caja"
            >
              FR
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
              Cajas
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
              Unidades
            </th>
            <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
              Mínimo
            </th>
            <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              Estado
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700 bg-slate-900">
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={showOrigin ? 8 : 7}
                className="px-3 py-8 text-center text-sm text-slate-500"
              >
                Sin productos en esta categoría
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.product_id}
              onClick={() => onRowClick(r)}
              className="cursor-pointer hover:bg-slate-800/50"
            >
              <td className="px-3 py-2 font-mono text-sm text-emerald-300">
                {r.product_code}
              </td>
              <td className="px-3 py-2 text-sm">
                <p className="text-slate-100">{r.product_name}</p>
                <p className="text-xs text-slate-500">
                  {CATEGORY_LABEL[r.category] || r.category}
                </p>
              </td>
              {showOrigin && (
                <td className="px-3 py-2 text-xs">
                  <Badge
                    variant={
                      r.origin === 'IMPORTADO_BRASIL' ? 'info' : 'warning'
                    }
                  >
                    {ORIGIN_LABEL[r.origin] || r.origin}
                  </Badge>
                </td>
              )}
              <td className="px-3 py-2 text-right font-mono text-xs text-slate-400">
                {r.pack_size}
              </td>
              <td
                className={`px-3 py-2 text-right font-mono text-sm ${r.quantity_boxes < 0 ? 'font-semibold text-red-300' : ''}`}
              >
                {r.quantity_boxes.toLocaleString('es-AR')}
              </td>
              <td className="px-3 py-2 text-right font-mono text-sm text-slate-300">
                {r.quantity_units.toLocaleString('es-AR')}
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

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-400">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
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

  const sortedProducts = useMemo(
    () =>
      [...products].sort((a, b) =>
        a.product_name.localeCompare(b.product_name, 'es')
      ),
    [products]
  );

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
            {sortedProducts.map((p) => (
              <option key={p.product_id} value={p.product_id}>
                {p.product_name} ({p.product_code})
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
        <Field label={`Cantidad en cajas${isEgreso ? ' (se restará del stock)' : ''}`}>
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

function NewProductModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    category: 'ESCOBILLONES',
    origin: 'FABRICACION_PROPIA',
    pack_size: 1,
    min_stock_boxes: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await productsApi.create({
        ...form,
        description: form.description || null,
        pack_size: Number(form.pack_size) || 1,
        min_stock_boxes: Number(form.min_stock_boxes) || 0,
      });
      notifySuccess(`Producto ${form.code} creado`);
      setForm({
        code: '',
        name: '',
        description: '',
        category: 'ESCOBILLONES',
        origin: 'FABRICACION_PROPIA',
        pack_size: 1,
        min_stock_boxes: 0,
      });
      onCreated();
    } catch (err) {
      notifyError(err.response?.data?.detail || 'No se pudo crear el producto');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo producto"
      className="max-w-xl"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Código" hint="Identificador único — ej. 212, BT487, ESC-99">
            <input
              type="text"
              value={form.code}
              onChange={(e) => update('code', e.target.value)}
              required
              maxLength={50}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm focus:border-emerald-500 focus:outline-none"
            />
          </Field>
          <Field label="Pack size (FR)" hint="Unidades por caja">
            <input
              type="number"
              min="1"
              value={form.pack_size}
              onChange={(e) => update('pack_size', e.target.value)}
              required
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-right font-mono text-sm focus:border-emerald-500 focus:outline-none"
            />
          </Field>
        </div>
        <Field label="Nombre">
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            required
            maxLength={255}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Categoría">
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Origen">
            <select
              value={form.origin}
              onChange={(e) => update('origin', e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="FABRICACION_PROPIA">Fabricación propia</option>
              <option value="IMPORTADO_BRASIL">Importado · Brasil</option>
              <option value="IMPORTADO_CHINA">Importado · China</option>
            </select>
          </Field>
        </div>
        <Field
          label="Stock mínimo (cajas)"
          hint="Cuando el stock baje de este número, se va a marcar en alerta"
        >
          <input
            type="number"
            min="0"
            value={form.min_stock_boxes}
            onChange={(e) => update('min_stock_boxes', e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-right font-mono text-sm focus:border-emerald-500 focus:outline-none"
          />
        </Field>
        <Field label="Descripción (opcional)">
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={2}
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
            {submitting ? 'Creando...' : 'Crear producto'}
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
                      className={`px-3 py-2 text-right font-mono text-sm ${m.stock_after_boxes < 0 ? 'font-semibold text-red-300' : ''}`}
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
