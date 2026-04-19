import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL!;
    socket = io(url, {
      autoConnect: false,
      transports: ["websocket"], // optional but good
    });
  }
  return socket;
};