import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { Server } from 'socket.io';
import * as dotenv from 'dotenv';
import { GameService } from './server/services/GameService.js';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '8080'); // ✅ Render sets PORT automatically

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Initialize Socket.IO
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const gameService = new GameService(io);

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('createRoom', async ({ username, rounds }) => {
      try {
        console.log("Creating room for:", username);

        const room = await gameService.createRoom(socket.id, username, rounds);

        if (!room) {
          socket.emit('error', { message: "Room creation failed" });
          return;
        }

        // ✅ join socket to room
        socket.join(room.id);

        console.log("Room created:", room.id);

        // ✅ emit to creator ONLY
        socket.emit('roomCreated', { roomId: room.id });

        // ✅ emit room state
        io.to(room.id).emit('roomUpdated', {
          roomId: room.id,
          players: room.players,
          status: room.status
        });

      } catch (err) {
        console.error("Create room error:", err);
        socket.emit('error', { message: "Failed to create room" });
      }
    });

    socket.on('joinRoom', async ({ roomId, username, avatar }) => {
      try {
        console.log("Join attempt:", roomId, username);

        const room = await gameService.joinRoom(roomId, socket.id, username, avatar);

        if (!room) {
          socket.emit('error', { message: "Room not found" });
          return;
        }

        socket.join(room.id);

        console.log("Joined room:", room.id);

        io.to(room.id).emit('roomUpdated', {
          roomId: room.id,
          players: room.players,
          status: room.status
        });

        // ✅ start game when 2 players
        if (room.players.length === 2 && room.status === 'lobby') {
          console.log("Starting game...");
          await gameService.startRound(room);
        }

      } catch (e: any) {
        console.error("Join room error:", e.message);
        socket.emit('error', { message: e.message });
      }
    });

    socket.on('submitGuess', async ({ roomId, guess }) => {
      await gameService.submitGuess(roomId, socket.id, guess);
    });

    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);

      await gameService.leaveRoom(socket.id);

      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.to(room).emit("playerLeft", {
            message: "Opponent left the game. You can exit."
          });
        }
      }
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
