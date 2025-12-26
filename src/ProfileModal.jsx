import React, { useState, useRef } from 'react';
import { X, Camera, User, Mail, Calendar, MessageSquare, Settings, Bell, Moon } from 'lucide-react';
import './ProfileModal.css';
import { auth, storage } from './firebase';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const ProfileModal = ({ user, onClose, messageCount = 0 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    photoURL: user?.photoURL || ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  // Load settings from localStorage or use defaults
  const getInitialSettings = () => {
    try {
      const saved = localStorage.getItem('aiii_user_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { notifications: true, darkMode: false, soundEnabled: true };
  };
  const [settings, setSettings] = useState(getInitialSettings);
  const fileInputRef = useRef(null);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size should be less than 5MB' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Upload to Firebase Storage
      const storageRef = ref(storage, `profile_photos/${auth.currentUser.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setFormData({ ...formData, photoURL: downloadURL });
      setMessage({ type: 'success', text: 'Photo uploaded successfully!' });
    } catch (error) {
      console.error('Photo upload error:', error);
      setMessage({ type: 'error', text: 'Failed to upload photo' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setMessage({ type: '', text: '' });
  };

  const handleSaveProfile = async () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Name cannot be empty' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Update Firebase Auth profile
      await updateProfile(auth.currentUser, {
        displayName: formData.name,
        photoURL: formData.photoURL
      });

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);
      
      // Reload the page after a short delay to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('Profile update error:', error);
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSetting = (setting) => {
    setSettings(prev => {
      const updated = { ...prev, [setting]: !prev[setting] };
      try {
        localStorage.setItem('aiii_user_settings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };
  // Keep settings in sync with localStorage if changed elsewhere
  React.useEffect(() => {
    const syncSettings = () => {
      try {
        const saved = localStorage.getItem('aiii_user_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings(s => ({ ...s, ...parsed }));
        }
      } catch {}
    };
    window.addEventListener('storage', syncSettings);
    return () => window.removeEventListener('storage', syncSettings);
  }, []);

  const getJoinDate = () => {
    const creationTime = auth.currentUser?.metadata?.creationTime;
    if (!creationTime) return 'Recently';
    
    const date = new Date(creationTime);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="profile-modal-header">
          <h2>My Profile</h2>
          <button className="modal-close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="profile-modal-content">
          {/* Messages */}
          {message.text && (
            <div className={`profile-message ${message.type}`}>
              {message.type === 'success' ? '✓' : '⚠'} {message.text}
            </div>
          )}

          {/* Profile Photo Section */}
          <div className="profile-photo-section">
            <div className="profile-photo-wrapper">
              <div className="profile-photo-large">
                {formData.photoURL ? (
                  <img src={formData.photoURL} alt={formData.name} />
                ) : (
                  formData.name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              {isEditing && (
                <button className="photo-upload-button" onClick={handlePhotoClick}>
                  <Camera size={18} />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="photo-upload-input"
              />
            </div>
            {isEditing && (
              <p className="photo-upload-label">Click camera icon to upload photo</p>
            )}
          </div>

          {/* Profile Form */}
          <div className="profile-form-section">
            <div className="profile-field">
              <label className="profile-field-label">
                <User size={16} />
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="profile-field-input"
                disabled={!isEditing}
                placeholder="Enter your name"
              />
            </div>

            <div className="profile-field">
              <label className="profile-field-label">
                <Mail size={16} />
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                className="profile-field-input"
                disabled
              />
            </div>

            <div className="profile-field">
              <label className="profile-field-label">
                <Calendar size={16} />
                Member Since
              </label>
              <input
                type="text"
                value={getJoinDate()}
                className="profile-field-input"
                disabled
              />
            </div>
          </div>

          {/* Stats */}
          <div className="profile-stats">
            <div className="stat-card">
              <p className="stat-value">{messageCount}</p>
              <p className="stat-label">Messages Sent</p>
            </div>
            <div className="stat-card">
              <p className="stat-value">{Math.floor(messageCount * 1.5)}</p>
              <p className="stat-label">AI Responses</p>
            </div>
          </div>

          {/* Settings Section */}
          <div className="profile-settings-section">
            <h3 className="settings-title">
              <Settings size={18} />
              Settings
            </h3>

            <div className="setting-item">
              <div className="setting-label">
                <p className="setting-label-text">
                  <Bell size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Notifications
                </p>
                <p className="setting-label-desc">Receive chat notifications</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={() => handleToggleSetting('notifications')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <p className="setting-label-text">
                  <Moon size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Dark Mode
                </p>
                <p className="setting-label-desc">Toggle dark theme (Coming soon)</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.darkMode}
                  onChange={() => handleToggleSetting('darkMode')}
                  disabled
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <p className="setting-label-text">
                  <MessageSquare size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Sound Effects
                </p>
                <p className="setting-label-desc">Play sounds for messages</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={() => handleToggleSetting('soundEnabled')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="profile-actions">
            {isEditing ? (
              <>
                <button
                  className="profile-button profile-button-secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: user?.name || '',
                      photoURL: user?.photoURL || ''
                    });
                    setMessage({ type: '', text: '' });
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="profile-button profile-button-primary"
                  onClick={handleSaveProfile}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="spinner-small"></div>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </>
            ) : (
              <button
                className="profile-button profile-button-primary"
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
