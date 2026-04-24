# Firebase Authentication Setup Guide

## Overview
Firebase Authentication has been integrated into the Concept Graph AI application with signup/login functionality and user session management.

## Installation
Firebase SDK is already installed. Check `package.json` for the `firebase` dependency.

## Configuration

### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a new project"
3. Fill in the project details
4. Enable Firebase Authentication

### 2. Enable Authentication Methods
1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Email/Password** provider

### 3. Get Firebase Credentials
1. Go to **Project Settings** (gear icon)
2. Scroll to **Your apps** section
3. Click "Web" if you don't have a web app registered
4. Copy the configuration

### 4. Update `.env` File
Create or update `.env` file in the project root with your Firebase credentials:

```env
REACT_APP_API_URL=http://localhost:5000/api

# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

### 5. Restart the Application
After updating `.env`, restart the React dev server:
```bash
npm start
```

## Features Implemented

### Authentication Flow
- **Signup**: Create new account with email, password, and display name
- **Login**: Sign in with email and password
- **Logout**: Sign out from user menu
- **Session Management**: User session persisted in `localStorage`

### Components Created

1. **`src/config/firebase.js`**
   - Firebase initialization
   - Authentication service setup

2. **`src/context/AuthContext.js`**
   - Authentication context provider
   - User state management
   - Session storage

3. **`src/pages/LoginPage.jsx`**
   - Login form with validation
   - Error handling
   - Link to signup

4. **`src/pages/SignupPage.jsx`**
   - Signup form with validation
   - Password confirmation
   - Display name input
   - Link to login

5. **`src/components/ProtectedRoute.jsx`**
   - Route protection middleware
   - Redirects unauthenticated users to login

6. **`src/components/UserMenu.jsx`**
   - User profile display
   - Dropdown menu with options
   - Logout functionality

### Updated Files

1. **`src/App.js`**
   - Wrapped with AuthProvider
   - Added protected routes
   - Handle loading state

2. **Navigation Components**
   - HomePage.jsx - Added UserMenu
   - ConceptGraphPage.jsx - Added UserMenu  
   - DashboardPage.jsx - Added UserMenu

## User Flows

### First Time User (Signup)
1. User lands on `/login`
2. Clicks "Create one" link → goes to `/signup`
3. Fills in name, email, password
4. Clicks "Create Account"
5. Account created in Firebase
6. Redirected to `/dashboard`
7. Session stored in localStorage

### Returning User (Login)
1. User lands on `/login`
2. Enters email and password
3. Clicks "Sign In"
4. FirebaseAuth verifies credentials
5. Redirected to `/dashboard`
6. Session stored in localStorage

### Session Persistence
- User session automatically loaded from `localStorage` on app start
- User remains logged in across browser sessions (until logout)
- Auth state monitored via `onAuthStateChanged` listener

### Logout
1. User clicks on avatar in top-right
2. Opens dropdown menu
3. Clicks "Logout"
4. Firebase signs out user
5. localStorage cleared
6. Redirected to `/login`

## Protected Routes

The following routes are now protected and require authentication:
- `/` (Home)
- `/concept-graph` (Learning)
- `/dashboard` (Dashboard)

Public routes:
- `/login`
- `/signup`

## Error Handling

Firebase error codes are converted to user-friendly messages:
- **Email already in use**: "Email already in use. Please login or use a different email."
- **Weak password**: "Password should be at least 6 characters."
- **Invalid email**: "Invalid email address."
- **User not found**: "User not found. Please sign up first."
- **Wrong password**: "Incorrect password."
- **Too many requests**: "Too many failed login attempts. Try again later."

## Security Features

1. **Client-side validation**: Form validation before submission
2. **Firebase Security**: Google's managed authentication service
3. **Session storage**: Session persisted in localStorage (encrypted by browser)
4. **Protected routes**: Routes require authentication
5. **Auto-logout**: Automatic logout if session expires (Firebase managed)

## Testing

### Signup Test
1. Go to `http://localhost:3000/signup`
2. Enter: Name = "Test User", Email = "test@example.com", Password = "password123"
3. Click "Create Account"
4. Should redirect to dashboard

### Login Test
1. Go to `http://localhost:3000/login`
2. Enter: Email = "test@example.com", Password = "password123"
3. Click "Sign In"
4. Should redirect to dashboard

### Logout Test
1. Click user avatar in top-right
2. Click "Logout"
3. Should redirect to login page

## Troubleshooting

### Firebase Configuration Error
- Ensure all Firebase credentials are correctly entered in `.env`
- Restart React dev server after updating `.env`
- Check Firebase Console for typos

### Authentication Not Working
- Verify Email/Password is enabled in Firebase Console
- Check browser console for error messages
- Ensure Firebase project is active and not deleted

### Session Not Persisting
- Check browser localStorage is enabled
- Verify AuthContext is wrapping the entire app in App.js

## Next Steps

1. **Email Verification**: Implement email verification on signup
2. **Password Reset**: Add "Forgot Password" functionality
3. **Social Login**: Add Google/GitHub sign-in options
4. **User Profile**: Create user profile management page
5. **Database Integration**: Store user data in Firestore
