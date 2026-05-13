import { useEffect, useState } from 'react';

import { ordersApi } from '../api/ordersApi';
import Badge from '../components/ui/Badge';
import FileDropzone from '../components/ui/FileDropzone';
import Modal from '../components/ui/Modal';
import { notifyError, notifySuccess } from '../store/uiStore';

export default function Orders() {
  const [recentOrders, setRecentOrders] = useState([]);
  const [previewedOrders, setPreviewedOrders] = useState([]);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [negativeConfirm, setNegativeConfirm] = useState(null);

  const loadRecent = () => {
    ordersApi
      .list({ limit: 20 })
      .then(setRecentOrders)
      .catch(() => {});
  };

  useEffect(() => {
    loadRecent();
  }, []);

  const onUpload = async (file) => {
    setUploading(true);
    try {
      const result = await ordersApi.upload(file);
      setUploadResult(result);
      setPreviewedOrders(result.orders);
      notifySuccess(
        `${result.orders.length} pedido(s) parseado(s) desde ${file.name}`
      );
      loadRecent();
    } catch (err) {
      notifyError(
        err.response?.data?.detail || 'Error al procesar el archivo'
      );
    } finally {
      setUploading(false);
    }
  };

  const updateItem = async (orderId, itemId, newQty) => {
    try {
      const updated = await ordersApi.updateItem(orderId, itemId, newQty);
      setPreviewedOrders((prev) =>
        prev.map((o) =>
          o.id !== orderId
            ? o
            : {
                ...o,
                items: o.items.map((i) => (i.id === itemId ? updated : i)),
              }
        )
      );
    } catch (err) {
      notifyError(
        err.response?.data?.detail || 'No se pudo editar el ítem'
      );
    }
  };

  const confirmOrder = async (orderId, acceptNegative = false) => {
    try {
      await ordersApi.confirm(orderId, acceptNegative);
      notifySuccess('Despacho confirmado');
      setPreviewedOrders((prev) => prev.filter((o) => o.id !== orderId));
      setNegativeConfirm(null);
      loadRecent();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail?.code === 'DISPATCH_WOULD_GO_NEGATIVE') {
        setNegativeConfirm({ orderId, conflicts: detail.conflicts });
      } else {
        notifyError(detail || 'No se pudo confirmar el despacho');
      }
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Subir archivo de pedido
        </h3>
        <FileDropzone onFile={onUpload} loading={uploading} />
        {uploadResult?.parsed_via_ocr && (
          <p className="mt-2 text-xs text-purple-300">
            Este archivo fue parseado por OCR. Verificá cantidades y códigos
            antes de confirmar.
          </p>
        )}
        {uploadResult?.warnings?.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-amber-300">
            {uploadResult.warnings.map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        )}
      </section>

      {previewedOrders.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Vista previa · Semáforo de stock
          </h3>
          <div className="space-y-5">
            {previewedOrders.map((o) => (
              <OrderPreviewCard
                key={o.id}
                order={o}
                parsedViaOcr={uploadResult?.parsed_via_ocr}
                onUpdate={(itemId, qty) => updateItem(o.id, itemId, qty)}
                onConfirm={() => confirmOrder(o.id)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Pedidos recientes
        </h3>
        <RecentOrdersTable orders={recentOrders} />
      </section>

      <Modal
        open={Boolean(negativeConfirm)}
        onClose={() => setNegativeConfirm(null)}
        title="Stock quedará en negativo"
        className="max-w-xl"
      >
        {negativeConfirm && (
          <div className="space-y-3">
            <p className="text-sm text-amber-200">
              Los siguientes productos quedarán con stock negativo si se
              confirma el despacho:
            </p>
            <ul className="space-y-1 rounded-md bg-slate-900 p-3 font-mono text-xs">
              {negativeConfirm.conflicts.map((c) => (
                <li
                  key={c.item_id}
                  className="flex justify-between border-b border-slate-800 py-1 last:border-0"
                >
                  <span>
                    <span className="text-emerald-300">{c.product_code}</span>{' '}
                    <span className="text-slate-400">{c.product_name}</span>
                  </span>
                  <span>
                    <span className="text-slate-500">
                      {c.quantity_available} − {c.quantity_requested} ={' '}
                    </span>
                    <span className="font-semibold text-red-300">
                      {c.quantity_after_dispatch}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setNegativeConfirm(null)}
                className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmOrder(negativeConfirm.orderId, true)}
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
              >
                Confirmar despacho igual
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function OrderPreviewCard({ order, parsedViaOcr, onUpdate, onConfirm }) {
  const hasNegative = order.items.some((i) => i.will_go_negative);
  const hasShortage = order.items.some((i) => i.has_shortage);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div>
          <p className="font-semibold text-slate-100">
            {order.client_name_raw || '(sin cliente)'}
          </p>
          <p className="text-xs text-slate-500">
            {order.transport && <>{order.transport} · </>}
            {order.items.length} ítems
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={order.status === 'CONFIRMADO' ? 'success' : 'info'}>
            {order.status}
          </Badge>
          {parsedViaOcr && <Badge variant="ocr">OCR</Badge>}
        </div>
      </div>

      {hasNegative && (
        <div className="border-b border-red-500/30 bg-red-900/20 px-4 py-2 text-xs text-red-200">
          ⚠ Algunos ítems dejarán el stock en negativo si se confirma así.
        </div>
      )}
      {!hasNegative && hasShortage && (
        <div className="border-b border-amber-500/30 bg-amber-900/20 px-4 py-2 text-xs text-amber-200">
          ⚠ Algunos ítems quedarán por debajo del mínimo.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs uppercase text-slate-500">
                Producto
              </th>
              <th className="px-3 py-2 text-right text-xs uppercase text-slate-500">
                Pide
              </th>
              <th className="px-3 py-2 text-right text-xs uppercase text-slate-500">
                Stock act.
              </th>
              <th className="px-3 py-2 text-right text-xs uppercase text-slate-500">
                Queda
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {order.items.map((item) => (
              <OrderItemRow key={item.id} item={item} onUpdate={onUpdate} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end border-t border-slate-800 px-4 py-3">
        <button
          onClick={onConfirm}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Confirmar despacho
        </button>
      </div>
    </div>
  );
}

function OrderItemRow({ item, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(item.quantity_boxes_requested);

  let rowClass = 'border-l-4 border-emerald-500/40';
  if (item.will_go_negative) rowClass = 'bg-red-900/20 border-l-4 border-red-500';
  else if (item.has_shortage) rowClass = 'bg-amber-900/30 border-l-4 border-amber-500';

  const unmatched = !item.product_id;

  const save = async () => {
    setEditing(false);
    if (qty !== item.quantity_boxes_requested) {
      await onUpdate(item.id, qty);
    }
  };

  const afterDispatchText =
    item.quantity_boxes_after_dispatch === null ||
    item.quantity_boxes_after_dispatch === undefined
      ? '—'
      : item.quantity_boxes_after_dispatch;

  const afterDispatchClass = item.will_go_negative
    ? 'text-red-300'
    : item.has_shortage
      ? 'text-amber-300'
      : 'text-emerald-300';

  return (
    <tr className={rowClass}>
      <td className="px-3 py-2 text-sm">
        <p className="font-mono text-emerald-300">{item.product_code_raw}</p>
        <p className="text-xs text-slate-400">{item.product_name_raw}</p>
        {unmatched && (
          <Badge variant="warning" className="mt-1">
            Sin match en catálogo
          </Badge>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {editing ? (
          <input
            type="number"
            min="0"
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value, 10) || 0)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') {
                setQty(item.quantity_boxes_requested);
                setEditing(false);
              }
            }}
            autoFocus
            className="w-20 rounded-md border border-emerald-500 bg-slate-900 px-2 py-1 text-right font-mono text-sm focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="font-mono text-sm text-slate-100 underline-offset-2 hover:text-emerald-300 hover:underline"
            title="Click para editar"
          >
            {item.quantity_boxes_requested}
          </button>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm text-slate-400">
        {item.quantity_boxes_available ?? '—'}
      </td>
      <td
        className={`px-3 py-2 text-right font-mono text-sm font-semibold ${afterDispatchClass}`}
      >
        {afterDispatchText}
      </td>
    </tr>
  );
}

function RecentOrdersTable({ orders }) {
  if (orders.length === 0) {
    return (
      <p className="text-sm text-slate-500">Sin pedidos registrados.</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="min-w-full divide-y divide-slate-700">
        <thead className="bg-slate-800">
          <tr>
            <th className="px-3 py-2 text-left text-xs uppercase text-slate-400">
              Fecha
            </th>
            <th className="px-3 py-2 text-left text-xs uppercase text-slate-400">
              Cliente
            </th>
            <th className="px-3 py-2 text-left text-xs uppercase text-slate-400">
              Archivo
            </th>
            <th className="px-3 py-2 text-center text-xs uppercase text-slate-400">
              Estado
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700 bg-slate-900">
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="px-3 py-2 text-xs text-slate-500">
                {new Date(o.created_at).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-sm">{o.client_name_raw}</td>
              <td className="max-w-xs truncate px-3 py-2 text-xs text-slate-400">
                {o.file_name}
              </td>
              <td className="px-3 py-2 text-center">
                <Badge
                  variant={
                    o.status === 'CONFIRMADO' || o.status === 'DESPACHADO'
                      ? 'success'
                      : o.status === 'PREVISUALIZADO'
                        ? 'info'
                        : 'warning'
                  }
                >
                  {o.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
