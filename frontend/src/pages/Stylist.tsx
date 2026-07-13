import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Send, Sparkles, UserCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { triggerRender } from '../api/outfits';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'render_suggestion';
  outfitId?: string;
}

export default function Stylist() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm your personal AI stylist. What are we dressing up for today?", type: 'text' }
  ]);
  const [input, setInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  const token = useAuthStore(state => state.token);
  const activeAvatarId = useAuthStore(state => state.activeAvatarId);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!token) return;

    let url = `ws://${window.location.host}/ws/stylist?token=${token}`;
    if (activeAvatarId) {
      url += `&avatar_id=${activeAvatarId}`;
    }

    const socket = new WebSocket(url);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        setMessages(prev => [...prev, { role: 'assistant', content: data.text, type: 'text' }]);
      } else if (data.type === 'render_suggestion') {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "I've put together an outfit for you! Want to try it on?", 
          type: 'render_suggestion',
          outfitId: data.outfit_id
        }]);
      }
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [token, activeAvatarId]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !ws) return;

    setMessages(prev => [...prev, { role: 'user', content: input, type: 'text' }]);
    ws.send(JSON.stringify({ text: input }));
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
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-br-sm' 
                  : 'bg-muted rounded-bl-sm'
              }`}>
                {msg.type === 'text' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="font-medium">{msg.content}</p>
                    <Button 
                      onClick={() => msg.outfitId && handleRender(msg.outfitId)} 
                      variant="secondary" 
                      className="w-full"
                    >
                      Try On (Render)
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
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
    </div>
  );
}
