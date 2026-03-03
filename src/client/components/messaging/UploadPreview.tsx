import type { UploadingFile } from '../../types/messaging';

interface Props {
  uploads: UploadingFile[];
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function UploadPreview({ uploads, onCancel, onRemove }: Props) {
  if (uploads.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 border-t border-gray-200 bg-gray-50 px-4 py-2">
      {uploads.map((u) => (
        <div
          key={u.id}
          className="relative flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
        >
          {u.previewUrl && (
            <img src={u.previewUrl} alt="" className="h-8 w-8 rounded object-cover" />
          )}
          <div className="min-w-0">
            <p className="max-w-[120px] truncate text-xs font-medium text-gray-700">
              {u.file.name}
            </p>
            {/* Progress bar */}
            <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${u.progress}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => (u.progress < 100 ? onCancel(u.id) : onRemove(u.id))}
            className="ml-1 rounded p-0.5 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={u.progress < 100 ? 'Cancel upload' : 'Remove'}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
