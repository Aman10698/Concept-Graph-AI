import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../config/firebase';

// Create Auth Context
const AuthContext = createContext(null);

/**
 * Auth Provider Context
 * Manages user authentication state and session
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Monitor auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // User is signed in
        const userData = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName || '',
          photoURL: currentUser.photoURL || '',
          createdAt: currentUser.metadata?.creationTime,
        };
        setUser(userData);
        // Store session in localStorage
        localStorage.setItem('authUser', JSON.stringify(userData));
      } else {
        // User is signed out
        setUser(null);
        localStorage.removeItem('authUser');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * Handle user signup
   */
  const signup = async (email, password, displayName) => {
    setError(null);
    try {
      // Create user account
      const result = await createUserWithEmailAndPassword(auth, email, password);

      // Update user profile with display name
      if (displayName) {
        await updateProfile(result.user, {
          displayName: displayName,
        });
      }

      return {
        success: true,
        user: result.user,
        message: 'Account created successfully!',
      };
    } catch (err) {
      const errorMessage = getAuthErrorMessage(err.code);
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  /**
   * Handle user login
   */
  const login = async (email, password) => {
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return {
        success: true,
        user: result.user,
        message: 'Logged in successfully!',
      };
    } catch (err) {
      const errorMessage = getAuthErrorMessage(err.code);
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  /**
   * Handle user logout
   */
  const logout = async () => {
    setError(null);
    try {
      await signOut(auth);
      setUser(null);
      return {
        success: true,
        message: 'Logged out successfully!',
      };
    } catch (err) {
      const errorMessage = 'Failed to logout';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  /**
   * Check if user is authenticated
   */
  const isAuthenticated = user !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signup,
        login,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use Auth Context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Convert Firebase error codes to user-friendly messages
 */
const getAuthErrorMessage = (errorCode) => {
  const errorMessages = {
    'auth/email-already-in-use': 'Email already in use. Please login or use a different email.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-not-found': 'User not found. Please sign up first.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/too-many-requests': 'Too many failed login attempts. Try again later.',
    'auth/account-exists-with-different-credential': 'Email already associated with another account.',
    'auth/operation-not-allowed': 'This operation is not allowed.',
    'auth/invalid-credential': 'Invalid credentials. Please try again.',
  };

  return errorMessages[errorCode] || 'An authentication error occurred. Please try again.';
};

export default AuthContext;
