"use client";
// @ts-nocheck
import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect } from 'react';
import { Button } from './button';
import { MessageCircle, X, ArrowUp, Loader2, Sparkles } from 'lucide-react';

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
    <div className="fixed bottom-6 right-6 z-50 font-sans tracking-tight">
      {isOpen ? (
        <div className="flex flex-col w-[350px] sm:w-[400px] h-[600px] bg-white border border-gray-200 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              <Sparkles size={16} className="text-gray-900" />
              AI Assistant
            </h3>
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-gray-400 hover:text-gray-900 transition-colors p-1 rounded-md hover:bg-gray-100"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#FAFAFA]">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-12 flex flex-col items-center">
                <div className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center mb-3 shadow-sm">
                  <Sparkles size={18} className="text-gray-900" />
                </div>
                <h4 className="text-gray-900 font-medium mb-1 text-sm">How can I help you today?</h4>
                <p className="text-xs text-gray-500 max-w-[200px] mx-auto leading-relaxed">
                  Ask me about room availability, reservations, and hotel reports.
                </p>
              </div>
            )}
            
            {messages.map(m => (
              <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div 
                  className={`max-w-[85%] px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
                    m.role === 'user' 
                      ? 'bg-gray-900 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-200'
                  }`}
                >
                  {m.parts?.map((part, i) => (
                    <div key={i}>
                      {part.type === 'tool' && (
                        <div className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md w-fit border border-gray-100">
                          <Loader2 size={12} className="animate-spin text-gray-400" /> 
                          Running tool...
                        </div>
                      )}
                      {part.type === 'text' && <span className="whitespace-pre-wrap">{part.text}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-500 rounded-2xl px-4 py-3 text-[14px] rounded-tl-sm border border-gray-200 shadow-sm flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-100">
            <form onSubmit={handleSubmit} className="relative flex items-center">
              <input
                value={input || ''}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask something..."
                className="w-full bg-gray-50 border border-gray-200 rounded-full pl-4 pr-12 py-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent transition-all shadow-sm"
                disabled={isLoading}
              />
              <button 
                type="submit" 
                className="absolute right-1.5 p-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-gray-900 transition-colors flex items-center justify-center"
                disabled={isLoading || !input?.trim()}
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gray-900 hover:bg-gray-800 text-white w-14 h-14 rounded-full shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 flex items-center justify-center"
        >
          <Sparkles size={24} />
        </button>
      )}
    </div>
  );
}
