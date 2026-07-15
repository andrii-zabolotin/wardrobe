import { create } from 'zustand';
import type { OutfitProposal } from '../components/OutfitProposalBubble';
import type { Garment } from '../api/garments';

export interface Message {
  role: 'user' | 'assistant';
  type: 'text' | 'outfit_proposal' | 'error';
  content?: string;
  outfits?: OutfitProposal[];
}

interface ChatState {
  messages: Message[];
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  ws: WebSocket | null;
  isTyping: boolean;
  connect: (token: string, avatarId: string | null) => void;
  sendMessage: (text: string) => void;
  disconnect: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [
    { role: 'assistant', content: "Hi! I'm your personal AI stylist. What are we dressing up for today?", type: 'text' }
  ],
  setMessages: (messages) => set((state) => ({
    messages: typeof messages === 'function' ? messages(state.messages) : messages
  })),
  ws: null,
  isTyping: false,
  
  connect: (token, avatarId) => {
    const { ws } = get();
    
    let path = `/ws/stylist?token=${token}`;
    if (avatarId) {
      path += `&avatar_id=${avatarId}`;
    }
    const url = `ws://${window.location.host}${path}`;

    if (ws) {
      if ((ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) && ws.url.includes(path)) {
        // Clear any previous connection error messages upon successful re-connect attempt
        set((state) => ({ messages: state.messages.filter(m => m.type !== 'error') }));
        return; // Already connected or connecting to this URL
      }
      ws.close();
    }

    const socket = new WebSocket(url);
    
    const buffer = { 
      renderSuggestions: [] as { outfitId: string, garments: Garment[] }[], 
      text: undefined as string | undefined 
    };
    let flushTimer: ReturnType<typeof setTimeout> | undefined;

    const flushBuffer = () => {
      if (buffer.renderSuggestions.length > 0 || buffer.text) {
        const outfits: OutfitProposal[] = buffer.renderSuggestions.map((r, i) => ({
          outfitId: r.outfitId,
          label: `Образ ${i + 1}`,
          garments: r.garments,
        }));

        const currentText = buffer.text;
        
        set((state) => {
          let newMessages = [...state.messages];
          if (outfits.length > 0) {
            newMessages.push({ role: 'assistant', type: 'outfit_proposal', content: currentText, outfits });
          } else if (currentText) {
            newMessages.push({ role: 'assistant', type: 'text', content: currentText });
          }
          return { messages: newMessages, isTyping: false };
        });
      }
      buffer.renderSuggestions = [];
      buffer.text = undefined;
    };

    socket.onmessage = (event) => {
      console.log("[Stylist WS] Received message:", event.data);
      clearTimeout(flushTimer);
      try {
        const data = JSON.parse(event.data);
        console.log("[Stylist WS] Parsed data:", data);
        
        if (data.type === 'message') {
          buffer.text = data.text;
          flushBuffer();
        } else if (data.type === 'render_suggestion') {
          buffer.renderSuggestions.push({ outfitId: data.outfit_id, garments: data.garments || [] });
          flushTimer = setTimeout(flushBuffer, 150);
        } else if (data.type === 'error') {
          flushBuffer();
          set((state) => ({
            messages: [...state.messages, { role: 'assistant', type: 'error', content: data.text }],
            isTyping: false
          }));
        }
      } catch (err) {
        console.error("[Stylist WS] Error processing message:", err);
      }
    };

    socket.onerror = () => {
      set((state) => ({
        messages: [...state.messages, { role: 'assistant', type: 'error', content: 'Connection error. Please refresh or try again later.' }],
        isTyping: false
      }));
    };

    socket.onclose = () => {
      set({ ws: null, isTyping: false });
    };

    set({ ws: socket });
  },
  
  sendMessage: (text) => {
    const { ws, messages } = get();
    if (!text.trim() || !ws) return;

    set({ 
      messages: [...messages, { role: 'user', content: text, type: 'text' }],
      isTyping: true 
    });
    ws.send(JSON.stringify({ text }));
  },
  
  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null });
    }
  }
}));
