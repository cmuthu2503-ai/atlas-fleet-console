import { useState, useCallback } from 'react';
import ConversationList from './ConversationList';
import ChatThread from './ChatThread';
import FilePreviewOverlay from './FilePreviewOverlay';
import { useConversations, useMessages, useFileUpload } from '../../hooks/useMessaging';
import type { Attachment } from '../../types/messaging';

export default function MessagingPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const { conversations, loading: convLoading, clearUnread } = useConversations();
  const { messages, loading: msgLoading, hasMore, loadMore, sendMessage, sendTyping, markRead, typingUsers } = useMessages(activeConversationId);
  const { uploads, addFiles, startUpload, cancelUpload, removeUpload } = useFileUpload();

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  const handleSelect = (id: string) => {
    setActiveConversationId(id);
    clearUnread(id);
  };

  const handleAttach = useCallback((files: FileList) => {
    addFiles(files);
  }, [addFiles]);

  return (
    <div className="flex rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 140px)', background: '#1e1e24', border: '1px solid #2a2a35' }}>
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0" style={{ borderRight: '1px solid #2a2a35' }}>
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelect}
        />
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <ChatThread
            conversationId={activeConversationId}
            clientName={activeConversation.clientName}
            messages={messages}
            loading={msgLoading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onSend={sendMessage}
            onTyping={sendTyping}
            onMarkRead={markRead}
            typingUsers={typingUsers}
            uploads={uploads}
            onAttach={handleAttach}
            onPreview={setPreviewAttachment}
            onCancelUpload={cancelUpload}
            onRemoveUpload={removeUpload}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">💬</div>
              <h3 className="text-lg font-semibold text-white mb-1">In-App Messaging</h3>
              <p className="text-sm text-gray-500">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* File Preview Overlay */}
      {previewAttachment && (
        <FilePreviewOverlay
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}
