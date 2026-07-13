import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { NotificationProvider } from './ws/NotificationContext';

const queryClient = new QueryClient();

// Placeholders for Stage 8
const LoginPage = () => <div>Login Page</div>;
const RegisterPage = () => <div>Register Page</div>;
const Layout = ({ children }: { children: React.ReactNode }) => <div><nav>Sidebar</nav><main>{children}</main></div>;
const AvatarsPage = () => <div>Avatars Page</div>;
const WardrobePage = () => <div>Wardrobe Page</div>;
const OutfitBoardPage = () => <div>Outfit Board Page</div>;
const StylistPage = () => <div>Stylist Page</div>;
const GalleryPage = () => <div>Gallery Page</div>;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            <Route path="/avatars" element={<ProtectedRoute><AvatarsPage /></ProtectedRoute>} />
            <Route path="/wardrobe" element={<ProtectedRoute><WardrobePage /></ProtectedRoute>} />
            <Route path="/outfits" element={<ProtectedRoute><OutfitBoardPage /></ProtectedRoute>} />
            <Route path="/stylist" element={<ProtectedRoute><StylistPage /></ProtectedRoute>} />
            <Route path="/gallery" element={<ProtectedRoute><GalleryPage /></ProtectedRoute>} />
            
            <Route path="/" element={<Navigate to="/wardrobe" />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </QueryClientProvider>
  );
}

export default App;
