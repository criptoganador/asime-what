import { create } from 'zustand';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
}

export interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  avatar: string;
  unreadCount: number;
  timestamp: string;
  isOnline?: boolean;
  isFavorite?: boolean;
  isGroup?: boolean;
}

interface ChatState {
  chats: Chat[];
  messages: Record<string, Message[]>;
  activeChatId: string | null;
  view: 'chats' | 'status' | 'communities' | 'settings' | 'profile';
  setView: (view: 'chats' | 'status' | 'communities' | 'settings' | 'profile') => void;
  setActiveChat: (id: string) => void;
  setChats: (chats: Chat[]) => void;
  addMessage: (chatId: string, message: Message) => void;
  markAsRead: (chatId: string) => void;
  toggleFavorite: (chatId: string) => void;
  closeChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  messages: {},
  activeChatId: null,
  view: 'chats',
  setView: (view) => set({ view }),
  setActiveChat: (id) => set((state) => {
    // Al activar un chat, también lo marcamos como leído
    const updatedChats = state.chats.map(chat => 
      chat.id === id ? { ...chat, unreadCount: 0 } : chat
    );
    return { activeChatId: id, chats: updatedChats };
  }),
  closeChat: () => set({ activeChatId: null }),
  setChats: (chats) => set({ chats }),
  addMessage: (chatId, message) => set((state) => {
    // 1. Actualizar los mensajes
    const newMessages = {
      ...state.messages,
      [chatId]: [...(state.messages[chatId] || []), message]
    };

    // 2. Actualizar el chat correspondiente y moverlo al inicio
    const updatedChats = state.chats.map(chat => 
      chat.id === chatId 
        ? { ...chat, lastMessage: message.text, timestamp: message.timestamp, unreadCount: 0 }
        : chat
    );

    // Mover el chat actualizado al principio de la lista
    const chatIndex = updatedChats.findIndex(c => c.id === chatId);
    if (chatIndex > -1) {
      const [movedChat] = updatedChats.splice(chatIndex, 1);
      updatedChats.unshift(movedChat);
    }

    return {
      messages: newMessages,
      chats: updatedChats
    };
  }),
  markAsRead: (chatId) => set((state) => ({
    chats: state.chats.map(chat => 
      chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
    )
  })),
  toggleFavorite: (chatId) => set((state) => ({
    chats: state.chats.map(chat => 
      chat.id === chatId ? { ...chat, isFavorite: !chat.isFavorite } : chat
    )
  })),
}));
