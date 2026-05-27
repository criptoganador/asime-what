import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { encryptMessage, decryptMessage, importPrivateKey, importPublicKey, deriveSharedKey, encryptMessageE2EE, decryptMessageE2EE, decryptPrivateKeyWithPIN } from '../../../utils/crypto';
import { API_URL } from '../../../config';

export const decryptSmartMessage = async (encryptedText: string, chatId: string, chatInfo: Chat | undefined, privateKeyJWK: string | null) => {
  if (!encryptedText) return encryptedText;
  
  if (chatInfo && !chatInfo.isGroup && chatInfo.otherUserPublicKey && privateKeyJWK) {
    if (encryptedText.includes('ciphertext') && encryptedText.includes('iv')) {
      try {
        const myPrivateKey = await importPrivateKey(privateKeyJWK);
        const theirPublicKey = await importPublicKey(chatInfo.otherUserPublicKey);
        const sharedKey = await deriveSharedKey(myPrivateKey, theirPublicKey);
        return await decryptMessageE2EE(encryptedText, sharedKey);
      } catch (err) {
        console.error('Error descifrando E2EE', err);
      }
    }
  }
  return decryptMessage(encryptedText, chatId);
};

export const encryptSmartMessage = async (plaintext: string | undefined, chatId: string, chatInfo: Chat | undefined, privateKeyJWK: string | null) => {
  if (!plaintext) return plaintext;
  if (chatInfo && !chatInfo.isGroup && chatInfo.otherUserPublicKey && privateKeyJWK) {
    try {
      const myPrivateKey = await importPrivateKey(privateKeyJWK);
      const theirPublicKey = await importPublicKey(chatInfo.otherUserPublicKey);
      const sharedKey = await deriveSharedKey(myPrivateKey, theirPublicKey);
      return await encryptMessageE2EE(plaintext, sharedKey);
    } catch (err) {
      console.error('Error cifrando E2EE', err);
    }
  }
  return encryptMessage(plaintext, chatId);
};

const socket: Socket = io(API_URL);

export interface Message {
  id: string;
  conversationId: string;
  text?: string;
  type: 'text' | 'image' | 'system' | 'audio' | 'file' | 'video';
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  duration?: number;
  senderId: string;
  sender?: 'me' | 'other';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  reactions?: Record<string, string[]>;
  replyToId?: string;
  replyTo?: Message;
  isDeleted?: boolean;
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
  description?: string;
  isContact?: boolean;
  userId?: string;
  otherUserId?: string;
  lastSeen?: string;
  otherUserPublicKey?: string;
}

export interface Status {
  id: string;
  userId: string;
  type: 'text' | 'image';
  content: string;
  backgroundColor?: string;
  createdAt: string;
}

export interface GroupedStatus {
  userId: string;
  userName: string;
  userAvatar?: string;
  statuses: Status[];
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

export interface Participant {
  id: string;
  name: string;
  avatar: string;
  about?: string;
  role: 'admin' | 'member';
}

interface ChatState {
  chats: Chat[];
  messages: Record<string, Message[]>;
  activeChatId: string | null;
  view: 'chats' | 'status' | 'settings' | 'profile' | 'new-chat' | 'add-contact' | 'group-info' | 'privacy' | 'security';
  viewingGroup: Chat | null;
  isAuthenticated: boolean;
  isValidatingSession: boolean;
  currentUser: {
    id: string;
    name: string;
    phone: string;
    avatar: string;
    about: string;
  } | null;
  isDarkMode: boolean;
  privateKeyJWK: string | null;
  toggleDarkMode: () => void;
  setView: (view: 'chats' | 'status' | 'settings' | 'profile' | 'new-chat' | 'add-contact' | 'group-info' | 'privacy' | 'security') => void;
  setViewingGroup: (group: Chat | null) => void;
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
  login: (userData: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  fetchChats: (userId: string) => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, text?: string, type?: Message['type'], imageUrl?: string, replyToId?: string, fileData?: { url: string, fileName: string, fileType: string, duration?: number }) => void;
  markMessagesRead: (chatId: string) => void;
  createGroup: (name: string, avatar: string, description: string, participantIds: string[]) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  updateGroup: (chatId: string, data: { name?: string; avatar?: string; description?: string }) => Promise<void>;
  updateProfile: (data: { name?: string; avatar?: string; about?: string }) => Promise<void>;
  statuses: GroupedStatus[];
  fetchStatuses: () => Promise<void>;
  createStatus: (data: { type: 'text' | 'image'; content: string; backgroundColor?: string }) => Promise<void>;
  chatWallpaper: string;
  setChatWallpaper: (wallpaper: string) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  soundsEnabled: boolean;
  setSoundsEnabled: (enabled: boolean) => void;
  blockedContacts: string[];
  toggleBlockContact: (userId: string) => void;
  privacySettings: {
    lastSeen: 'everyone' | 'contacts' | 'nobody';
    profilePhoto: 'everyone' | 'contacts' | 'nobody';
    about: 'everyone' | 'contacts' | 'nobody';
    status: 'everyone' | 'contacts' | 'nobody';
  };
  updatePrivacySettings: (settings: Partial<ChatState['privacySettings']>) => void;
  saveSettings: () => void;
  typingUsers: Record<string, string[]>;
  sendTypingStatus: (chatId: string, isTyping: boolean) => void;
  addReaction: (chatId: string, messageId: string, emoji: string) => void;
  replyingTo: Message | null;
  setReplyingTo: (message: Message | null) => void;
  participants: Participant[];
  fetchParticipants: (chatId: string) => Promise<void>;
  addParticipant: (chatId: string, userId: string) => Promise<void>;
  removeParticipant: (chatId: string, userId: string, isSelf?: boolean) => Promise<void>;
  updateParticipantRole: (chatId: string, userId: string, role: string) => Promise<void>;
  leaveGroup: (chatId: string) => Promise<void>;
  checkUser: (phone: string) => Promise<any | null>;
  validateSession: () => Promise<void>;
  hasMoreMessages: Record<string, boolean>;
  loadMoreMessages: (chatId: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string, forEveryone: boolean) => void;
  incomingCall: { chatId: string, callerId: string, callerName: string, callerAvatar: string, type: 'video' | 'voice' } | null;
  activeCall: { chatId: string, type: 'video' | 'voice' } | null;
  outgoingCall: { chatId: string, type: 'video' | 'voice', receiverName: string, receiverAvatar: string } | null;
  setIncomingCall: (call: any) => void;
  setActiveCall: (call: any) => void;
  setOutgoingCall: (call: any) => void;
  callUser: (chatId: string, type: 'video' | 'voice', receiverName?: string, receiverAvatar?: string) => void;
  inviteToCall: (chatId: string, receiverId: string, type: 'video' | 'voice') => void;
  answerCall: (chatId: string, accept: boolean) => void;
  leaveCall: () => void;
  endCall: (chatId: string) => void;
}

const savedUser = localStorage.getItem('asicme_user');
const restoredUser = savedUser && savedUser !== 'undefined' ? JSON.parse(savedUser) : null;

const savedSettings = localStorage.getItem('asicme_settings');
const initialSettings = savedSettings ? JSON.parse(savedSettings) : {
  chatWallpaper: 'default',
  notificationsEnabled: true,
  soundsEnabled: true,
  isDarkMode: false,
  blockedContacts: [],
  privacySettings: {
    lastSeen: 'everyone',
    profilePhoto: 'everyone',
    about: 'everyone',
    status: 'everyone'
  }
};

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  messages: {},
  hasMoreMessages: {},
  activeChatId: null,
  view: 'chats',
  viewingGroup: null,
  isAuthenticated: false,
  isValidatingSession: !!restoredUser,
  currentUser: restoredUser,
  isDarkMode: initialSettings.isDarkMode,
  chatWallpaper: initialSettings.chatWallpaper,
  notificationsEnabled: initialSettings.notificationsEnabled,
  soundsEnabled: initialSettings.soundsEnabled,
  blockedContacts: initialSettings.blockedContacts || [],
  privacySettings: initialSettings.privacySettings || {
    lastSeen: 'everyone',
    profilePhoto: 'everyone',
    about: 'everyone',
    status: 'everyone'
  },
  participants: [],
  typingUsers: {},
  replyingTo: null,
  privateKeyJWK: sessionStorage.getItem('asicme_private_key') || null,
  incomingCall: null,
  activeCall: null,
  outgoingCall: null,
  
  setIncomingCall: (call) => set({ incomingCall: call }),
  setActiveCall: (call) => set({ activeCall: call }),
  setOutgoingCall: (call) => set({ outgoingCall: call }),

  callUser: (chatId, type, receiverName = 'Usuario', receiverAvatar = '') => {
    const { currentUser } = get();
    if (!currentUser) return;
    set({ outgoingCall: { chatId, type, receiverName, receiverAvatar } });
    socket.emit('call_user', { 
      chatId, 
      callerId: currentUser.id, 
      callerName: currentUser.name,
      callerAvatar: currentUser.avatar,
      type 
    });
  },

  inviteToCall: (chatId, receiverId, type) => {
    const { currentUser } = get();
    if (!currentUser) return;
    socket.emit('invite_to_call', { 
      chatId, 
      inviterId: currentUser.id, 
      inviterName: currentUser.name,
      inviterAvatar: currentUser.avatar,
      receiverId,
      type 
    });
  },

  answerCall: (chatId, accept) => {
    const { currentUser, incomingCall } = get();
    if (!currentUser || !incomingCall) return;
    socket.emit('answer_call', { chatId, answererId: currentUser.id, accept });
    if (accept) {
      set({ activeCall: { chatId, type: incomingCall.type }, incomingCall: null });
    } else {
      set({ incomingCall: null });
    }
  },

  leaveCall: () => {
    set({ activeCall: null, incomingCall: null, outgoingCall: null });
  },

  endCall: (chatId) => {
    socket.emit('end_call', { chatId });
    set({ activeCall: null, incomingCall: null, outgoingCall: null });
  },

  setReplyingTo: (message) => set({ replyingTo: message }),

  sendTypingStatus: (chatId, isTyping) => {
    const { currentUser } = get();
    if (!currentUser) return;
    socket.emit(isTyping ? 'user_typing' : 'user_stop_typing', { chatId, userId: currentUser.id });
  },

  addReaction: (chatId, messageId, emoji) => {
    const { currentUser } = get();
    if (!currentUser) return;
    socket.emit('add_reaction', { chatId, messageId, emoji, userId: currentUser.id });
  },

  setChatWallpaper: (wallpaper) => {
    set({ chatWallpaper: wallpaper });
    get().saveSettings();
  },
  setNotificationsEnabled: (enabled) => {
    set({ notificationsEnabled: enabled });
    get().saveSettings();
  },
  setSoundsEnabled: (enabled) => {
    set({ soundsEnabled: enabled });
    get().saveSettings();
  },
  toggleBlockContact: (userId) => {
    const current = get().blockedContacts;
    const updated = current.includes(userId) 
      ? current.filter(id => id !== userId)
      : [...current, userId];
    set({ blockedContacts: updated });
    get().saveSettings();
  },
  updatePrivacySettings: (settings) => {
    set({ privacySettings: { ...get().privacySettings, ...settings } });
    get().saveSettings();
  },
  saveSettings: () => {
    const state = get();
    localStorage.setItem('asicme_settings', JSON.stringify({
      isDarkMode: state.isDarkMode,
      chatWallpaper: state.chatWallpaper,
      notificationsEnabled: state.notificationsEnabled,
      soundsEnabled: state.soundsEnabled,
      blockedContacts: state.blockedContacts,
      privacySettings: state.privacySettings
    }));
  },


  leaveGroup: async (chatId) => {
    const { currentUser, removeParticipant, closeChat, fetchChats } = get();
    if (!currentUser) return;
    try {
      await removeParticipant(chatId, currentUser.id, true);
      closeChat();
      await fetchChats(currentUser.id);
    } catch (error) {
      console.error('Error leaving group:', error);
    }
  },
  toggleDarkMode: () => {
    const newMode = !get().isDarkMode;
    set({ isDarkMode: newMode });
    if (newMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    get().saveSettings();
  },
  setView: (view) => set({ view }),
  setViewingGroup: (group) => set({ viewingGroup: group }),
  setActiveChat: (id) => {
    set({ activeChatId: id, replyingTo: null });
    if (id) {
      get().fetchMessages(id);
      get().markMessagesRead(id);
      get().markAsRead(id); 
      socket.emit('join_chat', id);
    }
  },
  closeChat: () => set({ activeChatId: null, replyingTo: null }),
  login: async (userData) => {
    try {
      const response = await fetch(`${API_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error };
      }
      
      let privateKeyJWK = null;
      if (data.encryptedPrivateKey && userData.pin) {
        privateKeyJWK = decryptPrivateKeyWithPIN(data.encryptedPrivateKey, userData.pin);
        if (privateKeyJWK) {
          sessionStorage.setItem('asicme_private_key', privateKeyJWK);
        }
      }

      localStorage.setItem('asicme_user', JSON.stringify(data));
      set({ isAuthenticated: true, currentUser: data, privateKeyJWK });
      socket.emit('user_connected', data.id);
      return { success: true };
    } catch (error) {
      console.error('Error in login:', error);
      return { success: false, error: 'Error de red' };
    }
  },
  checkUser: async (phone: string) => {
    try {
      const response = await fetch(`${API_URL}/api/users/check/${phone}`);
      if (response.status === 429) {
        return { rateLimited: true };
      }
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Error checking user:', error);
      return null;
    }
  },
  validateSession: async () => {
    const { currentUser, logout } = get();
    if (!currentUser?.id) return;
    try {
      const response = await fetch(`${API_URL}/api/users/validate/${currentUser.id}`);
      if (!response.ok) {
        console.warn('⚠️ Sesión inválida: usuario no existe en la BD. Cerrando sesión...');
        logout();
        return;
      }
      // Actualizar datos del usuario con los más recientes de la BD
      const data = await response.json();
      if (data.user) {
        localStorage.setItem('asicme_user', JSON.stringify(data.user));
        const pk = sessionStorage.getItem('asicme_private_key');
        set({ currentUser: data.user, privateKeyJWK: pk });
      }
    } catch (error) {
      console.error('Error validando sesión:', error);
      // Si el servidor no responde, no cerrar sesión (puede ser caída temporal)
    }
  },
  logout: () => {
    const { currentUser } = get();
    if (currentUser?.id) {
      socket.emit('user_disconnected', currentUser.id);
    }
    localStorage.removeItem('asicme_user');
    sessionStorage.removeItem('asicme_private_key');
    set({ 
      isAuthenticated: false, 
      currentUser: null, 
      privateKeyJWK: null,
      activeChatId: null,
      chats: [],
      messages: {} 
    });
  },
  setChats: (chats) => set({ chats }),
  contacts: [],
  setContacts: (contacts) => set({ contacts }),
  fetchContacts: async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/contacts/${userId}`);
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
      const response = await fetch(`${API_URL}/api/conversations`, {
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
      const response = await fetch(`${API_URL}/api/chats/${userId}`);
      if (response.status === 401) {
        get().logout();
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch chats');
      const data = await response.json();
      if (Array.isArray(data)) {
        const { privateKeyJWK } = get();
        const decryptedChats = await Promise.all(data.map(async (chat) => {
          if (chat.lastMessage) {
            try {
              chat.lastMessage = await decryptSmartMessage(chat.lastMessage, chat.id, chat, privateKeyJWK);
              // Simplificar multimedia para la vista de lista
              if (chat.lastMessage.startsWith('data:image/')) chat.lastMessage = '📷 Imagen';
              if (chat.lastMessage.startsWith('data:video/')) chat.lastMessage = '🎥 Video';
              if (chat.lastMessage.startsWith('data:audio/')) chat.lastMessage = '🎤 Nota de voz';
              if (chat.lastMessage.startsWith('data:application/') || chat.lastMessage.startsWith('data:text/')) chat.lastMessage = '📄 Archivo';
            } catch (e) {
              console.error('Error decrypting last message for chat', chat.id, e);
            }
          }
          return chat;
        }));
        set({ chats: decryptedChats });
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
      const response = await fetch(`${API_URL}/api/messages/${chatId}?userId=${currentUser.id}&limit=50&offset=0`);
      if (!response.ok) return; // Servidor no disponible, no crashear
      let data = await response.json();
      if (!Array.isArray(data)) return; // Respuesta inesperada, no crashear
      
      const { chats, privateKeyJWK } = get();
      const chatInfo = chats.find(c => c.id === chatId);
      
      data = await Promise.all(data.map(async (msg: Message) => ({ 
        ...msg, 
        text: await decryptSmartMessage(msg.text || '', chatId, chatInfo, privateKeyJWK),
        imageUrl: await decryptSmartMessage(msg.imageUrl || '', chatId, chatInfo, privateKeyJWK),
        fileUrl: await decryptSmartMessage(msg.fileUrl || '', chatId, chatInfo, privateKeyJWK)
      })));

      set((state) => ({
        messages: { ...state.messages, [chatId]: data },
        hasMoreMessages: { ...state.hasMoreMessages, [chatId]: data.length === 50 }
      }));
    } catch (error) {
      console.warn('⚠️ Error fetching messages (Neon puede estar temporalmente inaccesible)');
    }
  },
  loadMoreMessages: async (chatId: string) => {
    const state = get();
    const { currentUser, messages, hasMoreMessages } = state;
    if (!currentUser || hasMoreMessages[chatId] === false) return;
    
    const currentMessages = messages[chatId] || [];
    const offset = currentMessages.length;
    
    try {
      const response = await fetch(`${API_URL}/api/messages/${chatId}?userId=${currentUser.id}&limit=50&offset=${offset}`);
      let data = await response.json();
      
      const chatInfo = state.chats.find(c => c.id === chatId);
      data = await Promise.all(data.map(async (msg: Message) => ({ 
        ...msg, 
        text: await decryptSmartMessage(msg.text || '', chatId, chatInfo, state.privateKeyJWK),
        imageUrl: await decryptSmartMessage(msg.imageUrl || '', chatId, chatInfo, state.privateKeyJWK),
        fileUrl: await decryptSmartMessage(msg.fileUrl || '', chatId, chatInfo, state.privateKeyJWK)
      })));
      
      set((state) => ({
        messages: { 
          ...state.messages, 
          [chatId]: [...data, ...currentMessages] 
        },
        hasMoreMessages: { 
          ...state.hasMoreMessages, 
          [chatId]: data.length === 50 
        }
      }));
    } catch (error) {
      console.error('Error loading more messages:', error);
    }
  },
  sendMessage: async (chatId, text, type = 'text', imageUrl, replyToId, fileData) => {
    const state = get();
    const { currentUser } = state;
    if (!currentUser) return;
    
    const chatInfo = state.chats.find(c => c.id === chatId);
    const encryptedText = await encryptSmartMessage(text, chatId, chatInfo, state.privateKeyJWK);
    const encryptedImageUrl = await encryptSmartMessage(imageUrl, chatId, chatInfo, state.privateKeyJWK);
    const encryptedFileUrl = await encryptSmartMessage(fileData?.url, chatId, chatInfo, state.privateKeyJWK);
    
    const { url, ...cleanFileData } = fileData || {};
    
    socket.emit('send_message', {
      chatId,
      senderId: currentUser.id,
      text: encryptedText,
      type,
      imageUrl: encryptedImageUrl,
      replyToId,
      ...cleanFileData,
      fileUrl: encryptedFileUrl // replace the url in fileData (server expects fileUrl)
    });
    set({ replyingTo: null });
  },
  deleteMessage: (chatId, messageId, forEveryone) => {
    const { currentUser } = get();
    if (!currentUser) return;
    socket.emit('delete_message', { chatId, messageId, forEveryone, userId: currentUser.id });
  },
  markMessagesRead: (chatId: string) => {
    const { currentUser } = get();
    if (!currentUser) return;
    socket.emit('mark_messages_read', { chatId, userId: currentUser.id });
  },
  addMessage: (chatId, message) => {
    const { chats, currentUser, fetchChats, activeChatId, soundsEnabled, notificationsEnabled } = get();
    
    if (message.senderId !== currentUser?.id) {
      if (soundsEnabled) {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
        audio.play().catch(e => {
          if (e.name === 'NotAllowedError') {
            // Silenciosamente ignoramos si el usuario aún no ha interactuado
            console.warn('Sonido bloqueado por el navegador: se requiere interacción previa del usuario.');
          } else {
            console.error('Error al reproducir sonido:', e);
          }
        });
      }
      
      if (notificationsEnabled && Notification.permission === 'granted') {
        new Notification(`Nuevo mensaje`, {
          body: message.text || (message.type === 'image' ? '📷 Imagen' : message.type === 'video' ? '🎥 Video' : message.type === 'audio' ? '🎤 Nota de voz' : '📄 Archivo'),
          icon: '/favicon.png'
        });
      }
    }

    const chatExists = chats.some(c => c.id === chatId);
    if (!chatExists && currentUser) {
      fetchChats(currentUser.id);
    }

    set((state) => {
      const currentMsgs = state.messages[chatId] || [];
      if (currentMsgs.some(m => m.id === message.id)) return state;

      const newMessages = {
        ...state.messages,
        [chatId]: [...currentMsgs, message]
      };

      const updatedChats = state.chats.map(chat => 
        chat.id === chatId 
          ? { 
              ...chat, 
              lastMessage: message.type === 'image' ? '📷 Imagen' : message.type === 'video' ? '🎥 Video' : message.type === 'audio' ? '🎤 Nota de voz' : message.type === 'file' ? `📄 ${message.fileName}` : (message.text || ''), 
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
  createGroup: async (name, avatar, description, participantIds) => {
    const { currentUser, fetchChats, setActiveChat, setView } = get();
    if (!currentUser) return;
    try {
      const response = await fetch(`${API_URL}/api/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          avatar,
          description,
          participantIds: [...participantIds, currentUser.id] 
        })
      });
      const newGroup = await response.json();
      await fetchChats(currentUser.id);
      setActiveChat(newGroup.id);
      setView('chats');
    } catch (error) {
      console.error('Error creating group:', error);
    }
  },
  deleteChat: async (chatId) => {
    const { currentUser, fetchChats, activeChatId, setActiveChat } = get();
    if (!currentUser) return;
    try {
      const response = await fetch(`${API_URL}/api/conversations/${chatId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await fetchChats(currentUser.id);
        if (activeChatId === chatId) {
          setActiveChat(null);
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  },
  updateGroup: async (chatId, data) => {
    const { currentUser, fetchChats } = get();
    if (!currentUser) return;
    try {
      const response = await fetch(`${API_URL}/api/groups/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        await fetchChats(currentUser.id);
      }
    } catch (error) {
      console.error('Error updating group:', error);
    }
  },
  updateProfile: async (data) => {
    const { currentUser } = get();
    if (!currentUser) return;
    try {
      const response = await fetch(`${API_URL}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentUser, ...data })
      });
      const updatedUser = await response.json();
      localStorage.setItem('asicme_user', JSON.stringify(updatedUser));
      set({ currentUser: updatedUser });
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  },
  fetchParticipants: async (chatId) => {
    try {
      const response = await fetch(`${API_URL}/api/conversations/${chatId}/participants`);
      const data = await response.json();
      set({ participants: Array.isArray(data) ? data : [] });
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  },
  addParticipant: async (chatId, userId) => {
    try {
      await fetch(`${API_URL}/api/conversations/${chatId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      await get().fetchParticipants(chatId);
    } catch (error) {
      console.error('Error adding participant:', error);
    }
  },
  removeParticipant: async (chatId, userId, isSelf = false) => {
    try {
      const response = await fetch(`${API_URL}/api/conversations/${chatId}/participants/${userId}?isSelf=${isSelf}`, { method: 'DELETE' });
      if (response.ok) {
        get().fetchParticipants(chatId);
      }
    } catch (error) {
      console.error('Error removing participant:', error);
    }
  },
  updateParticipantRole: async (chatId, userId, role) => {
    try {
      await fetch(`${API_URL}/api/conversations/${chatId}/participants/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      await get().fetchParticipants(chatId);
    } catch (error) {
      console.error('Error updating participant role:', error);
    }
  },
  statuses: [],
  fetchStatuses: async () => {
    const { currentUser } = get();
    if (!currentUser) return;
    try {
      const response = await fetch(`${API_URL}/api/statuses/${currentUser.id}`);
      const data = await response.json();
      set({ statuses: Array.isArray(data) ? data : [] });
    } catch (error) {
      console.error('Error fetching statuses:', error);
      set({ statuses: [] });
    }
  },
  createStatus: async (data) => {
    const { currentUser, fetchStatuses } = get();
    if (!currentUser) return;
    try {
      const response = await fetch(`${API_URL}/api/statuses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId: currentUser.id })
      });
      if (response.ok) {
        await fetchStatuses();
      }
    } catch (error) {
      console.error('Error creating status:', error);
    }
  },
}));

socket.on('receive_message', async (message: Message) => {
  const state = useChatStore.getState();
  const chatInfo = state.chats.find(c => c.id === message.conversationId);
  const decryptedText = await decryptSmartMessage(message.text || '', message.conversationId, chatInfo, state.privateKeyJWK);
  const decryptedImageUrl = await decryptSmartMessage(message.imageUrl || '', message.conversationId, chatInfo, state.privateKeyJWK);
  const decryptedFileUrl = await decryptSmartMessage(message.fileUrl || '', message.conversationId, chatInfo, state.privateKeyJWK);
  
  const decryptedMessage = { 
    ...message, 
    text: decryptedText,
    imageUrl: decryptedImageUrl,
    fileUrl: decryptedFileUrl
  };
  state.addMessage(message.conversationId, decryptedMessage);
});

socket.on('messages_read', ({ chatId, readBy }) => {
  const state = useChatStore.getState();
  const currentMessages = state.messages[chatId] || [];
  
  // Si yo soy el remitente de esos mensajes, los marco como leídos
  const updatedMessages = currentMessages.map(msg => {
    if (msg.senderId === state.currentUser?.id && msg.status !== 'read') {
      return { ...msg, status: 'read' };
    }
    return msg;
  });
  
  useChatStore.setState((s) => ({
    messages: { ...s.messages, [chatId]: updatedMessages }
  }));
});

socket.on('user_typing', ({ chatId, userId }) => {
  const state = useChatStore.getState();
  if (userId === state.currentUser?.id) return;
  const current = state.typingUsers[chatId] || [];
  if (!current.includes(userId)) {
    useChatStore.setState((s) => ({
      typingUsers: { ...s.typingUsers, [chatId]: [...current, userId] }
    }));
  }
});

socket.on('user_stop_typing', ({ chatId, userId }) => {
  const state = useChatStore.getState();
  const current = state.typingUsers[chatId] || [];
  useChatStore.setState((s) => ({
    typingUsers: { ...s.typingUsers, [chatId]: current.filter(id => id !== userId) }
  }));
});

socket.on('message_reaction', ({ chatId, messageId, emoji, userId }) => {
  const state = useChatStore.getState();
  const currentMessages = state.messages[chatId] || [];
  const updatedMessages = currentMessages.map(msg => {
    if (msg.id === messageId) {
      const reactions = { ...(msg.reactions || {}) };
      const users = reactions[emoji] || [];
      if (users.includes(userId)) {
        reactions[emoji] = users.filter(id => id !== userId);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...users, userId];
      }
      return { ...msg, reactions };
    }
    return msg;
  });
  useChatStore.setState((s) => ({
    messages: { ...state.messages, [chatId]: updatedMessages }
  }));
});

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

socket.on('user_status_change', ({ userId, status, lastSeen }) => {
  const state = useChatStore.getState();
  const updatedChats = state.chats.map(chat => {
    return chat.otherUserId === userId 
      ? { ...chat, isOnline: status === 'online', lastSeen: lastSeen || chat.lastSeen } 
      : chat;
  });
  state.setChats(updatedChats);
});

socket.on('message_deleted', ({ chatId, messageId, forEveryone, userId }) => {
  const state = useChatStore.getState();
  const currentMessages = state.messages[chatId] || [];
  
  if (forEveryone) {
    const updatedMessages = currentMessages.map(msg => 
      msg.id === messageId 
        ? { ...msg, isDeleted: true, text: 'Este mensaje fue eliminado', imageUrl: undefined, fileUrl: undefined, fileName: undefined } 
        : msg
    );
    useChatStore.setState((s) => ({
      messages: { ...state.messages, [chatId]: updatedMessages }
    }));
  } else {
    if (state.currentUser?.id === userId) {
      // Remove it from local view
      const updatedMessages = currentMessages.filter(msg => msg.id !== messageId);
      useChatStore.setState((s) => ({
        messages: { ...state.messages, [chatId]: updatedMessages }
      }));
    }
  }
});

socket.on('incoming_call', (call) => {
  const state = useChatStore.getState();
  if (state.activeCall) {
    // Si ya está en llamada, rechazar automáticamente
    socket.emit('answer_call', { chatId: call.chatId, answererId: state.currentUser?.id, accept: false });
    return;
  }
  useChatStore.setState({ incomingCall: call });
});

socket.on('call_answered', ({ chatId, answererId, accept }) => {
  const state = useChatStore.getState();
  const outgoingCall = state.outgoingCall;
  
  if (outgoingCall && outgoingCall.chatId === chatId) {
    if (accept) {
      useChatStore.setState({ 
        activeCall: { chatId, type: outgoingCall.type },
        outgoingCall: null 
      });
    } else {
      useChatStore.setState({ outgoingCall: null });
      alert('Llamada rechazada');
    }
  } else if (state.activeCall?.chatId === chatId && !accept) {
    useChatStore.setState({ activeCall: null });
    alert('Llamada terminada');
  }
});

socket.on('call_ended', ({ chatId }) => {
  const state = useChatStore.getState();
  if (state.activeCall?.chatId === chatId || state.incomingCall?.chatId === chatId || state.outgoingCall?.chatId === chatId) {
    useChatStore.setState({ activeCall: null, incomingCall: null, outgoingCall: null });
  }
});

socket.on('spam_warning', ({ message }) => {
  alert('⚠️ Anti-Spam: ' + message);
});

if (restoredUser && restoredUser.id) {
  // Validar que el usuario aún existe en la BD antes de reconectar
  (async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/validate/${restoredUser.id}`);
      if (!response.ok) {
        console.warn('⚠️ Usuario eliminado de la BD. Cerrando sesión automáticamente...');
        localStorage.removeItem('asicme_user');
        useChatStore.setState({ isAuthenticated: false, isValidatingSession: false, currentUser: null });
        return;
      }
      // Usuario válido: proceder con la reconexión normal
      const data = await response.json();
      if (data.user) {
        localStorage.setItem('asicme_user', JSON.stringify(data.user));
        useChatStore.setState({ currentUser: data.user, isAuthenticated: true, isValidatingSession: false });
      } else {
        useChatStore.setState({ isAuthenticated: true, isValidatingSession: false });
      }
      socket.emit('user_connected', restoredUser.id);
      useChatStore.getState().fetchChats(restoredUser.id);
      useChatStore.getState().fetchContacts(restoredUser.id);
    } catch (error) {
      console.error('Error validando sesión al iniciar:', error);
      // Si el servidor no está disponible, confiar en localStorage temporalmente
      useChatStore.setState({ isAuthenticated: true, isValidatingSession: false });
      socket.emit('user_connected', restoredUser.id);
      useChatStore.getState().fetchChats(restoredUser.id);
      useChatStore.getState().fetchContacts(restoredUser.id);
    }
  })();
} else {
  useChatStore.setState({ isValidatingSession: false });
}
