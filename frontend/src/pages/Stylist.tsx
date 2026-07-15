import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Send, Sparkles, UserCircle, WifiOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { triggerRender } from '../api/outfits';
import type { Garment } from '../api/garments';
import { GarmentPreviewModal } from '../components/GarmentPreviewModal';
import { OutfitProposalBubble } from '../components/OutfitProposalBubble';

export default function Stylist() {
  const messages = useChatStore(state => state.messages);
  const isTyping = useChatStore(state => state.isTyping);
  const connect = useChatStore(state => state.connect);
  const sendMessageToStore = useChatStore(state => state.sendMessage);
  
  const [input, setInput] = useState('');
  const [selectedGarment, setSelectedGarment] = useState<Garment | null>(null);
  
  const token = useAuthStore(state => state.token);
  const activeAvatarId = useAuthStore(state => state.activeAvatarId);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (token) {
      connect(token, activeAvatarId);
    }
    // We intentionally don't disconnect on unmount to keep the chat alive globally
  }, [token, activeAvatarId, connect]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessageToStore(input);
    setInput('');
  };

  const handleRender = async (outfitId: string) => {
    try {
      await triggerRender(outfitId);
      navigate('/gallery');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          Stylist Assistant
        </h2>
        <p className="text-muted-foreground">Chat with Gemini 2.5 Flash to find the perfect outfit from your wardrobe.</p>
      </div>

      {!activeAvatarId && (
        <div className="p-4 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg flex items-center justify-between">
          <p className="font-medium flex items-center gap-2"><UserCircle className="h-5 w-5"/> No active avatar selected. The stylist won't be able to generate render previews.</p>
          <Button variant="outline" className="border-amber-500/30 hover:bg-amber-500/10" onClick={() => navigate('/avatars')}>Select Avatar</Button>
        </div>
      )}

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.type === 'outfit_proposal' ? (
                <OutfitProposalBubble
                  outfits={msg.outfits ?? []}
                  text={msg.content}
                  onRender={handleRender}
                  onGarmentClick={setSelectedGarment}
                />
              ) : (
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-br-sm' 
                    : msg.type === 'error'
                    ? 'bg-destructive/10 text-destructive border border-destructive/20 rounded-bl-sm'
                    : 'bg-muted rounded-bl-sm'
                }`}>
                  {msg.type === 'text' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.content || ''}</ReactMarkdown>
                    </div>
                  ) : msg.type === 'error' ? (
                    <div className="flex items-center gap-2">
                      <WifiOff className="h-4 w-4" />
                      {msg.content}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center h-10">
                <div className="flex space-x-1.5 items-center">
                  <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        <div className="p-4 border-t bg-card">
          <form onSubmit={sendMessage} className="flex gap-2">
            <Input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="e.g. I have a date night tomorrow, what should I wear?" 
              className="flex-1 rounded-full px-6"
            />
            <Button type="submit" size="icon" className="rounded-full shrink-0" disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>

      {selectedGarment && (
        <GarmentPreviewModal
          garment={selectedGarment}
          open={!!selectedGarment}
          onClose={() => setSelectedGarment(null)}
        />
      )}
    </div>
  );
}
