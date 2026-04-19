import { RoomState, Player } from '../types.js';
import { wordService } from './WordService.js';
import { Server } from 'socket.io';
import { prisma } from '../../lib/prisma.js';

export class GameService {
  private rooms: Map<string, RoomState> = new Map();
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  private async getOrCreatePlayer(username: string) {
    try {
      return await prisma.player.upsert({
        where: { username },
        update: {},
        create: { username },
      });
    } catch (e) {
      console.error("Prisma error:", e);
      return null;
    }
  }

  async createRoom(socketId: string, username: string, rounds = 5) {
    const playerDb = await this.getOrCreatePlayer(username);
    const roomId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const room: RoomState = {
      id: roomId,
      players: [{
        socketId,
        username,
        id: playerDb?.id,
        avatar: "😀"
      } as Player],
      targetWord: '',
      revealedWord: [],
      guesses: new Map(),
      scores: {},
      currentRound: 0,
      maxRounds: rounds,
      tickTimer: 5,
      status: 'lobby',
      roundEnded: false, // 🔥 NEW FLAG
    };
    this.rooms.set(roomId, room);
    return room;
  }

  async joinRoom(roomId: string, socketId: string, username: string, avatar?: string) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("Room not found");

    if (room.players.length >= 2 && !room.players.find(p => p.socketId === socketId)) {
      throw new Error("Room is full");
    }

    const playerDb = await this.getOrCreatePlayer(username);

    if (!room.players.find(p => p.socketId === socketId)) {
      room.players.push({
        socketId,
        username,
        id: playerDb?.id,
        avatar: avatar ?? "😀"
      } as Player);
    }

    return room;
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  async startRound(room: RoomState) {
    const word = wordService.getRandomWord();
    room.targetWord = word;
    room.revealedWord = new Array(word.length).fill('_');
    room.guesses.clear();
    room.tickTimer = 5;
    room.status = 'playing';
    room.roundEnded = false; // 🔥 reset round lock
    room.currentRound++; // 🔥 MOVE ROUND INCREMENT HERE (ONLY HERE)

    if (Object.keys(room.scores).length === 0) {
      room.players.forEach(p => room.scores[p.socketId] = 0);
    }

    // Persist Match if it's the first round
    if (room.currentRound === 1 && room.players.length === 2) {
      try {
        const match = await prisma.match.create({
          data: {
            player1Id: room.players[0].id!,
            player2Id: room.players[1].id!,
          }
        });
        (room as any).matchDbId = match.id;
      } catch (e) {
        console.error("Match persistence failed:", e);
      }
    }

    // Persist individual Round
    try {
      if ((room as any).matchDbId) {
        const round = await prisma.round.create({
          data: {
            matchId: (room as any).matchDbId,
            word: word,
          }
        });
        (room as any).currentRoundDbId = round.id;
      }
    } catch (e) {
      console.error("Round persistence failed:", e);
    }

    this.io.to(room.id).emit('roundStarted', {
      revealed: room.revealedWord,
      scores: room.scores,
      round: room.currentRound
    });

    this.startTick(room);
  }

  private startTick(room: RoomState) {
    if (room.status !== 'playing') return;

    room.tickTimer = 5;
    room.guesses.clear();

    const tickInterval = setInterval(() => {

      // 🔥 ADD THIS BLOCK (START)
      if (room.status !== 'playing' || room.roundEnded) {
        clearInterval(tickInterval);
        return;
      }
      // 🔥 ADD THIS BLOCK (END)

      room.tickTimer--;

      // ✅ Send authoritative server time to prevent client drift
      this.io.to(room.id).emit('tickUpdate', {
        timeLeft: room.tickTimer,
        serverTime: Date.now(), // ✅ clients can sync against this
        revealed: room.revealedWord
      });

      if (room.tickTimer <= 0) {
        clearInterval(tickInterval);
        this.processTick(room);
      }

    }, 1000);
  }

  private processTick(room: RoomState) {
    if (room.roundEnded || room.status !== 'playing') return;
    const correctGuesses: string[] = [];
    room.guesses.forEach((guess, socketId) => {
      if (guess.toUpperCase() === room.targetWord) {
        correctGuesses.push(socketId);
      }
    });

    if (correctGuesses.length === 1) {
      this.endRound(room, correctGuesses[0]);
    } else if (correctGuesses.length > 1) {
      // ✅ Draw — no points given to anyone
      this.endRound(room, undefined, true);
    } else {
      // No one correct, reveal a random letter
      this.revealRandomLetter(room);

      // Check if all revealed
      if (!room.revealedWord.includes('_')) {
        this.endRound(room);
      } else {
        this.startTick(room);
      }
    }
  }

  private revealRandomLetter(room: RoomState) {
    // ✅ Each position treated separately — handles repeated letters correctly
    const hiddenIndices = room.revealedWord
      .map((char, index) => char === '_' ? index : -1)
      .filter(i => i !== -1);

    if (hiddenIndices.length > 0) {
      const idx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
      // ✅ Reveal ONLY this exact index position, not all same letters
      room.revealedWord[idx] = room.targetWord[idx];
    }
  }

  private async endRound(room: RoomState, winnerId?: string, isDraw = false) {

    // 🔥 HARD LOCK (prevents duplicate calls)
    if (room.roundEnded) return;
    room.roundEnded = true;

    room.status = 'roundEnd';
    if (winnerId) {
      room.scores[winnerId] += 1;
    }
    // Persist Round Winner
    if ((room as any).currentRoundDbId) {
      // ✅ DB failure → retry once, then keep score in memory and continue
      const winner = room.players.find(p => p.socketId === winnerId);
      const attemptDbWrite = async (retries = 2): Promise<void> => {
        try {
          await prisma.round.update({
            where: { id: (room as any).currentRoundDbId },
            data: { winnerId: winner?.id || null }
          });
        } catch (e) {
          if (retries > 0) {
            console.warn(`DB write failed, retrying... (${retries} left)`);
            await new Promise(res => setTimeout(res, 500));
            return attemptDbWrite(retries - 1);
          } else {
            console.error("DB write failed after retries. Score kept in memory:", room.scores);
            // ✅ Game continues normally with in-memory scores
          }
        }
      };
      await attemptDbWrite();
    }

    // 🔥 reveal full word before sending
    room.revealedWord = room.targetWord.split('');

    this.io.to(room.id).emit('roundEnded', {
      winner: winnerId,
      word: room.targetWord,
      revealed: room.revealedWord,
      scores: room.scores,
      isDraw
    });

    // Check match end (Best of 5)
    // ✅ After last round → decide winner properly
    if (room.currentRound === room.maxRounds) {

      const scores = room.scores;
      const values = Object.values(scores);
      const maxScore = Math.max(...values);

      const winners = Object.keys(scores).filter(id => scores[id] === maxScore);

      // ✅ tie or single winner
      const finalWinner = winners[0]; // (you can improve later for draw UI)

      this.endMatch(room, finalWinner);

    } else {
      setTimeout(() => this.startRound(room), 5000);
    }
  }

  private async endMatch(room: RoomState, winnerId: string) {
    room.status = 'matchEnd';
    room.winner = winnerId;

    // Persist final scores
    if ((room as any).matchDbId) {
      try {
        const p1Id = room.players[0].socketId;
        const p2Id = room.players[1].socketId;
        await prisma.match.update({
          where: { id: (room as any).matchDbId },
          data: {
            score1: room.scores[p1Id],
            score2: room.scores[p2Id],
          }
        });

        // Update winner's win count
        const winner = room.players.find(p => p.socketId === winnerId);
        if (winner?.id) {
          await prisma.player.update({
            where: { id: winner.id },
            data: { wins: { increment: 1 } }
          });
        }
      } catch (e) {
        console.error("Failed to persist match end:", e);
      }
    }

    this.io.to(room.id).emit('matchEnded', { winner: winnerId });
    // Cleanup room after delay
    setTimeout(() => this.rooms.delete(room.id), 60000);
  }

  async submitGuess(roomId: string, socketId: string, guessText: string) {
    const room = this.rooms.get(roomId);
    if (room && room.status === 'playing') {
      const player = room.players.find(p => p.socketId === socketId);

      // ✅ Block multiple guesses per tick — accept only first guess
      if (room.guesses.has(socketId)) {
        this.io.to(socketId).emit('error', { message: 'You already guessed this tick.' });
        return;
      }

      room.guesses.set(socketId, guessText);
      // ✅ Reject late submission if tick already expired
      if (room.tickTimer <= 0) {
        this.io.to(socketId).emit('error', { message: 'Late submission — tick already expired.' });
        return;
      }

      if (
        guessText.toUpperCase() === room.targetWord.toUpperCase() &&
        room.status === 'playing' &&
        !room.roundEnded
      ) {
        this.endRound(room, socketId);
      }

      // Persist Guess to DB
      if ((room as any).currentRoundDbId && player?.id) {
        try {
          await prisma.guess.create({
            data: {
              playerId: player.id,
              roundId: (room as any).currentRoundDbId,
              guessText: guessText,
              isCorrect: guessText.toUpperCase() === room.targetWord.toUpperCase()
            }
          });
        } catch (e) {
          console.error("Failed to persist guess:", e);
        }
      }
    }
  }

  async leaveRoom(socketId: string) {
    for (const [roomId, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.socketId === socketId);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        if (room.players.length === 0) {
          this.rooms.delete(roomId);
        } else if (room.status === 'playing') {
          // ✅ Grace period before forfeit win
          this.io.to(room.id).emit('playerLeft', { message: 'Opponent disconnected. Waiting 5 seconds...' });
          setTimeout(async () => {
            const currentRoom = this.rooms.get(roomId);
            if (currentRoom && currentRoom.players.length === 1) {
              await this.endMatch(currentRoom, currentRoom.players[0].socketId);
            }
          }, 5000);
        }
      }
    }
  }
}
