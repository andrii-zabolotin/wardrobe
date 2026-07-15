import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
interface NotificationContextType {
  lastEvent: any | null;
}

const NotificationContext = createContext<NotificationContextType>({ lastEvent: null });

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastEvent, setLastEvent] = useState<any | null>(null);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!token) return;

    // NOTE: Pass JWT token via query parameter since standard browser WebSocket client APIs
    // do not support custom request headers (like Authorization: Bearer).
    const wsUrl = `ws://${window.location.host}/ws/notifications?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastEvent(data);
      } catch (e) {
        console.error('Failed to parse WS message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [token]);

  return (
    <NotificationContext.Provider value={{ lastEvent }}>
      {children}
    </NotificationContext.Provider>
  );
};
