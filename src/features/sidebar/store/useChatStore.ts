import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:3001');

export interface Message {
  id: string;
  text?: string;
  type: 'text' | 'image';
  imageUrl?: string;
  senderId: string;
  sender?: 'me' | 'other';
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
  isContact?: boolean;
  userId?: string;
  otherUserId?: string;
}

export interface Contact {
  id: string;
  ownerId: string;
  contactId: string;
  nickname: string;
  user: {
    id: string;
    name: string;
    phone: string;
    avatar: string;
    about: string;
  };
}

interface ChatState {
  chats: Chat[];
  messages: Record<string, Message[]>;
  activeChatId: string | null;
  view: 'chats' | 'status' | 'communities' | 'settings' | 'profile' | 'new-chat' | 'add-contact';
  isAuthenticated: boolean;
  currentUser: {
    id: string;
    name: string;
    phone: string;
    avatar: string;
    about: string;
  } | null;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setView: (view: 'chats' | 'status' | 'communities' | 'settings' | 'profile' | 'new-chat' | 'add-contact') => void;
  setActiveChat: (id: string | null) => void;
  setChats: (chats: Chat[]) => void;
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  fetchContacts: (userId: string) => Promise<void>;
  startChat: (contactUserId: string) => Promise<void>;
  addMessage: (chatId: string, message: Message) => void;
  markAsRead: (chatId: string) => void;
  toggleFavorite: (chatId: string) => void;
  closeChat: () => void;
  login: (userData: any) => Promise<void>;
  logout: () => void;
  fetchChats: (userId: string) => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, text?: string, type?: 'text' | 'image', imageUrl?: string) => void;
  markMessagesRead: (chatId: string) => void;
}

// Restaurar sesión guardada
const savedUser = localStorage.getItem('asicme_user');
const restoredUser = savedUser ? JSON.parse(savedUser) : null;

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  messages: {},
  activeChatId: null,
  view: 'chats',
  isAuthenticated: !!restoredUser,
  currentUser: restoredUser,
  isDarkMode: false,
  toggleDarkMode: () => {
    const newMode = !get().isDarkMode;
    set({ isDarkMode: newMode });
    if (newMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  },
  setView: (view) => set({ view }),
  setActiveChat: (id) => {
    set({ activeChatId: id });
    if (id) {
      get().fetchMessages(id);
      get().markMessagesRead(id);
      get().markAsRead(id); // Limpiar contador localmente de inmediato
      socket.emit('join_chat', id);
    }
  },
  closeChat: () => set({ activeChatId: null }),
  login: async (userData) => {
    try {
      const response = await fetch('http://localhost:3001/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await response.json();
      localStorage.setItem('asicme_user', JSON.stringify(data));
      set({ isAuthenticated: true, currentUser: data });
      socket.emit('user_connected', data.id);
    } catch (error) {
      console.error('Error in login:', error);
    }
  },
  logout: () => {
    localStorage.removeItem('asicme_user');
    set({ isAuthenticated: false, currentUser: null, activeChatId: null });
  },
  setChats: (chats) => set({ chats }),
  contacts: [],
  setContacts: (contacts) => set({ contacts }),
  fetchContacts: async (userId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/contacts/${userId}`);
      if (response.status === 401) {
        get().logout();
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      if (Array.isArray(data)) {
        set({ contacts: data });
      } else {
        console.error('Contacts data is not an array:', data);
        set({ contacts: [] });
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      set({ contacts: [] });
    }
  },
  startChat: async (contactUserId: string) => {
    const { currentUser, fetchChats, setActiveChat, setView } = get();
    if (!currentUser) return;
    try {
      const response = await fetch('http://localhost:3001/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantIds: [currentUser.id, contactUserId]
        })
      });
      const newConv = await response.json();
      await fetchChats(currentUser.id);
      setActiveChat(newConv.id);
      setView('chats');
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  },
  fetchChats: async (userId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/chats/${userId}`);
      if (response.status === 401) {
        get().logout();
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch chats');
      const data = await response.json();
      if (Array.isArray(data)) {
        set({ chats: data });
      } else {
        console.error('Chats data is not an array:', data);
        set({ chats: [] });
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
      set({ chats: [] });
    }
  },
  fetchMessages: async (chatId: string) => {
    const { currentUser } = get();
    if (!currentUser) return;
    try {
      const response = await fetch(`http://localhost:3001/api/messages/${chatId}?userId=${currentUser.id}`);
      const data = await response.json();
      set((state) => ({
        messages: { ...state.messages, [chatId]: data }
      }));
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  },
  sendMessage: (chatId: string, text?: string, type: 'text' | 'image' = 'text', imageUrl?: string) => {
    const { currentUser } = get();
    if (!currentUser) return;
    
    socket.emit('send_message', {
      chatId,
      senderId: currentUser.id,
      text,
      type,
      imageUrl
    });
  },
  markMessagesRead: (chatId: string) => {
    const { currentUser } = get();
    if (!currentUser) return;
    socket.emit('mark_messages_read', { chatId, userId: currentUser.id });
  },
  addMessage: (chatId, message) => {
    const { chats, currentUser, fetchChats, activeChatId } = get();
    
    // Si el chat no existe en la lista local, refrescar la lista de chats
    const chatExists = chats.some(c => c.id === chatId);
    if (!chatExists && currentUser) {
      fetchChats(currentUser.id);
    }

    set((state) => {
      const currentMsgs = state.messages[chatId] || [];
      // Evitar duplicados si el mensaje ya existe por ID
      if (currentMsgs.some(m => m.id === message.id)) return state;

      const newMessages = {
        ...state.messages,
        [chatId]: [...currentMsgs, message]
      };

      const updatedChats = state.chats.map(chat => 
        chat.id === chatId 
          ? { 
              ...chat, 
              lastMessage: message.type === 'image' ? '📷 Imagen' : (message.text || ''), 
              timestamp: new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
              unreadCount: activeChatId === chatId ? 0 : (chat.unreadCount || 0) + 1 
            }
          : chat
      );

      const chatIndex = updatedChats.findIndex(c => c.id === chatId);
      if (chatIndex > -1) {
        const [movedChat] = updatedChats.splice(chatIndex, 1);
        updatedChats.unshift(movedChat);
      }

      return {
        messages: newMessages,
        chats: updatedChats
      };
    });
  },
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

// Escuchar mensajes en tiempo real
socket.on('receive_message', (message) => {
  const state = useChatStore.getState();
  state.addMessage(message.conversationId, message);
});

// Escuchar confirmación de lectura
socket.on('messages_read', ({ chatId, readBy }) => {
  const state = useChatStore.getState();
  const currentMessages = state.messages[chatId] || [];
  const updatedMessages = currentMessages.map(msg => 
    msg.senderId !== readBy ? { ...msg, status: 'read' as const } : msg
  );
  
  useChatStore.setState((state) => ({
    messages: { ...state.messages, [chatId]: updatedMessages }
  }));
});

// Escuchar cambios de estado (Online/Offline)
socket.on('user_status_change', ({ userId, status }) => {
  const state = useChatStore.getState();
  const updatedChats = state.chats.map(chat => {
    return { ...chat, isOnline: status === 'online' };
  });
  state.setChats(updatedChats);
});

// Restaurar conexión de socket si hay sesión guardada
if (restoredUser) {
  socket.emit('user_connected', restoredUser.id);
  useChatStore.getState().fetchChats(restoredUser.id);
  useChatStore.getState().fetchContacts(restoredUser.id);
}
