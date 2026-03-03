import { useState, useRef, useCallback } from 'react';

interface Props {
  onSend: (content: string) => void;
  onTyping: () => void;
  onAttach: (files: FileList) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, onTyping, onAttach, disabled }: Props) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (!typingTimer.current) {
      onTyping();
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      typingTimer.current = null;
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const ACCEPTED_EXTENSIONS = new Set([
    '.pdf', '.png', '.jpg', '.jpeg', '.gif',
    '.xlsx', '.xls', '.csv', '.docx', '.doc',
  ]);
  const MAX_FILES = 5;

  const validateAndAttach = useCallback(
    (files: FileList) => {
      const rejected: string[] = [];
      const accepted: File[] = [];

      Array.from(files).forEach((f) => {
        const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
        if (!ACCEPTED_EXTENSIONS.has(ext)) {
          rejected.push(f.name);
        } else {
          accepted.push(f);
        }
      });

      if (rejected.length > 0) {
        alert(`Unsupported file type(s): ${rejected.join(', ')}. Accepted: PDF, PNG, JPG, JPEG, GIF, XLSX, XLS, CSV, DOCX, DOC.`);
      }

      if (accepted.length > MAX_FILES) {
        alert(`You can attach up to ${MAX_FILES} files at a time. ${accepted.length} were selected.`);
        return;
      }

      if (accepted.length === 0) return;

      const dt = new DataTransfer();
      accepted.forEach((f) => dt.items.add(f));
      onAttach(dt.files);
    },
    [onAttach]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length) {
        validateAndAttach(e.dataTransfer.files);
      }
    },
    [validateAndAttach]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <form
      onSubmit={handleSubmit}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="flex items-end gap-2 border-t border-gray-200 bg-white px-4 py-3"
    >
      {/* Attach button */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex-shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Attach file"
        disabled={disabled}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </button>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.gif,.xlsx,.xls,.csv,.docx,.doc"
        onChange={(e) => e.target.files && validateAndAttach(e.target.files)}
      />

      {/* Text input */}
      <textarea
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        rows={1}
        disabled={disabled}
        className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        aria-label="Message text"
      />

      {/* Send */}
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="flex-shrink-0 rounded-full bg-blue-600 p-2.5 text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-40"
        aria-label="Send message"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M12 19V5m0 0l-7 7m7-7l7 7" />
        </svg>
      </button>
    </form>
  );
}
