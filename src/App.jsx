import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Layout from './components/Layout';
import CommandPalette from './components/CommandPalette';

import Home from './pages/Home';
import Chat from './pages/Chat';
import CanvasStudio from './pages/CanvasStudio';
import Library from './pages/Library';
import Summarize from './pages/Summarize';
import Quiz from './pages/Quiz';
import Flashcards from './pages/Flashcards';
import Progress from './pages/Progress';
import Timer from './pages/Timer';
import Voice from './pages/Voice';
import Maps from './pages/Maps';
import Sources from './pages/Sources';
import Pricing from './pages/Pricing';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

// Helper to check JWT format and expiration
const isTokenValid = (token) => {
  if (!token || typeof token !== 'string') return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payloadJson = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payloadJson.exp && payloadJson.exp * 1000 < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

// Protected Route Component checking token presence, structure, and server verification
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('auth_token');
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true' && isTokenValid(token);
  });

  useEffect(() => {
    let isMounted = true;
    if (!token || !isTokenValid(token)) {
      setIsAuthorized(false);
      return;
    }

    // Cryptographic validation against server session endpoint
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!isMounted) return;
        if (res.ok) {
          setIsAuthorized(true);
        } else {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('user');
          setIsAuthorized(false);
        }
      })
      .catch(() => {
        // In transient offline states, retain local optimistic verification
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (!isAuthorized) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setPaletteOpen(true);
    window.addEventListener('study-buddy:open-palette', handleOpen);
    return () => window.removeEventListener('study-buddy:open-palette', handleOpen);
  }, []);

  return (
    <Router>
      <Layout>
        {/* Global Command Palette */}
        <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />

        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={
            <>
              <Header />
              <Home />
            </>
          } />

          {/* Protected Routes */}
          <Route path="/chat" element={
            <ProtectedRoute>
              <>
                <Header />
                <Chat />
              </>
            </ProtectedRoute>
          } />
          <Route path="/canvas" element={
            <ProtectedRoute>
              <>
                <Header />
                <CanvasStudio />
              </>
            </ProtectedRoute>
          } />
          <Route path="/library" element={
            <ProtectedRoute>
              <>
                <Header />
                <Library />
              </>
            </ProtectedRoute>
          } />
          <Route path="/sources" element={
            <ProtectedRoute>
              <>
                <Header />
                <Sources />
              </>
            </ProtectedRoute>
          } />
          <Route path="/summarize" element={
            <ProtectedRoute>
              <>
                <Header />
                <Summarize />
              </>
            </ProtectedRoute>
          } />
          <Route path="/quiz" element={
            <ProtectedRoute>
              <>
                <Header />
                <Quiz />
              </>
            </ProtectedRoute>
          } />
          <Route path="/flashcards" element={
            <ProtectedRoute>
              <>
                <Header />
                <Flashcards />
              </>
            </ProtectedRoute>
          } />
          <Route path="/timer" element={
            <ProtectedRoute>
              <>
                <Header />
                <Timer />
              </>
            </ProtectedRoute>
          } />
          <Route path="/progress" element={
            <ProtectedRoute>
              <>
                <Header />
                <Progress />
              </>
            </ProtectedRoute>
          } />
          <Route path="/voice" element={
            <ProtectedRoute>
              <>
                <Header />
                <Voice />
              </>
            </ProtectedRoute>
          } />
          <Route path="/maps" element={
            <ProtectedRoute>
              <>
                <Header />
                <Maps />
              </>
            </ProtectedRoute>
          } />
          <Route path="/pricing" element={
            <ProtectedRoute>
              <>
                <Header />
                <Pricing />
              </>
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
