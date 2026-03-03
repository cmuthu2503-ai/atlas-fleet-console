export type ReceiptState = 'sent' | 'delivered' | 'read';

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  thumbnailUrl?: string;
  downloadUrl?: string;
  scanStatus: 'pending' | 'clean' | 'infected';
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  sequenceId: number;
  createdAt: string;
  receiptState: ReceiptState;
  attachments: Attachment[];
}

export interface Conversation {
  id: string;
  advisorId: string;
  clientId: string;
  clientName: string;
  clientAvatar?: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
  userName: string;
}

export interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  abortController: AbortController;
  previewUrl?: string;
}

// WebSocket message types
export type WSIncoming =
  | { type: 'message'; payload: Message }
  | { type: 'receipt'; payload: { messageId: string; state: ReceiptState } }
  | { type: 'typing'; payload: TypingEvent }
  | { type: 'ack'; payload: { tempId: string; message: Message } };

export type WSOutgoing =
  | { type: 'message'; payload: { conversationId: string; content: string; tempId: string; attachmentIds?: string[] } }
  | { type: 'typing'; payload: { conversationId: string } }
  | { type: 'read'; payload: { conversationId: string; upToSequenceId: number } };
