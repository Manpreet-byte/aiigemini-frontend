import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader, LogOut, UserCircle, Menu, Download, Share2, Mic, Image as ImageIcon, Copy, RotateCw, Volume2, VolumeX } from 'lucide-react';
import './Chat.css';
import ProfileModal from './ProfileModal';
import ChatHistory from './ChatHistory';
import { db } from './firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where, updateDoc, doc } from 'firebase/firestore';

// --- CONFIGURATION ---
// Backend API base URL (defaults to local dev server)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const API_URL = `${API_BASE_URL}/chat`;
const VISION_API_URL = `${API_BASE_URL}/vision`;
const SYSTEM_INSTRUCTION = "You are a helpful and friendly AI chat assistant. Keep your responses concise and engaging, and always answer truthfully and ethically. Respond using markdown. If the user asks you to generate, create, or draw an image, respond with '[IMAGE_REQUEST: description]' where description is a detailed prompt for the image they want.";

// Free image generation API (Pollinations.ai)
const generateImageURL = (prompt) => {
  const encodedPrompt = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;
};

/**
 * Main application component for the AI Chatbot.
 */
const App = ({ user, onLogout }) => {
  // State for storing the conversation messages
  const [messages, setMessages] = useState([]);
  // State for the current user input
  const [input, setInput] = useState('');
  // State to track loading status
  const [isLoading, setIsLoading] = useState(false);
  // State for profile modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  // Count user messages
  const [userMessageCount, setUserMessageCount] = useState(0);
  // Current chat session ID
  const [currentChatId, setCurrentChatId] = useState(null);
  // Show/hide chat history sidebar
  const [showHistory, setShowHistory] = useState(true);
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  // Selected image for upload
  const [selectedImage, setSelectedImage] = useState(null);
  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  // Text-to-speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(() => {
    const saved = localStorage.getItem('speechEnabled');
    return saved ? JSON.parse(saved) : false;
  });
  // Shortcuts help modal
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  // Ref to automatically scroll to the bottom of the chat area
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputFieldRef = useRef(null);

  // Scrolls to the bottom of the chat history whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Save speech preference
  useEffect(() => {
    localStorage.setItem('speechEnabled', JSON.stringify(speechEnabled));
  }, [speechEnabled]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + K: New chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleNewChat();
      }
      // Ctrl/Cmd + /: Toggle history
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowHistory(prev => !prev);
      }
      // Ctrl/Cmd + Shift + D: Toggle dark mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setDarkMode(prev => !prev);
      }
      // Ctrl/Cmd + Shift + S: Toggle speech
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setSpeechEnabled(prev => !prev);
      }
      // Escape: Close modals
      if (e.key === 'Escape') {
        setShowProfileModal(false);
        setShowShortcuts(false);
      }
      // ?: Show shortcuts
      if (e.shiftKey && e.key === '?') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input on load
  useEffect(() => {
    inputFieldRef.current?.focus();
  }, [currentChatId]);

  // Create a new chat session
  const createNewChat = async () => {
    try {
      console.log('Creating new chat for user:', user?.uid);
      const chatRef = await addDoc(collection(db, "chats"), {
        userId: user?.uid || '',
        title: 'New Chat',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: '',
        lastSender: '',
        pinned: false,
        category: 'personal',
      });
      console.log('New chat created with ID:', chatRef.id);
      setCurrentChatId(chatRef.id);
      setMessages([]);
      return chatRef.id;
    } catch (error) {
      console.error('Error creating new chat:', error);
      console.error('Error details:', error.message, error.code);
      alert(`Failed to create chat: ${error.message}`);
      return null;
    }
  };

  // Initialize with a new chat on first load
  useEffect(() => {
    if (user?.uid && !currentChatId) {
      createNewChat();
    }
  }, [user]);

  // Load messages from Firestore for the current chat
  useEffect(() => {
    if (!currentChatId) {
      console.log('No currentChatId, skipping message load');
      return;
    }

    console.log('Loading messages for chat:', currentChatId);

    const q = query(
      collection(db, "messages"),
      where("chatId", "==", currentChatId),
      orderBy("createdAt")
    );
    
    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const msgs = [];
        querySnapshot.forEach((doc) => {
          msgs.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('Loaded messages:', msgs.length);
        
        // If no messages, show welcome message
        if (msgs.length === 0) {
          msgs.push({ 
            sender: 'ai', 
            text: `Hello ${user?.name || 'there'}! I'm your AI assistant. Ask me anything!`,
            isWelcome: true 
          });
        }
        setMessages(msgs);
      },
      (error) => {
        console.error('Error loading messages:', error);
        console.error('Error details:', error.code, error.message);
        
        // Show error message
        setMessages([{ 
          sender: 'ai', 
          text: `Error loading messages. Please check the console. Error: ${error.message}`,
          isWelcome: true 
        }]);
      }
    );
    
    return () => unsubscribe();
  }, [currentChatId, user]);

  // Utility function to convert chat history for the Gemini API payload
  const formatHistoryForAPI = (currentMessages) => {
    // Map application state structure to API structure (user -> user, ai -> model)
    return currentMessages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));
  };

  // Utility function to handle exponential backoff for API retries
  const fetchWithRetries = async (url, options, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }
        // If not OK, throw error to trigger retry (unless it's a 4xx client error)
        if (response.status < 500) {
            // Log client error and stop retrying
            console.error('Client Error:', response.status, await response.text());
            throw new Error(`Client Error: ${response.status}`);
        }
        
        throw new Error(`Server Error: ${response.status}`);

      } catch (error) {
        if (i < retries - 1) {
          const delay = Math.pow(2, i) * 1000;
          console.log(`Attempt ${i + 1} failed. Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error; // Re-throw last error after final attempt
        }
      }
    }
  };


  /**
   * Handles sending the user's message, updating the UI, 
   * and calling the AI API with the conversation context.
   */
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmedInput = input.trim();

    if ((!trimmedInput && !selectedImage) || isLoading) return;

    setInput('');
    setIsLoading(true);
    setUserMessageCount(prev => prev + 1);

    // Check if we have a chat ID
    if (!currentChatId) {
      console.error('No chat ID available. Creating new chat...');
      const newChatId = await createNewChat();
      if (!newChatId) {
        alert('Failed to create chat. Please refresh the page.');
        setIsLoading(false);
        return;
      }
      // Don't continue with this message, let user resend
      setInput(trimmedInput);
      setIsLoading(false);
      return;
    }

    // 1. Add user message to Firestore
    let userMessageRef;
    try {
      console.log('Saving message to Firestore...', { chatId: currentChatId });
      const messageData = {
        sender: 'user',
        text: trimmedInput || '[Image]',
        createdAt: serverTimestamp(),
        chatId: currentChatId,
        userId: user?.uid || '',
        userName: user?.name || '',
      };
      
      if (selectedImage) {
        messageData.hasImage = true;
        messageData.imageData = selectedImage; // Store base64 image
      }

      userMessageRef = await addDoc(collection(db, "messages"), messageData);
      console.log('Message saved successfully');

      // Update chat title if this is the first message and store lastMessage
      const nonWelcomeMessages = messages.filter(m => !m.isWelcome);
      if (nonWelcomeMessages.length === 0) {
        const chatTitle = trimmedInput.length > 40 
          ? trimmedInput.substring(0, 40) + '...' 
          : trimmedInput || 'Image chat';
        await updateDoc(doc(db, "chats", currentChatId), {
          title: chatTitle,
          lastMessage: trimmedInput || '[Image]',
          lastSender: 'user',
          updatedAt: serverTimestamp(),
        });
      } else {
        // Update last message and timestamp
        await updateDoc(doc(db, "chats", currentChatId), {
          lastMessage: trimmedInput || '[Image]',
          lastSender: 'user',
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error saving user message:', error);
      setIsLoading(false);
      return;
    }

    // 2. Prepare payload for API call
    try {
      let apiUrl = API_URL;
      let payload;

      if (selectedImage) {
        // Use Vision API for image analysis
        apiUrl = VISION_API_URL;
        const base64Image = selectedImage.split(',')[1]; // Remove data:image/...;base64, prefix
        
        payload = {
          contents: [{
            parts: [
              { text: trimmedInput || "What's in this image?" },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image
                }
              }
            ]
          }],
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          }
        };
        
        // Clear image after sending
        handleRemoveImage();
      } else {
        // Regular text chat
        const chatHistory = formatHistoryForAPI([
          ...messages.filter(m => !m.hasImage), // Exclude image messages from history for now
          { sender: 'user', text: trimmedInput }
        ]);

        payload = {
          contents: chatHistory,
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          },
        };
      }

      // 3. Call the API with retries
      console.log('Calling Gemini API...');
      const response = await fetchWithRetries(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log('API Response received:', result);

      // 4. Extract and process the AI response
      const candidate = result.candidates?.[0];
      let aiText = "I'm sorry, I couldn't generate a response.";

      if (candidate && candidate.content?.parts?.[0]?.text) {
        aiText = candidate.content.parts[0].text;
      }

      // Check if AI wants to generate an image
      const imageRequestMatch = aiText.match(/\[IMAGE_REQUEST:\s*(.+?)\]/);
      let generatedImageUrl = null;
      
      if (imageRequestMatch) {
        const imagePrompt = imageRequestMatch[1].trim();
        console.log('Image generation requested:', imagePrompt);
        
        // Generate image URL
        generatedImageUrl = generateImageURL(imagePrompt);
        
        // Clean the text response (remove the image request tag)
        aiText = aiText.replace(/\[IMAGE_REQUEST:\s*.+?\]/, '').trim();
        
        // Add a nice message if text is empty
        if (!aiText) {
          aiText = `Here's the image you requested: "${imagePrompt}"`;
        }
      }

      // 5. Add AI message to Firestore
      console.log('Saving AI response to Firestore...');
      const aiMessageData = {
        sender: 'ai',
        text: aiText,
        createdAt: serverTimestamp(),
        chatId: currentChatId,
      };
      
      if (generatedImageUrl) {
        aiMessageData.hasImage = true;
        aiMessageData.imageUrl = generatedImageUrl;
        console.log('AI message includes generated image:', generatedImageUrl);
      }
      
      const aiMessageRef = await addDoc(collection(db, "messages"), aiMessageData);
      console.log('AI message saved successfully with ID:', aiMessageRef.id);

      // Update chat lastMessage for preview
      console.log('Updating chat metadata...');
      await updateDoc(doc(db, "chats", currentChatId), {
        lastMessage: generatedImageUrl ? `${aiText} [Image]` : aiText,
        lastSender: 'ai',
        updatedAt: serverTimestamp(),
      });
      console.log('Chat metadata updated successfully');

      // 6. Text-to-speech for AI response (if enabled)
      if (speechEnabled && 'speechSynthesis' in window) {
        speakText(aiText);
      }

    } catch (error) {
      console.error('AI Chat Error:', error);
      console.error('Error type:', error.name);
      console.error('Error message:', error.message);
      
      // Save error message to Firestore
      try {
        console.log('Saving error message to Firestore...');
        const errorMessageRef = await addDoc(collection(db, "messages"), {
          sender: 'ai',
          text: `I encountered an error: ${error.message}. Please try again or check your connection.`,
          createdAt: serverTimestamp(),
          chatId: currentChatId,
          isError: true,
        });
        console.log('Error message saved with ID:', errorMessageRef.id);
        
        // Update chat with error
        await updateDoc(doc(db, "chats", currentChatId), {
          lastMessage: "Error occurred",
          lastSender: 'ai',
          updatedAt: serverTimestamp(),
        });
      } catch (saveError) {
        console.error('Failed to save error message to Firestore:', saveError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectChat = (chatId) => {
    setCurrentChatId(chatId);
    setMessages([]);
  };

  const handleNewChat = () => {
    createNewChat();
  };

  // Text-to-speech
  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Copy message to clipboard
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
      console.log('Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Regenerate last AI response
  const regenerateResponse = async () => {
    if (isLoading) return;
    
    // Find the last user message
    const userMessages = messages.filter(m => m.sender === 'user' && !m.isWelcome);
    if (userMessages.length === 0) return;
    
    const lastUserMessage = userMessages[userMessages.length - 1];
    setInput(lastUserMessage.text);
    
    // Trigger send
    setTimeout(() => {
      const form = document.querySelector('.input-form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }, 100);
  };

  // Export chat as text
  const handleExportChat = () => {
    const chatText = messages
      .filter(m => !m.isWelcome)
      .map(msg => `${msg.sender === 'user' ? 'You' : 'AI'}: ${msg.text}`)
      .join('\n\n');
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Share chat (copy link to clipboard)
  const handleShareChat = async () => {
    try {
      const shareUrl = `${window.location.origin}/chat/${currentChatId}`;
      await navigator.clipboard.writeText(shareUrl);
      alert('Chat link copied to clipboard!');
    } catch (error) {
      console.error('Error sharing chat:', error);
      alert('Failed to copy link');
    }
  };

  // Voice input (Web Speech API)
  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported in your browser. Please try Chrome or Edge.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsRecording(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      alert('Voice input failed. Please try again.');
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  // Handle image upload
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Component to display individual chat messages
   */
  const Message = ({ message }) => {
    const isUser = message.sender === 'user';
    const [showActions, setShowActions] = useState(false);
    
    // Simple markdown parsing (e.g., replacing **text** with bold for better display)
    const content = message.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    return (
      <div 
        className={`message-wrapper ${isUser ? 'user' : 'ai'}`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className={`message-bubble ${isUser ? 'user' : 'ai'}`}>
          {/* Sender Icon */}
          <div className="message-icon">
            {isUser ? <User size={16} /> : <Bot size={16} />}
          </div>
          {/* Message Content */}
          <div className="message-content" dangerouslySetInnerHTML={{ __html: content }} />
          
          {/* Message Actions */}
          {showActions && !message.isWelcome && (
            <div className="message-actions">
              <button
                onClick={() => copyToClipboard(message.text)}
                className="message-action-button"
                title="Copy message"
              >
                <Copy size={14} />
              </button>
              {!isUser && (
                <button
                  onClick={() => speakText(message.text)}
                  className="message-action-button"
                  title="Read aloud"
                >
                  <Volume2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Show image if present - User uploaded */}
        {message.hasImage && message.imageData && (
          <div className="message-image">
            <img src={message.imageData} alt="User uploaded" />
          </div>
        )}
        
        {/* Show image if present - AI generated */}
        {message.hasImage && message.imageUrl && (
          <div className="message-image ai-generated">
            <img 
              src={message.imageUrl} 
              alt="AI generated" 
              onError={(e) => {
                console.error('Failed to load generated image');
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <div style={{ display: 'none', padding: '1rem', background: 'rgba(220, 38, 38, 0.1)', borderRadius: '8px' }}>
              Failed to load image. Please try again.
            </div>
          </div>
        )}
      </div>
    );
  };
  
  /**
   * Loading indicator component
   */
  const TypingIndicator = () => (
    <div className="typing-indicator">
      <div className="typing-bubble">
        <div className="message-icon">
          <Bot size={16} />
        </div>
        <span className="message-content">AI is thinking</span>
        <div className="typing-dots">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`chat-wrapper ${darkMode ? 'dark-mode' : ''}`}>
      {/* Chat History Sidebar */}
      {showHistory && (
        <ChatHistory
          user={user}
          currentChatId={currentChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          darkMode={darkMode}
        />
      )}

      <div className="chat-container">
        
        {/* Header */}
        <header className="chat-header">
          <div className="chat-header-left">
            <button 
              className="menu-toggle-button" 
              onClick={() => setShowHistory(!showHistory)}
              title="Toggle chat history"
            >
              <Menu size={20} />
            </button>
            <div className="bot-icon">
              <Bot size={24} />
            </div>
            <div className="chat-header-center">
              <h1>Gemini Chat Interface</h1>
              <p>Ask me anything and I'll remember our conversation!</p>
            </div>
          </div>

          {/* Chat Actions */}
          <div className="chat-header-actions">
            <button 
              onClick={() => setSpeechEnabled(!speechEnabled)} 
              className={`icon-button ${speechEnabled ? 'active' : ''}`}
              title={speechEnabled ? "Disable text-to-speech" : "Enable text-to-speech"}
            >
              {speechEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="icon-button" 
              title="Toggle dark mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            {/* Keyboard shortcuts icon removed as requested */}
            <button 
              onClick={handleExportChat} 
              className="icon-button" 
              title="Export chat"
              disabled={messages.filter(m => !m.isWelcome).length === 0}
            >
              <Download size={18} />
            </button>
            <button 
              onClick={handleShareChat} 
              className="icon-button" 
              title="Share chat"
              disabled={!currentChatId}
            >
              <Share2 size={18} />
            </button>
            <button 
              onClick={regenerateResponse} 
              className="icon-button" 
              title="Regenerate last response"
              disabled={isLoading || messages.filter(m => m.sender === 'user' && !m.isWelcome).length === 0}
            >
              <RotateCw size={18} />
            </button>
          </div>
          
          {/* User Profile */}
          <div className="user-profile" onClick={() => setShowProfileModal(true)} style={{ cursor: 'pointer' }}>
            <div className="user-avatar">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.name} />
              ) : (
                user?.name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div className="user-info">
              <p className="user-name">{user?.name || 'User'}</p>
              <p className="user-email">{user?.email || ''}</p>
            </div>
          </div>
          
          {/* Logout Button */}
          <button onClick={onLogout} className="logout-button">
            <LogOut size={16} style={{ marginRight: '0.25rem' }} />
            Logout
          </button>
        </header>

        {/* Chat Messages Area */}
        <div className="messages-area">
          {messages.map((msg, index) => (
            <Message key={index} message={msg} />
          ))}
          
          {isLoading && <TypingIndicator />}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="input-area">
          {selectedImage && (
            <div className="image-preview">
              <img src={selectedImage} alt="Selected" />
              <button onClick={handleRemoveImage} className="remove-image-button">
                <User size={16} />
              </button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="input-form">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="input-icon-button"
              title="Upload image"
              disabled={isLoading}
            >
              <ImageIcon size={20} />
            </button>
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`input-icon-button ${isRecording ? 'recording' : ''}`}
              title="Voice input"
              disabled={isLoading}
            >
              <Mic size={20} />
            </button>
            <input
              type="text"
              ref={inputFieldRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message here..."
              className="input-field"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={(!input.trim() && !selectedImage) || isLoading}
              className="send-button"
            >
              {isLoading ? (
                <Loader className="spinner" size={20} />
              ) : (
                <Send className="send-icon" size={20} />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          user={user}
          messageCount={userMessageCount}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal-content shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} className="modal-close-button">×</button>
            </div>
            <div className="shortcuts-list">
              <div className="shortcut-item">
                <kbd>Ctrl</kbd> + <kbd>K</kbd>
                <span>New chat</span>
              </div>
              <div className="shortcut-item">
                <kbd>Ctrl</kbd> + <kbd>/</kbd>
                <span>Toggle chat history</span>
              </div>
              <div className="shortcut-item">
                <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd>
                <span>Toggle dark mode</span>
              </div>
              <div className="shortcut-item">
                <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>
                <span>Toggle text-to-speech</span>
              </div>
              <div className="shortcut-item">
                <kbd>Shift</kbd> + <kbd>?</kbd>
                <span>Show shortcuts</span>
              </div>
              <div className="shortcut-item">
                <kbd>Esc</kbd>
                <span>Close modals</span>
              </div>
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.7 }}>
              On Mac, use <kbd>Cmd</kbd> instead of <kbd>Ctrl</kbd>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
