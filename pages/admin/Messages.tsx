import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Search, Send, User, Clock, CheckCheck, Check,
  Archive, RotateCcw, Loader2, Inbox, Filter, X, Mail, MailOpen
} from 'lucide-react';
import * as api from '../../services/api';
import { useDebounced } from './components/useDebounced';

interface Conversation {
  id: number;
  visitor_id: string;
  visitor_name: string;
  visitor_email: string | null;
  subject: string | null;
  status: 'open' | 'closed';
  unread_count: number;
  last_message_at: string;
  created_at: string;
  last_message: string | null;
  last_sender_type: string | null;
  message_count: number;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_type: 'visitor' | 'admin';
  sender_name: string;
  content: string;
  is_read: number;
  created_at: string;
}

const Messages: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [search, setSearch] = useState('');
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [error, setError] = useState('');
  const debouncedSearch = useDebounced(search);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.messages.adminListConversations({
        status: filter === 'all' ? undefined : filter,
        search: debouncedSearch.trim() || undefined,
      });
      setConversations(res.conversations || []);
      setUnreadTotal(res.unread_total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearch]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Poll conversations every 5s
  useEffect(() => {
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Load conversation messages
  const openConversation = async (convo: Conversation) => {
    setSelectedId(convo.id);
    setSelectedConvo(convo);
    setMessagesLoading(true);
    try {
      const res = await api.messages.adminGetConversation(convo.id);
      setMessages(res.messages || []);
      setSelectedConvo(res.conversation);
      scrollToBottom();
      // Update the conversation in the list to reflect read status
      setConversations(prev =>
        prev.map(c => c.id === convo.id ? { ...c, unread_count: 0 } : c)
      );
    } catch (err: any) {
      setError(err.message || 'Failed to open the conversation.');
    } finally {
      setMessagesLoading(false);
    }
  };

  // Poll messages for selected conversation
  useEffect(() => {
    if (!selectedId) return;

    const poll = async () => {
      try {
        const res = await api.messages.adminGetConversation(selectedId);
        if (res.messages && res.messages.length > messages.length) {
          setMessages(res.messages);
          scrollToBottom();
        }
      } catch (e) {}
    };

    pollRef.current = setInterval(poll, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedId, messages.length]);

  // Send reply
  const sendReply = async () => {
    if (!replyText.trim() || !selectedId || sending) return;
    const content = replyText.trim();
    setReplyText('');
    setSending(true);

    try {
      const res = await api.messages.adminReply({ conversation_id: selectedId, content });
      setMessages(prev => [...prev, res.message]);
      scrollToBottom();
      fetchConversations();
    } catch (err: any) {
      setError(err.message || 'Your reply could not be sent.');
      setReplyText(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  const toggleConvoStatus = async (convo: Conversation) => {
    try {
      if (convo.status === 'open') {
        await api.messages.adminCloseConversation(convo.id);
      } else {
        await api.messages.adminReopenConversation(convo.id);
      }
      fetchConversations();
      if (selectedConvo?.id === convo.id) {
        setSelectedConvo(prev => prev ? { ...prev, status: prev.status === 'open' ? 'closed' : 'open' } : null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update the conversation.');
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const formatFullTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-[calc(100vh-120px)] flex bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Conversation list panel */}
      <div className={`${selectedId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 border-r border-gray-200 flex-shrink-0`}>
        {/* List header */}
        <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#0a192f]">Messages</h2>
              {unreadTotal > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">{unreadTotal}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {(['all', 'open', 'closed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    filter === f ? 'bg-[#0a192f] text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
            {error}
            <button onClick={() => setError('')} aria-label="Dismiss"><X size={12} /></button>
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Inbox size={32} className="mb-2" />
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs">Messages from visitors will appear here</p>
            </div>
          ) : (
            conversations.map(convo => (
              <button
                key={convo.id}
                onClick={() => openConversation(convo)}
                className={`w-full text-left px-5 py-3.5 border-b border-gray-50 transition-colors hover:bg-gray-50 ${
                  selectedId === convo.id ? 'bg-blue-50/60 border-l-[3px] border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    convo.status === 'open' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {convo.visitor_name?.charAt(0).toUpperCase() || 'V'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm font-semibold truncate ${convo.unread_count > 0 ? 'text-[#0a192f]' : 'text-gray-700'}`}>
                        {convo.visitor_name}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{formatTime(convo.last_message_at)}</span>
                    </div>
                    {convo.visitor_email && (
                      <p className="text-[10px] text-gray-400 truncate">{convo.visitor_email}</p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <p className={`text-xs truncate ${convo.unread_count > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                        {convo.last_sender_type === 'admin' && <span className="text-blue-500">You: </span>}
                        {convo.last_message || 'No messages'}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        {convo.unread_count > 0 && (
                          <span className="w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {convo.unread_count}
                          </span>
                        )}
                        {convo.status === 'closed' && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">Closed</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message detail panel */}
      <div className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-col flex-1`}>
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <MessageCircle size={28} className="text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">Select a conversation</p>
            <p className="text-xs mt-1">Choose from the list to view and reply</p>
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setSelectedId(null); setSelectedConvo(null); setMessages([]); }}
                  className="md:hidden p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  selectedConvo?.status === 'open' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {selectedConvo?.visitor_name?.charAt(0).toUpperCase() || 'V'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0a192f]">{selectedConvo?.visitor_name}</p>
                  <p className="text-[11px] text-gray-400">
                    {selectedConvo?.visitor_email || 'No email'}
                    {' · '}
                    <span className={selectedConvo?.status === 'open' ? 'text-green-500' : 'text-gray-400'}>
                      {selectedConvo?.status === 'open' ? 'Active' : 'Closed'}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedConvo && (
                  <button
                    onClick={() => toggleConvoStatus(selectedConvo)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
                      selectedConvo.status === 'open'
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    {selectedConvo.status === 'open' ? <><Archive size={12} /> Close</> : <><RotateCcw size={12} /> Reopen</>}
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-gray-50/50">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 size={24} className="animate-spin text-gray-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <p className="text-sm">No messages in this conversation</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isAdmin = msg.sender_type === 'admin';
                  const showDate = i === 0 || (
                    new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString()
                  );
                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex items-center justify-center my-2">
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                            {new Date(msg.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[70%]">
                          <div className="flex items-center gap-1.5 mb-1">
                            {!isAdmin && (
                              <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                                <User size={10} className="text-gray-500" />
                              </div>
                            )}
                            <span className="text-[10px] text-gray-500 font-medium">{msg.sender_name}</span>
                            <span className="text-[10px] text-gray-400">{formatFullTime(msg.created_at)}</span>
                            {isAdmin && (
                              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                                <CheckCheck size={10} className="text-blue-500" />
                              </div>
                            )}
                          </div>
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isAdmin
                                ? 'bg-[#0a192f] text-white rounded-br-md'
                                : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            <div className="border-t border-gray-200 px-5 py-3 bg-white flex-shrink-0">
              {selectedConvo?.status === 'closed' ? (
                <div className="flex items-center justify-center gap-2 py-2 text-gray-400 text-sm">
                  <Archive size={14} />
                  <span>This conversation is closed.</span>
                  <button
                    onClick={() => selectedConvo && toggleConvoStatus(selectedConvo)}
                    className="text-blue-500 hover:underline font-medium"
                  >
                    Reopen
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your reply..."
                    rows={1}
                    className="flex-1 resize-none px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-[#0a192f] focus:ring-1 focus:ring-[#0a192f] outline-none max-h-24"
                    style={{ minHeight: '42px' }}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!replyText.trim() || sending}
                    className="h-[42px] px-4 rounded-xl bg-[#0a192f] text-white flex items-center justify-center gap-2 hover:bg-[#112d57] transition-colors disabled:opacity-40 text-sm font-medium flex-shrink-0"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Reply
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Messages;
