import { useEffect, useState } from 'react';

import { stockApi } from '../api/stockApi';
import ProduceModal from '../components/production/ProduceModal';
import Badge from '../components/ui/Badge';
import { notifyError } from '../store/uiStore';

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

export default function Production() {
  const [data, setData] = useState({ intermediates: [], finals: [] });
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [produceTarget, setProduceTarget] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        stockApi.getProducibility(),
        stockApi.listCurrent(),
      ]);
      setData(p);
      setStock(s);
    } catch (err) {
      notifyError(
        err.response?.data?.detail || 'Error al cargar producción posible'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  if (loading) {
    return <p className="text-slate-400">Cargando...</p>;
  }

  const hasAny = data.intermediates.length + data.finals.length > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
        <p>
          Con la materia prima, insumos y fibra que hay en stock ahora,{' '}
          <span className="text-emerald-300">esto es lo que se puede producir</span>:
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Cada producto con receta cargada calcula su tope a partir del
          componente más escaso. Click sobre una fila para registrar la
          producción.
        </p>
      </div>

      {!hasAny && (
        <div className="rounded-md border border-amber-500/30 bg-amber-900/10 p-4 text-sm text-amber-200">
          Ningún producto tiene receta configurada todavía. Andá a Stock,
          tocá sobre cualquier producto de fabricación propia, y editá la
          receta para que aparezca acá.
        </div>
      )}

      {data.intermediates.length > 0 && (
        <Section
          title="Intermedios"
          subtitle="Productos que se usan como componente de otros (cabos, bases, etc.)"
          rows={data.intermediates}
          onPick={(row) => setProduceTarget(row)}
        />
      )}

      {data.finals.length > 0 && (
        <Section
          title="Productos finales"
          subtitle="Productos terminados que no se usan como componente"
          rows={data.finals}
          onPick={(row) => setProduceTarget(row)}
        />
      )}

      <ProduceModal
        open={Boolean(produceTarget)}
        onClose={() => setProduceTarget(null)}
        products={stock}
        initialProductId={produceTarget?.product_id}
        initialQuantity={produceTarget?.producible_boxes}
        onProduced={() => {
          setProduceTarget(null);
          reload();
        }}
      />
    </div>
  );
}

function Section({ title, subtitle, rows, onPick }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900">
      <header className="border-b border-slate-800 bg-slate-800/40 px-4 py-2.5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-300">
          {title}
          <span className="ml-2 font-mono text-xs font-normal text-slate-500">
            {rows.length}
          </span>
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Producto
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Tipo
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Se pueden producir
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Limitante
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {rows.map((r) => {
              const exhausted = r.producible_boxes === 0;
              return (
                <tr
                  key={r.product_id}
                  onClick={() => !exhausted && onPick(r)}
                  className={`${exhausted ? 'opacity-50' : 'cursor-pointer'} hover:bg-slate-800/50`}
                  title={
                    exhausted
                      ? 'No alcanza el stock de componentes'
                      : 'Click para registrar producción'
                  }
                >
                  <td className="px-3 py-2 text-sm">
                    <span className="font-mono text-emerald-300">
                      {r.product_code}
                    </span>{' '}
                    <span className="text-slate-100">{r.product_name}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {CATEGORY_LABEL[r.product_category] || r.product_category}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`font-mono text-lg font-bold ${exhausted ? 'text-red-300' : 'text-emerald-300'}`}
                    >
                      {r.producible_boxes.toLocaleString('es-AR')}
                    </span>
                    <span className="ml-1 text-xs text-slate-500">cajas</span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.limiting_component_code && (
                      <>
                        <span className="font-mono text-slate-400">
                          {r.limiting_component_code}
                        </span>{' '}
                        <span className="text-slate-500">
                          {r.limiting_component_name}
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
