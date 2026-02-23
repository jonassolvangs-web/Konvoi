'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Send, Plus, Search, X } from 'lucide-react';
import Tabs from '@/components/ui/tabs';
import Card from '@/components/ui/card';
import Avatar from '@/components/ui/avatar';
import Badge from '@/components/ui/badge';
import EmptyState from '@/components/ui/empty-state';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { cn, getRoleLabel, formatTime } from '@/lib/utils';

interface Channel {
  channelId: string;
  channelType: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string | null;
  lastSender: string;
}

interface Message {
  id: string;
  content: string;
  isSystem: boolean;
  createdAt: string;
  sender: { id: string; name: string; roles: string[]; profileImageUrl?: string | null };
}

interface User {
  id: string;
  name: string;
  roles: string[];
  profileImageUrl?: string | null;
}

export default function ChatView() {
  const { data: session } = useSession();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('direct');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const userId = (session?.user as any)?.id;

  const fetchChannels = useCallback(() => {
    fetch('/api/chat/channels')
      .then((r) => r.json())
      .then((d) => setChannels(d.channels || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchMessages = useCallback(async (channelId: string) => {
    const res = await fetch(`/api/chat/${channelId}/messages`);
    const data = await res.json();
    setMessages(data.messages || []);
  }, []);

  const openNewChat = useCallback(async () => {
    setShowNewChat(true);
    setSearchQuery('');
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers((data.users || []).filter((u: User) => u.id !== userId));
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [userId]);

  const selectUser = useCallback((user: User) => {
    const ids = [userId, user.id].sort();
    const channelId = `${ids[0]}_${ids[1]}`;
    const existing = channels.find((c) => c.channelId === channelId);
    setSelectedChannel(existing || {
      channelId,
      channelType: 'direct',
      name: user.name,
      lastMessage: '',
      lastMessageAt: null,
      lastSender: '',
    });
    setShowNewChat(false);
  }, [userId, channels]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  // Polling for new messages
  useEffect(() => {
    if (selectedChannel) {
      fetchMessages(selectedChannel.channelId);
      pollingRef.current = setInterval(() => {
        fetchMessages(selectedChannel.channelId);
      }, 5000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedChannel, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedChannel) return;
    setSending(true);
    try {
      const body: any = { content: newMessage };
      if (selectedChannel.channelType === 'organization') {
        body.organizationId = selectedChannel.channelId;
      }

      await fetch(`/api/chat/${selectedChannel.channelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      setNewMessage('');
      fetchMessages(selectedChannel.channelId);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const directChannels = channels.filter((c) => c.channelType === 'direct');
  const orgChannels = channels.filter((c) => c.channelType === 'organization');
  const displayedChannels = tab === 'direct' ? directChannels : orgChannels;

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // New chat view - search and select a user
  if (showNewChat) {
    return (
      <div className="page-container">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setShowNewChat(false)} className="p-1 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="page-title">Ny melding</h1>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søk etter ansatte..."
            className="input-field w-full pl-10 pr-10"
            autoFocus
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100">
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        {loadingUsers ? (
          <LoadingSpinner />
        ) : filteredUsers.length === 0 ? (
          <EmptyState title="Ingen treff" description="Fant ingen ansatte med det navnet" />
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <Card key={user.id} hover onClick={() => selectUser(user)} padding="sm">
                <div className="flex items-center gap-3">
                  <Avatar name={user.name} imageUrl={user.profileImageUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{user.name}</p>
                    <Badge size="sm" color="bg-gray-100 text-gray-500">
                      {getRoleLabel(user.roles[0])}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Channel list view
  if (!selectedChannel) {
    return (
      <div className="page-container relative">
        <h1 className="page-title mb-4">Chat</h1>
        <Tabs
          tabs={[
            { id: 'direct', label: 'Direktemeldinger', count: directChannels.length },
            { id: 'organization', label: 'Sameie-chatter', count: orgChannels.length },
          ]}
          activeTab={tab}
          onChange={setTab}
          className="mb-4"
        />

        {displayedChannels.length === 0 ? (
          <EmptyState title="Ingen samtaler" description="Ingen samtaler ennå" />
        ) : (
          <div className="space-y-2">
            {displayedChannels.map((channel) => (
              <Card key={channel.channelId} hover onClick={() => setSelectedChannel(channel)} padding="sm">
                <div className="flex items-center gap-3">
                  <Avatar name={channel.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{channel.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {channel.lastSender && `${channel.lastSender}: `}{channel.lastMessage}
                    </p>
                  </div>
                  {channel.lastMessageAt && (
                    <span className="text-[10px] text-gray-400">{formatTime(channel.lastMessageAt)}</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <button
          onClick={openNewChat}
          className="fixed bottom-24 right-5 z-50 p-4 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition-colors"
          aria-label="Ny melding"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    );
  }

  // Chat window view
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        <button onClick={() => { setSelectedChannel(null); fetchChannels(); }} className="p-1 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar name={selectedChannel.name} size="sm" />
        <div>
          <p className="text-sm font-semibold">{selectedChannel.name}</p>
          <p className="text-[10px] text-gray-400">
            {selectedChannel.channelType === 'organization' ? 'Sameie-chat' : 'Direkte'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((msg) => {
          const isMine = msg.sender.id === userId;

          if (msg.isSystem) {
            return (
              <div key={msg.id} className="text-center">
                <span className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            );
          }

          return (
            <div key={msg.id} className={cn('flex gap-2', isMine ? 'justify-end' : 'justify-start')}>
              {!isMine && <Avatar name={msg.sender.name} imageUrl={msg.sender.profileImageUrl} size="sm" />}
              <div className={cn('max-w-[75%]')}>
                {!isMine && (
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium">{msg.sender.name}</span>
                    <Badge size="sm" color="bg-gray-100 text-gray-500">
                      {getRoleLabel(msg.sender.roles[0])}
                    </Badge>
                  </div>
                )}
                <div
                  className={cn(
                    'px-3 py-2 rounded-2xl text-sm',
                    isMine
                      ? 'bg-black text-white rounded-br-md'
                      : 'bg-white text-gray-900 rounded-bl-md border border-gray-100'
                  )}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100 bg-white safe-bottom">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Skriv en melding..."
            className="input-field flex-1"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="p-3 bg-black text-white rounded-xl disabled:opacity-30 hover:bg-gray-800 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
