import type { Attachment } from '../../types/messaging';
import { getDownloadUrl } from '../../services/api';

interface Props {
  attachment: Attachment;
  onPreview: (attachment: Attachment) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string): string {
  if (contentType.startsWith('image/')) return '🖼️';
  if (contentType === 'application/pdf') return '📄';
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) return '📊';
  if (contentType.includes('document') || contentType.includes('word')) return '📝';
  return '📎';
}

export default function FileCard({ attachment, onPreview }: Props) {
  const isPreviewable =
    attachment.contentType.startsWith('image/') ||
    attachment.contentType === 'application/pdf';

  const handleDownload = async () => {
    try {
      const url = await getDownloadUrl(attachment.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      a.click();
    } catch {
      // handle error
    }
  };

  return (
    <div className="mt-1 inline-flex max-w-xs items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
      {/* Thumbnail or icon */}
      {attachment.thumbnailUrl ? (
        <button
          onClick={() => onPreview(attachment)}
          className="h-10 w-10 flex-shrink-0 overflow-hidden rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={`Preview ${attachment.filename}`}
        >
          <img
            src={attachment.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </button>
      ) : (
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center text-xl">
          {getFileIcon(attachment.contentType)}
        </span>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{attachment.filename}</p>
        <p className="text-xs text-gray-500">{formatSize(attachment.sizeBytes)}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-1">
        {isPreviewable && (
          <button
            onClick={() => onPreview(attachment)}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Preview ${attachment.filename}`}
            title="Preview"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        )}
        <button
          onClick={handleDownload}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={`Download ${attachment.filename}`}
          title="Download"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
