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

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  return isAuthenticated ? children : <Navigate to="/login" />;
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

          {/* Protected Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <>
                <Header />
                <Home />
              </>
            </ProtectedRoute>
          } />
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
