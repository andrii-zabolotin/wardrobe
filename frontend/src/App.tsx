import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { NotificationProvider } from './ws/NotificationContext';
import { Layout } from './components/Layout/Layout';

const queryClient = new QueryClient();

import Login from './pages/Login';
import Register from './pages/Register';
import Avatars from './pages/Avatars';
import Wardrobe from './pages/Wardrobe';
import OutfitBoard from './pages/OutfitBoard';
import Stylist from './pages/Stylist';
import Gallery from './pages/Gallery';

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
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/avatars" element={<ProtectedRoute><Avatars /></ProtectedRoute>} />
            <Route path="/wardrobe" element={<ProtectedRoute><Wardrobe /></ProtectedRoute>} />
            <Route path="/outfits" element={<ProtectedRoute><OutfitBoard /></ProtectedRoute>} />
            <Route path="/stylist" element={<ProtectedRoute><Stylist /></ProtectedRoute>} />
            <Route path="/gallery" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
            
            <Route path="/" element={<Navigate to="/wardrobe" />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </QueryClientProvider>
  );
}

export default App;
