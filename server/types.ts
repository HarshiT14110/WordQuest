export interface Player {
  socketId: string;
  username: string;
  id?: number; // Database ID
}

export interface RoomState {
  id: string;
  players: Player[];
  avatar?: string;
  targetWord: string;
  revealedWord: string[];
  guesses: Map<string, string>; // socketId -> guess
  scores: Record<string, number>; // socketId -> score
  currentRound: number;
  maxRounds: number;
  tickTimer: number;
  status: 'lobby' | 'playing' | 'roundEnd' | 'matchEnd';
  winner?: string; // Winner of match
  roundEnded?: boolean; // 🔥 prevents duplicate endRound
}

export interface GameEvent {
  roomJoined: { roomId: string; players: Player[] };
  gameStarted: { word: string[]; scores: Record<string, number> };
  tickUpdate: { timeLeft: number; revealed: string[] };
  roundResult: { winner?: string; word: string; scores: Record<string, number> };
  matchResult: { winner: string };
}
