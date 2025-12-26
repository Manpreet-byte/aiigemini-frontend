import React, { useState } from 'react';
import { Bot, Mail, Lock, User as UserIcon, AlertCircle, CheckCircle } from 'lucide-react';
import './Auth.css';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';

const AuthPage = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isFirebaseConfigured) {
      setError('App not configured: set VITE_FIREBASE_* values in .env and add localhost:5174 to Firebase Authorized Domains.');
      return;
    }

    // Basic validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }

    if (!isLogin) {
      if (!formData.name) {
        setError('Please enter your name');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        // Login with Firebase
        const userCredential = await signInWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        
        setSuccess('Login successful!');
        
        setTimeout(() => {
          onAuthSuccess({
            email: userCredential.user.email,
            name: userCredential.user.displayName || userCredential.user.email.split('@')[0],
            uid: userCredential.user.uid
          });
        }, 1000);
        
      } else {
        // Sign up with Firebase
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        
        // Update profile with name
        await updateProfile(userCredential.user, {
          displayName: formData.name
        });
        
        setSuccess('Account created successfully!');
        
        setTimeout(() => {
          onAuthSuccess({
            email: userCredential.user.email,
            name: formData.name,
            uid: userCredential.user.uid
          });
        }, 1000);
      }
      
    } catch (err) {
      console.error('Authentication error:', err);
      
      // Handle specific Firebase errors
      let errorMessage = 'An error occurred. Please try again.';
      
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please login instead.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    if (!isFirebaseConfigured) {
      setLoading(false);
      setError('App not configured: set VITE_FIREBASE_* values in .env and enable Google provider in Firebase Console.');
      return;
    }

    try {
      // Sign in with Google using Firebase
      const result = await signInWithPopup(auth, googleProvider);
      
      setSuccess('Google sign-in successful!');
      
      setTimeout(() => {
        onAuthSuccess({
          email: result.user.email,
          name: result.user.displayName || result.user.email.split('@')[0],
          uid: result.user.uid,
          photoURL: result.user.photoURL
        });
      }, 1000);
      
    } catch (err) {
      console.error('Google sign-in error:', err);
      
      let errorMessage = 'Google sign-in failed. Please try again.';
      
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in cancelled. Please try again.';
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = 'Popup blocked. Please allow popups for this site.';
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo">
            <Bot size={40} color="white" />
          </div>
          <h1>Welcome to Gemini Chat</h1>
          <p>Your AI-powered conversation assistant</p>
        </div>

        {/* Config Warning */}
        {!isFirebaseConfigured && (
          <div className="error-message" style={{ marginTop: '0.5rem' }}>
            <AlertCircle size={18} />
            Firebase is not configured. Add VITE_FIREBASE_* values in .env and authorize domains.
          </div>
        )}

        {/* Toggle Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(true);
              setError('');
              setSuccess('');
            }}
          >
            Login
          </button>
          <button
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(false);
              setError('');
              setSuccess('');
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="error-message">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            <CheckCircle size={18} />
            {success}
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                name="name"
                className="form-input"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              className="form-input"
              placeholder={isLogin ? "Enter your password" : "Create a password (min. 6 characters)"}
              value={formData.password}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                className="form-input"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
          )}

          {isLogin && (
            <div className="forgot-password">
              <a href="#forgot">Forgot password?</a>
            </div>
          )}

          <button
            type="submit"
            className="auth-button auth-button-primary"
            disabled={loading || !isFirebaseConfigured}
          >
            {loading ? (
              <>
                <div className="spinner-small"></div>
                {isLogin ? 'Logging in...' : 'Creating account...'}
              </>
            ) : (
              isLogin ? 'Login' : 'Create Account'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span>OR</span>
        </div>

        {/* Google Sign In */}
        <button
          className="auth-button google-button"
          onClick={handleGoogleSignIn}
          disabled={loading || !isFirebaseConfigured}
        >
          <svg className="google-icon" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Footer */}
        <div className="auth-footer">
          {isLogin ? (
            <p>
              Don't have an account?{' '}
              <a href="#signup" onClick={(e) => { e.preventDefault(); setIsLogin(false); }}>
                Sign up
              </a>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <a href="#login" onClick={(e) => { e.preventDefault(); setIsLogin(true); }}>
                Login
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
