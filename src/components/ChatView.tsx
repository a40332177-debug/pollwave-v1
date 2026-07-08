import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types.js';
import { Send, MessageSquare, User, ShieldAlert } from 'lucide-react';

interface ChatViewProps {
  chat: ChatMessage[];
  currentUserName: string;
  currentUserRole: 'teacher' | 'student';
  onSendMessage: (text: string) => void;
}

export default function ChatView({ chat, currentUserName, currentUserRole, onSendMessage }: ChatViewProps) {
  const [messageText, setMessageText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    onSendMessage(messageText);
    setMessageText('');
  };

  return (
    <div id="chat-container" className="flex flex-col h-[400px] md:h-[480px] bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-white text-sm">Classroom Chat</span>
        </div>
        <span className="text-xs text-slate-400 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
          {chat.length} messages
        </span>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {chat.map((msg) => {
          const isSystem = msg.sender === 'System';
          const isTeacher = msg.role === 'teacher';
          const isMe = msg.sender === currentUserName && msg.role === currentUserRole;

          if (isSystem) {
            return (
              <div key={msg.id} className="text-center">
                <span className="inline-block px-3 py-1 bg-slate-800/40 text-[11px] text-slate-400 rounded-full border border-slate-800/80">
                  {msg.text}
                </span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] ${
                isMe ? 'ml-auto items-end' : 'mr-auto items-start'
              }`}
            >
              {/* Sender Name */}
              <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400 px-1">
                {isTeacher ? (
                  <span className="flex items-center gap-0.5 text-purple-400 font-semibold">
                    <ShieldAlert className="w-3 h-3" />
                    Teacher ({msg.sender})
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5">
                    <User className="w-3 h-3" />
                    {msg.sender}
                  </span>
                )}
                <span className="opacity-60">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              {/* Message bubble */}
              <div
                className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isTeacher
                    ? 'bg-purple-950/40 text-purple-200 border border-purple-800/60 shadow-lg shadow-purple-950/10'
                    : isMe
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={handleSend} className="p-3 bg-slate-950/80 border-t border-slate-800 flex gap-2">
        <input
          id="chat-input-field"
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Type a message to the classroom..."
          maxLength={150}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        />
        <button
          id="send-message-btn"
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl p-2 px-3 transition-all flex items-center justify-center border border-blue-500/30"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
