import { useRef, useState } from 'react';

const ACCEPT = '.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.pdf,.tiff,.tif,.bmp';

export default function FileDropzone({
  onFile,
  loading = false,
  label = 'Soltá un archivo aquí o tocá para seleccionar',
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = (files) => {
    if (files && files[0]) onFile(files[0]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !loading && inputRef.current?.click()}
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition ${
        loading
          ? 'cursor-wait opacity-60 pointer-events-none'
          : 'cursor-pointer'
      } ${
        dragOver
          ? 'border-emerald-500 bg-emerald-500/10'
          : 'border-slate-700 bg-slate-950 hover:border-slate-500'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {loading ? (
        <>
          <svg
            className="h-8 w-8 animate-spin text-emerald-500"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              className="opacity-25"
            />
            <path
              d="M4 12a8 8 0 0 1 8-8"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <p className="mt-3 text-sm text-slate-300">Procesando archivo...</p>
        </>
      ) : (
        <>
          <svg
            className="h-8 w-8 text-slate-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" strokeLinecap="round" />
          </svg>
          <p className="mt-3 text-sm text-slate-300">{label}</p>
          <p className="mt-1 text-xs text-slate-500">
            Excel, CSV o imagen (JPG/PNG/PDF/TIFF/WebP)
          </p>
        </>
      )}
    </div>
  );
}
