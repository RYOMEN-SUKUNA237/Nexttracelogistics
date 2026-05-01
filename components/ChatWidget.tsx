import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Minimize2, User, Headphones, Loader2 } from 'lucide-react';
import * as api from '../services/api';

interface Message {
  id: number;
  conversation_id: number;
  sender_type: 'visitor' | 'admin';
  sender_name: string;
  content: string;
  is_read: number;
  created_at: string;
}

const getVisitorId = (): string => {
  let id = localStorage.getItem('aura_visitor_id');
  if (!id) {
    id = 'visitor_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('aura_visitor_id', id);
  }
  return id;
};

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [name, setName] = useState(localStorage.getItem('aura_visitor_name') || '');
  const [email, setEmail] = useState(localStorage.getItem('aura_visitor_email') || '');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // Start or resume conversation
  const startChat = async () => {
    if (!name.trim()) return;
    localStorage.setItem('aura_visitor_name', name.trim());
    if (email.trim()) localStorage.setItem('aura_visitor_email', email.trim());

    setLoading(true);
    try {
      const res = await api.messages.startConversation({
        visitor_id: getVisitorId(),
        visitor_name: name.trim(),
        visitor_email: email.trim() || undefined,
      });
      setConversationId(res.conversation.id);
      setMessages(res.messages || []);
      setShowIntro(false);
      scrollToBottom();
    } catch (err) {
      console.error('Failed to start conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-resume conversation on open
  useEffect(() => {
    if (isOpen && showIntro && name) {
      const savedName = localStorage.getItem('aura_visitor_name');
      if (savedName) {
        startChat();
      }
    }
  }, [isOpen]);

  // Poll for new messages every 4 seconds when chat is open
  useEffect(() => {
    if (!conversationId || !isOpen) return;

    const poll = async () => {
      try {
        const res = await api.messages.getMessages(conversationId);
        if (res.messages && res.messages.length > messages.length) {
          const newMsgs = res.messages.slice(messages.length);
          const hasAdminMsg = newMsgs.some((m: Message) => m.sender_type === 'admin');
          setMessages(res.messages);
          if (hasAdminMsg) scrollToBottom();
        }
      } catch (e) {}
    };

    pollRef.current = setInterval(poll, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [conversationId, isOpen, messages.length]);

  // Poll for unread when chat is closed
  useEffect(() => {
    if (isOpen || !conversationId) return;

    const poll = async () => {
      try {
        const res = await api.messages.getMessages(conversationId);
        const unreadCount = (res.messages || []).filter(
          (m: Message) => m.sender_type === 'admin' && !m.is_read
        ).length;
        setUnread(unreadCount);
      } catch (e) {}
    };

    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, [isOpen, conversationId]);

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);

    // Optimistic update
    const tempMsg: Message = {
      id: Date.now(),
      conversation_id: conversationId,
      sender_type: 'visitor',
      sender_name: name,
      content,
      is_read: 0,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    scrollToBottom();

    try {
      const res = await api.messages.send({
        conversation_id: conversationId,
        content,
        sender_name: name,
        sender_type: 'visitor',
      });
      // Replace temp message with real one
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? res.message : m));
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="fixed bottom-5 right-5 z-[9999]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute bottom-16 right-0 w-[360px] h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#0a192f] px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center">
                  <Headphones size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Next Trace Logistics Support</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-gray-400 text-[11px]">We typically reply in minutes</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1">
                <Minimize2 size={18} />
              </button>
            </div>

            {showIntro ? (
              /* Intro form */
              <div className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                  <MessageCircle size={28} className="text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-[#0a192f] mb-1">Hi there!</h3>
                <p className="text-gray-500 text-sm text-center mb-6">
                  Have a question about your shipment or need help? Start a conversation with us.
                </p>
                <div className="w-full space-y-3">
                  <input
                    type="text"
                    placeholder="Your name *"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={startChat}
                    disabled={!name.trim() || loading}
                    className="w-full py-2.5 bg-[#0a192f] text-white font-medium rounded-lg hover:bg-[#112d57] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                    {loading ? 'Connecting...' : 'Start Chat'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Messages area */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
                  {messages.length === 0 && (
                    <div className="text-center text-gray-400 text-sm mt-8">
                      <p className="font-medium text-gray-500">No messages yet</p>
                      <p className="text-xs mt-1">Send a message to start the conversation</p>
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'visitor' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] ${msg.sender_type === 'visitor' ? 'order-1' : 'order-1'}`}>
                        {msg.sender_type === 'admin' && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                              <Headphones size={10} className="text-white" />
                            </div>
                            <span className="text-[10px] text-gray-500 font-medium">{msg.sender_name}</span>
                          </div>
                        )}
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            msg.sender_type === 'visitor'
                              ? 'bg-[#0a192f] text-white rounded-br-md'
                              : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <p className={`text-[10px] text-gray-400 mt-1 ${msg.sender_type === 'visitor' ? 'text-right' : 'text-left'}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="border-t border-gray-200 px-4 py-3 bg-white flex-shrink-0">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      rows={1}
                      className="flex-1 resize-none px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none max-h-20"
                      style={{ minHeight: '40px' }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || sending}
                      className="w-10 h-10 rounded-xl bg-[#0a192f] text-white flex items-center justify-center hover:bg-[#112d57] transition-colors disabled:opacity-40 flex-shrink-0"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) setUnread(0); }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-14 h-14 rounded-full bg-[#0a192f] text-white shadow-lg hover:shadow-xl flex items-center justify-center relative transition-shadow"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle size={24} />
            </motion.div>
          )}
        </AnimatePresence>
        {unread > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
            {unread}
          </span>
        )}
      </motion.button>
    </div>
  );
};

export default ChatWidget;
