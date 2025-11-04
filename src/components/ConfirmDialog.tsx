import { useEffect } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
};

export default function ConfirmDialog({ open, title = 'Are you sure?', description, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, confirming = false }: ConfirmDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-custom-900">{title}</h3>
        {description && <p className="mt-2 text-sm text-gray-custom-600">{description}</p>}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={confirming} className="text-sm font-medium text-gray-custom-700 hover:underline">
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm} disabled={confirming} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
            {confirming ? 'Please wait…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}


