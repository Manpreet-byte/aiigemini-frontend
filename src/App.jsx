import { useState, useEffect } from 'react'
import AIChat from './AIChat'
import AuthPage from './AuthPage'
import './App.css'
import { auth } from './firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check for existing authentication state on app load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({
          email: currentUser.email,
          name: currentUser.displayName || currentUser.email.split('@')[0],
          uid: currentUser.uid,
          photoURL: currentUser.photoURL
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    // Cleanup subscription on unmount
    return () => unsubscribe()
  }, [])

  const handleAuthSuccess = (userData) => {
    setUser(userData)
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setUser(null)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '1.5rem',
        fontWeight: '600'
      }}>
        Loading...
      </div>
    )
  }

  return (
    <>
      {user ? (
        <AIChat user={user} onLogout={handleLogout} />
      ) : (
        <AuthPage onAuthSuccess={handleAuthSuccess} />
      )}
    </>
  )
}

export default App
