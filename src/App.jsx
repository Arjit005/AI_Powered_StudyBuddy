import React, { useState, useEffect, useRef } from 'react';
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
import { apiRequest } from './config/apiClient';

// Helper to check JWT format and valid expiration
const isTokenValid = (token) => {
  if (!token || typeof token !== 'string') return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payloadJson = JSON.parse(atob(b64));
    // Must have a valid future expiration
    if (!payloadJson.exp || typeof payloadJson.exp !== 'number' || payloadJson.exp * 1000 <= Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

// Protected Route Component checking token presence, structure, and server verification (Fails Closed)
const ProtectedRoute = ({ children }) => {
  const [currentToken, setCurrentToken] = useState(() => localStorage.getItem('auth_token'));
  const [failedToken, setFailedToken] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const verificationGenRef = useRef(0);
  const [authStatus, setAuthStatus] = useState(() => {
    if (!currentToken || !isTokenValid(currentToken)) return 'unauthorized';
    return 'checking';
  });
  const [networkError, setNetworkError] = useState(false);

  useEffect(() => {
    const handleAuthChange = () => {
      const freshToken = localStorage.getItem('auth_token');
      verificationGenRef.current += 1;
      setFailedToken(freshToken && !isTokenValid(freshToken) ? freshToken : null);
      setAuthStatus(freshToken && isTokenValid(freshToken) ? 'checking' : 'unauthorized');
      setNetworkError(false);
      setCurrentToken(freshToken);
    };
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const thisGen = ++verificationGenRef.current;
    const abortCtrl = new AbortController();

    if (!currentToken || !isTokenValid(currentToken)) {
      return;
    }
    // Cryptographic validation against server session endpoint
    apiRequest('/api/auth/me', {
      auth: 'required',
      signal: abortCtrl.signal,
    })
      .then(data => {
        if (!isMounted || thisGen !== verificationGenRef.current) return;
        if (data && (data.id || data.email || data.username)) {
          setAuthStatus('authorized');
          setFailedToken(null);
        } else {
          setFailedToken(currentToken);
          setAuthStatus('unauthorized');
        }
      })
      .catch((err) => {
        if (err.kind === 'aborted' || thisGen !== verificationGenRef.current) return;
        if (isMounted) {
          if (err.status === 401 || err.status === 403) {
            setFailedToken(currentToken);
            setAuthStatus('unauthorized');
          } else {
            setNetworkError(true);
          }
        }
      });

    return () => {
      isMounted = false;
      abortCtrl.abort();
    };
  }, [currentToken, retryCount]);

  // Clean up credentials inside an effect when unauthorized, strictly when verification confirmed this token failed
  useEffect(() => {
    if (authStatus === 'unauthorized' && failedToken) {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken === failedToken) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
      }
    }
  }, [authStatus, failedToken]);

  if (networkError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="p-6 rounded-2xl glass-panel max-w-sm border border-white/10 space-y-3">
          <div className="text-amber-400 font-bold text-base">Connection Interrupted</div>
          <p className="text-slate-400 text-xs">Unable to verify session with server. Please check your connection and try again.</p>
          <button 
            onClick={() => {
                const freshToken = localStorage.getItem('auth_token');
              setRetryCount(c => c + 1);
                setFailedToken(freshToken && !isTokenValid(freshToken) ? freshToken : null);
                setAuthStatus(freshToken && isTokenValid(freshToken) ? 'checking' : 'unauthorized');
                setNetworkError(false);
                setCurrentToken(freshToken);
            }} 
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authStatus === 'unauthorized') {
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
