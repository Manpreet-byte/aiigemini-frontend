import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, Clock, Search, Pin, X } from 'lucide-react';
import { db } from './firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, getDocs, writeBatch, limit } from 'firebase/firestore';
import './ChatHistory.css';

const ChatHistory = ({ user, currentChatId, onSelectChat, onNewChat, darkMode }) => {
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indexLink, setIndexLink] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  const categories = ['all', 'work', 'personal', 'learning', 'other'];

  // Load all chats for the current user
  useEffect(() => {
    if (!user?.uid) {
      console.log('ChatHistory: no user.uid, not loading chats');
      setChats([]);
      return;
    }

    console.log('ChatHistory: loading chats for user', user.uid);

    const q = query(
      collection(db, "chats"),
      where("userId", "==", user.uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const chatList = [];
      querySnapshot.forEach((doc) => {
        chatList.push({ id: doc.id, ...doc.data() });
      });
      console.log('ChatHistory: loaded', chatList.length, 'chats');
      setChats(chatList);
      setLoading(false);
    }, (error) => {
      console.error('ChatHistory: snapshot error', error);
      const msg = error.message || String(error);
      setError(msg);
      // Try to extract the Firebase console index creation link if present
      const urlMatch = msg.match(/https:\/\/console\.firebase\.google\.com\/[\w\-\/\?=\%\.]+create_composite=[^\s)]+/i);
      if (urlMatch && urlMatch[0]) {
        setIndexLink(urlMatch[0]);
      } else {
        setIndexLink(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this chat? This cannot be undone.')) return;

    try {
      // Delete all messages for this chat in batches, then delete the chat doc
      const messagesCol = collection(db, 'messages');
      // Keep deleting in batches of 200 until no docs remain
      const batchSize = 200;
      while (true) {
        const q = query(messagesCol, where('chatId', '==', chatId), limit(batchSize));
        const snapshot = await getDocs(q);
        if (snapshot.empty) break;
        const batch = writeBatch(db);
        snapshot.forEach(docSnap => batch.delete(doc(db, 'messages', docSnap.id)));
        await batch.commit();
        if (snapshot.size < batchSize) break;
      }

      // finally delete the chat doc
      await deleteDoc(doc(db, "chats", chatId));
      // If deleting current chat, switch to a new one
      if (chatId === currentChatId) {
        onNewChat();
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const handleClearAllChats = async () => {
    if (isClearing) return; // Prevent multiple clicks
    
    const confirmMessage = `Are you sure you want to delete ALL ${chats.length} chat${chats.length !== 1 ? 's' : ''}? This action cannot be undone and will permanently delete all messages.`;
    
    if (!window.confirm(confirmMessage)) return;

    // Double confirmation for safety
    if (!window.confirm('This is your last chance. Really delete ALL chats?')) return;

    setIsClearing(true);
    
    try {
      console.log('Clearing all chats for user:', user.uid);
      console.log('Total chats to delete:', chats.length);
      
      // Get a snapshot of chat IDs before we start deleting
      const chatIds = chats.map(chat => chat.id);
      console.log('Chat IDs:', chatIds);
      
      // Delete all messages for all chats first
      const messagesCol = collection(db, 'messages');
      const batchSize = 200;
      
      for (const chatId of chatIds) {
        console.log('Deleting messages for chat:', chatId);
        let deletedCount = 0;
        
        // Delete messages for each chat
        while (true) {
          const q = query(messagesCol, where('chatId', '==', chatId), limit(batchSize));
          const snapshot = await getDocs(q);
          
          if (snapshot.empty) {
            console.log(`No more messages for chat ${chatId}. Deleted ${deletedCount} messages.`);
            break;
          }
          
          const batch = writeBatch(db);
          snapshot.forEach(docSnap => {
            batch.delete(doc(db, 'messages', docSnap.id));
            deletedCount++;
          });
          
          await batch.commit();
          console.log(`Deleted batch of ${snapshot.size} messages for chat ${chatId}`);
          
          if (snapshot.size < batchSize) break;
        }
      }

      console.log('All messages deleted. Now deleting chat documents...');

      // Delete all chat documents (max 500 per batch)
      const maxBatchSize = 500;
      for (let i = 0; i < chatIds.length; i += maxBatchSize) {
        const batchChatIds = chatIds.slice(i, i + maxBatchSize);
        const chatBatch = writeBatch(db);
        
        batchChatIds.forEach(chatId => {
          chatBatch.delete(doc(db, 'chats', chatId));
        });
        
        await chatBatch.commit();
        console.log(`Deleted batch of ${batchChatIds.length} chat documents`);
      }

      console.log('All chats cleared successfully');
      alert('All chats have been deleted successfully!');
      
      // Create a new chat after clearing
      onNewChat();
    } catch (error) {
      console.error('Error clearing all chats:', error);
      console.error('Error details:', error.message, error.code);
      alert(`Failed to clear all chats: ${error.message}`);
    } finally {
      setIsClearing(false);
    }
  };

  const handlePinChat = async (chatId, e) => {
    e.stopPropagation();
    try {
      const chat = chats.find(c => c.id === chatId);
      await updateDoc(doc(db, "chats", chatId), {
        pinned: !chat?.pinned,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error pinning chat:', error);
    }
  };

  const handleSetCategory = async (chatId, category) => {
    try {
      await updateDoc(doc(db, "chats", chatId), {
        category: category,
        updatedAt: serverTimestamp(),
      });
      setEditingChatId(null);
    } catch (error) {
      console.error('Error setting category:', error);
    }
  };

  // Filter chats based on search query and category
  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || chat.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Sort: pinned first, then by date
  const sortedChats = [...filteredChats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) return 'Just now';
    // Less than 1 hour
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    // Less than 1 day
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    // Less than 1 week
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className={`chat-history ${darkMode ? 'dark-mode' : ''}`}>
      <div className="chat-history-header">
        <h3>Chat History</h3>
        <button className="new-chat-button" onClick={onNewChat} title="New Chat">
          <Plus size={18} />
        </button>
      </div>

      {/* Category Filter */}
      <div className="category-filter">
        {categories.map(cat => (
          <button
            key={cat}
            className={`category-button ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="clear-search">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Clear All Chats Button */}
      {chats.length > 0 && (
        <div className="clear-all-container">
          <button 
            className="clear-all-button" 
            onClick={handleClearAllChats}
            title="Delete all chats permanently"
            disabled={isClearing}
          >
            <Trash2 size={14} />
            <span>{isClearing ? 'Deleting...' : `Clear All Chats (${chats.length})`}</span>
          </button>
        </div>
      )}

      <div className="chat-history-list">
        {loading ? (
          <div className="no-chats">
            <p>Loading chats...</p>
          </div>
        ) : error ? (
          <div className="no-chats">
            <p>Error loading chats</p>
            <pre style={{ color: 'white', fontSize: '0.75rem' }}>{error}</pre>
            {indexLink && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: '0.8rem' }}>It looks like a Firestore composite index is required.</p>
                <a href={indexLink} target="_blank" rel="noopener noreferrer" style={{ color: '#b7e0ff' }}>
                  Create required Firestore index in Console
                </a>
              </div>
            )}
          </div>
        ) : sortedChats.length === 0 ? (
          <div className="no-chats">
            <MessageSquare size={32} />
            <p>{searchQuery ? 'No chats found' : 'No chats yet'}</p>
            {!searchQuery && (
              <button className="start-chat-button" onClick={onNewChat}>
                Start a new chat
              </button>
            )}
          </div>
        ) : (
          sortedChats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-history-item ${chat.id === currentChatId ? 'active' : ''} ${chat.pinned ? 'pinned' : ''}`}
              onClick={() => onSelectChat(chat.id)}
            >
              <div className="chat-history-item-header">
                <MessageSquare size={16} />
                <span className="chat-title">{chat.title || 'New Chat'}</span>
                <div className="chat-actions">
                  <button
                    className={`pin-chat-button ${chat.pinned ? 'pinned' : ''}`}
                    onClick={(e) => handlePinChat(chat.id, e)}
                    title={chat.pinned ? "Unpin chat" : "Pin chat"}
                  >
                    <Pin size={14} />
                  </button>
                  <button
                    className="delete-chat-button"
                    onClick={(e) => handleDeleteChat(chat.id, e)}
                    title="Delete chat"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {chat.lastMessage && (
                <div className="chat-preview">
                  <span className="preview-sender">{chat.lastSender === 'ai' ? 'AI' : 'You'}:</span>
                  <span className="preview-text">{chat.lastMessage.length > 80 ? chat.lastMessage.substring(0, 80) + '...' : chat.lastMessage}</span>
                </div>
              )}
              <div className="chat-history-item-footer">
                <Clock size={12} />
                <span className="chat-timestamp">{formatDate(chat.updatedAt)}</span>
                {chat.pinned && <span className="pinned-badge">📌</span>}
                {editingChatId === chat.id ? (
                  <select
                    value={chat.category || 'other'}
                    onChange={(e) => handleSetCategory(chat.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="category-select"
                  >
                    {categories.filter(c => c !== 'all').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <span 
                    className="category-badge"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingChatId(chat.id);
                    }}
                    title="Click to change category"
                  >
                    {chat.category || 'other'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatHistory;
