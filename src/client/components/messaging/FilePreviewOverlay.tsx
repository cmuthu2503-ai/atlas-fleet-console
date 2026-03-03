import { useEffect, useCallback } from 'react';
import type { Attachment } from '../../types/messaging';
import { getDownloadUrl } from '../../services/api';

interface Props {
  attachment: Attachment;
  onClose: () => void;
}

export default function FilePreviewOverlay({ attachment, onClose }: Props) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

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

  const isImage = attachment.contentType.startsWith('image/');
  const isPdf = attachment.contentType === 'application/pdf';
  const previewSrc = attachment.downloadUrl || attachment.thumbnailUrl || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${attachment.filename}`}
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-medium text-gray-900 truncate max-w-md">
            {attachment.filename}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Download file"
            >
              Download
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close preview"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex items-center justify-center p-4">
          {isImage && (
            <img
              src={previewSrc}
              alt={attachment.filename}
              className="max-h-[75vh] max-w-full object-contain"
            />
          )}
          {isPdf && (
            <iframe
              src={previewSrc}
              title={attachment.filename}
              className="h-[75vh] w-[70vw]"
            />
          )}
        </div>
      </div>
    </div>
  );
}
