import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import VideoPage from "./pages/VideoPage";
import ChannelPage from "./pages/ChannelPage";
import WatchHistoryPage from "./pages/WatchHistoryPage";

// Guard — redirect to /login if unauthenticated
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F12] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2A2A32] border-t-[#3B82F6] rounded-full animate-spin" />
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <WatchHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/video/:videoId"
        element={
          <ProtectedRoute>
            <VideoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/channel/:channelId"
        element={
          <ProtectedRoute>
            <ChannelPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;