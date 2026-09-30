"use client";
// @ts-nocheck
import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect } from 'react';
import { Button } from './button';
import { MessageCircle, X, Send } from 'lucide-react';

export function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  
  const { messages, sendMessage, status } = useChat();
  
  const isLoading = status === 'in_progress' || status === 'streaming';
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="flex flex-col w-80 sm:w-96 h-[500px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              <MessageCircle size={18} className="text-indigo-400" />
              AI Assistant
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition">
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 mt-10">
                <p>Hello! I am your AI assistant.</p>
                <p className="text-sm mt-2">How can I help you today?</p>
              </div>
            )}
            
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                    m.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-sm' 
                      : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'
                  }`}
                >
                  {m.parts?.map((part, i) => (
                    <div key={i}>
                      {part.type === 'tool' && (
                        <div className="text-xs text-indigo-300 italic mb-1 flex items-center gap-1">
                          <span className="animate-pulse">●</span> Searching database...
                        </div>
                      )}
                      {part.type === 'text' && <span>{part.text}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-400 rounded-2xl px-4 py-2 text-sm rounded-tl-sm animate-pulse border border-slate-700">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="p-3 bg-slate-800 border-t border-slate-700 flex gap-2">
            <input
              value={input || ''}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
              disabled={isLoading || !input?.trim()}
            >
              <Send size={16} />
            </Button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center justify-center"
        >
          <MessageCircle size={24} />
        </button>
      )}
    </div>
  );
}
