import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";

let globalSocket: Socket | null = null;

export function useSocket(): Socket | null {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    if (!globalSocket || !globalSocket.connected) {
      globalSocket = io(window.location.origin, {
        path: `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/socket.io`,
        auth: { token },
        transports: ["websocket", "polling"],
      });
    }

    socketRef.current = globalSocket;

    return () => {
      /* Ne pas déconnecter le socket global à l'unmount des composants */
    };
  }, [token]);

  return socketRef.current;
}
