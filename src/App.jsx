import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Layout from './components/Layout';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Summarize from './pages/Summarize';
import Quiz from './pages/Quiz';
import Flashcards from './pages/Flashcards';
import Progress from './pages/Progress';
import Timer from './pages/Timer';
import Voice from './pages/Voice';
import Maps from './pages/Maps';
import Pricing from './pages/Pricing';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Layout>
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
