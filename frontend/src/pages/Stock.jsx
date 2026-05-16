import { useEffect, useMemo, useState } from 'react';

import { productsApi } from '../api/productsApi';
import { stockApi } from '../api/stockApi';
import ProduceModal from '../components/production/ProduceModal';
import RecipeModal from '../components/production/RecipeModal';
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

const CATEGORY_PLURAL = {
  ESCOBILLONES: 'Escobillones',
  ESCOBAS: 'Escobas',
  CEPILLOS: 'Cepillos',
  SECADORES: 'Secadores',
  BALDES_Y_ACCESORIOS: 'Varios',
  ESPONJAS: 'Esponjas',
  ANDENES: 'Andenes',
  BASES_Y_CABOS: 'Bases y cabos',
  MATERIA_PRIMA: 'Materia prima',
  INSUMOS: 'Insumos',
  FIBRA: 'Fibra',
};

// Section order within each tab. Mirrors the order of the original spreadsheet
// so a returning operator finds things where they expect them.
const SECTION_ORDER = {
  ARTICULOS: [
    'ESCOBILLONES',
    'ESCOBAS',
    'CEPILLOS',
    'SECADORES',
    'BALDES_Y_ACCESORIOS',
    'ESPONJAS',
    'ANDENES',
  ],
  BETTANIN_CHINA: ['IMPORTADO_BRASIL', 'IMPORTADO_CHINA'],
  BASES: ['BASES_Y_CABOS'],
  MATERIA_PRIMA: ['MATERIA_PRIMA'],
  INSUMOS: ['INSUMOS'],
  FIBRA: ['FIBRA'],
};

const SECTION_LABEL = {
  ...CATEGORY_PLURAL,
  IMPORTADO_BRASIL: 'Bettanin (Brasil)',
  IMPORTADO_CHINA: 'Importado · China',
};

function sectionKeyOf(product, tab) {
  if (tab === 'BETTANIN_CHINA') return product.origin;
  return product.category;
}

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
  const [produceOpen, setProduceOpen] = useState(false);
  const [recipeProduct, setRecipeProduct] = useState(null);
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

  // Pressing "/" anywhere focuses the search bar (skip if already typing)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/') return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      document.querySelector('input[type="search"]')?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Inline edit: quantity → registers an AJUSTE movement (audited, reversible)
  const onStockAdjust = async (product, newValue) => {
    const delta = newValue - product.quantity_boxes;
    if (delta === 0) return;
    try {
      await stockApi.createMovement({
        product_id: product.product_id,
        movement_type: 'AJUSTE',
        quantity_boxes: delta,
        quantity_units: 0,
        notes: `Ajuste manual: ${product.quantity_boxes} → ${newValue} cajas`,
      });
      notifySuccess(
        `${product.product_code}: ${delta > 0 ? '+' : ''}${delta} cajas`
      );
      loadStock();
    } catch (err) {
      notifyError(
        err.response?.data?.detail || 'No se pudo ajustar el stock'
      );
    }
  };

  // Inline edit: min stock → simple product update (GERENCIA only)
  const onMinUpdate = async (product, newValue) => {
    if (newValue === product.min_stock_boxes) return;
    try {
      await productsApi.update(product.product_id, {
        min_stock_boxes: Number(newValue),
      });
      notifySuccess(`Mínimo de ${product.product_code} actualizado`);
      loadStock();
    } catch (err) {
      notifyError(
        err.response?.data?.detail || 'No se pudo actualizar el mínimo'
      );
    }
  };

  const onExport = async () => {
    try {
      const blob = await stockApi.exportXlsx();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-keel-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notifySuccess('Stock exportado');
    } catch (err) {
      notifyError('No se pudo exportar el stock');
    }
  };

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
            onClick={onExport}
            title="Descargar stock actual como Excel"
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            ⤓ Exportar
          </button>
          <button
            onClick={() => setProduceOpen(true)}
            title="Registrar producción que descuenta materia prima e insumos"
            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
          >
            🏭 Producir
          </button>
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
          <SectionedStock
            rows={visible}
            tab={tab}
            onRowClick={setHistoryProduct}
            onStockAdjust={onStockAdjust}
            onMinUpdate={onMinUpdate}
            isGerencia={isGerencia}
          />
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
        onCreated={(created, openRecipe) => {
          setNewProductOpen(false);
          loadStock();
          if (openRecipe && created) {
            setRecipeProduct({
              product_id: created.id,
              product_code: created.code,
              product_name: created.name,
            });
          }
        }}
      />

      <HistoryModal
        product={historyProduct}
        onClose={() => setHistoryProduct(null)}
        onAfterChange={() => loadStock()}
        onEditRecipe={(p) => {
          setHistoryProduct(null);
          setRecipeProduct(p);
        }}
        isGerencia={isGerencia}
      />

      <ProduceModal
        open={produceOpen}
        onClose={() => setProduceOpen(false)}
        products={stock}
        onProduced={() => {
          setProduceOpen(false);
          loadStock();
        }}
      />

      <RecipeModal
        open={Boolean(recipeProduct)}
        onClose={() => setRecipeProduct(null)}
        product={recipeProduct}
        products={stock}
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
        onKeyDown={(e) => e.key === 'Escape' && onChange('')}
        placeholder="Buscar por código o nombre... (atajo: / )"
        className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 pl-9 pr-8 text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
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

function SectionedStock({
  rows,
  tab,
  onRowClick,
  onStockAdjust,
  onMinUpdate,
  isGerencia,
}) {
  // Group rows by section key, preserving the declared section order.
  const sections = useMemo(() => {
    const order = SECTION_ORDER[tab] || [];
    const groups = new Map(order.map((k) => [k, []]));
    for (const r of rows) {
      const key = sectionKeyOf(r, tab);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    // sort each group alphabetically by name
    for (const list of groups.values()) {
      list.sort((a, b) =>
        a.product_name.localeCompare(b.product_name, 'es', { sensitivity: 'base' })
      );
    }
    // remove empty groups, return [key, items][] in declared order
    return Array.from(groups.entries()).filter(([, list]) => list.length > 0);
  }, [rows, tab]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-8 text-center text-sm text-slate-500">
        Sin productos en esta categoría
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {sections.map(([key, items]) => (
        <SectionBlock
          key={key}
          title={SECTION_LABEL[key] || key}
          items={items}
          tab={tab}
          onRowClick={onRowClick}
          onStockAdjust={onStockAdjust}
          onMinUpdate={onMinUpdate}
          isGerencia={isGerencia}
        />
      ))}
    </div>
  );
}

function SectionBlock({
  title,
  items,
  tab,
  onRowClick,
  onStockAdjust,
  onMinUpdate,
  isGerencia,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const totalBoxes = items.reduce((s, r) => s + r.quantity_boxes, 0);
  const belowMin = items.filter((r) => r.is_below_minimum).length;

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900">
      <header
        onClick={() => setCollapsed((v) => !v)}
        className="flex cursor-pointer items-center justify-between gap-2 border-b border-slate-800 bg-slate-800/40 px-4 py-2.5 hover:bg-slate-800/70"
      >
        <div className="flex items-baseline gap-3">
          <span
            className={`inline-block text-slate-500 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          >
            ▶
          </span>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-300">
            {title}
          </h3>
          <span className="font-mono text-xs text-slate-500">
            {items.length} productos · {totalBoxes.toLocaleString('es-AR')} cajas
          </span>
        </div>
        {belowMin > 0 && (
          <Badge variant="danger">{belowMin} bajo mín.</Badge>
        )}
      </header>
      {!collapsed && (
        <StockTable
          rows={items}
          tab={tab}
          onRowClick={onRowClick}
          onStockAdjust={onStockAdjust}
          onMinUpdate={onMinUpdate}
          isGerencia={isGerencia}
        />
      )}
    </section>
  );
}

function StockTable({
  rows,
  tab,
  onRowClick,
  onStockAdjust,
  onMinUpdate,
  isGerencia,
}) {
  const showOrigin = tab === 'BETTANIN_CHINA';

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-800">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Código
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Producto
            </th>
            {showOrigin && (
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Origen
              </th>
            )}
            <th
              className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500"
              title="Fracción: unidades por caja"
            >
              FR
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cajas
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
              Unidades
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
              Mínimo
            </th>
            <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
              Estado
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-950/40">
          {rows.map((r) => (
            <tr key={r.product_id} className="hover:bg-slate-800/50">
              <td
                onClick={() => onRowClick(r)}
                className="cursor-pointer px-3 py-2 font-mono text-sm text-emerald-300"
              >
                {r.product_code}
              </td>
              <td
                onClick={() => onRowClick(r)}
                className="cursor-pointer px-3 py-2 text-sm text-slate-100"
              >
                {r.product_name}
              </td>
              {showOrigin && (
                <td
                  onClick={() => onRowClick(r)}
                  className="cursor-pointer px-3 py-2 text-xs"
                >
                  <Badge
                    variant={
                      r.origin === 'IMPORTADO_BRASIL' ? 'info' : 'warning'
                    }
                  >
                    {ORIGIN_LABEL[r.origin] || r.origin}
                  </Badge>
                </td>
              )}
              <td
                onClick={() => onRowClick(r)}
                className="cursor-pointer px-3 py-2 text-right font-mono text-xs text-slate-400"
              >
                {r.pack_size}
              </td>
              <td className="px-3 py-2 text-right">
                <EditableNumberCell
                  value={r.quantity_boxes}
                  onSave={(v) => onStockAdjust(r, v)}
                  format={(v) => v.toLocaleString('es-AR')}
                  className={`font-mono text-sm ${r.quantity_boxes < 0 ? 'font-semibold text-red-300' : 'text-slate-100'}`}
                  title="Click para ajustar (registra movimiento AJUSTE en historial)"
                />
              </td>
              <td
                onClick={() => onRowClick(r)}
                className="cursor-pointer px-3 py-2 text-right font-mono text-sm text-slate-400"
              >
                {r.quantity_units.toLocaleString('es-AR')}
              </td>
              <td className="px-3 py-2 text-right">
                <EditableNumberCell
                  value={r.min_stock_boxes}
                  onSave={(v) => onMinUpdate(r, v)}
                  disabled={!isGerencia}
                  className="font-mono text-xs text-slate-400"
                  title={
                    isGerencia
                      ? 'Click para editar el mínimo'
                      : 'Solo GERENCIA puede editar el mínimo'
                  }
                />
              </td>
              <td
                onClick={() => onRowClick(r)}
                className="cursor-pointer px-3 py-2 text-center"
              >
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

function EditableNumberCell({
  value,
  onSave,
  format,
  className = '',
  disabled = false,
  title,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = async () => {
    setEditing(false);
    const parsed = parseInt(draft, 10);
    if (!Number.isFinite(parsed) || parsed === value) return;
    await onSave(parsed);
  };

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setEditing(true)}
        title={title}
        className={`rounded px-1 py-0.5 ${disabled ? 'cursor-default' : 'hover:bg-emerald-500/10 hover:ring-1 hover:ring-emerald-500/40 cursor-text'} ${className}`}
      >
        {format ? format(value) : value}
      </button>
    );
  }

  return (
    <input
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft(String(value));
          setEditing(false);
        }
      }}
      autoFocus
      onFocus={(e) => e.target.select()}
      className={`w-24 rounded border border-emerald-500 bg-slate-900 px-2 py-0.5 text-right ${className}`}
    />
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

const INITIAL_PRODUCT_FORM = {
  code: '',
  name: '',
  description: '',
  category: 'ESCOBILLONES',
  origin: 'FABRICACION_PROPIA',
  pack_size: 1,
  min_stock_boxes: 0,
  configureRecipe: false,
};

function NewProductModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(INITIAL_PRODUCT_FORM);
  const [submitting, setSubmitting] = useState(false);

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const isPropia = form.origin === 'FABRICACION_PROPIA';

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await productsApi.create({
        code: form.code,
        name: form.name,
        description: form.description || null,
        category: form.category,
        origin: form.origin,
        pack_size: Number(form.pack_size) || 1,
        min_stock_boxes: Number(form.min_stock_boxes) || 0,
      });
      notifySuccess(`Producto ${form.code} creado`);
      const shouldOpenRecipe = isPropia && form.configureRecipe;
      setForm(INITIAL_PRODUCT_FORM);
      onCreated(created, shouldOpenRecipe);
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
        {isPropia && (
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={form.configureRecipe}
              onChange={(e) => update('configureRecipe', e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-emerald-500"
            />
            <span>
              <span className="text-slate-100">
                Configurar receta al guardar
              </span>
              <span className="ml-1 text-xs text-slate-500">
                (definí qué materia prima / insumos / fibra consume cada caja
                producida)
              </span>
            </span>
          </label>
        )}
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

function HistoryModal({ product, onClose, onAfterChange, onEditRecipe, isGerencia: isGerenciaProp }) {
  const isGerenciaStore = useAuthStore(selectIsGerencia);
  const isGerencia = isGerenciaProp ?? isGerenciaStore;
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
      {isGerencia && product && onEditRecipe && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => onEditRecipe(product)}
            className="rounded-md border border-emerald-500/40 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/10"
          >
            ✎ Editar receta
          </button>
        </div>
      )}
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
