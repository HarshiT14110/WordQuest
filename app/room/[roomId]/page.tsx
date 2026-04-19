"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { motion, AnimatePresence } from "motion/react";
import {
  Users, Clock, Trophy, Send, Copy,
  Check, ArrowLeft, Loader2, Gamepad2,
  Sword, User as UserIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function RoomPage() {
  const { roomId } = useParams() as { roomId: string };
  const router = useRouter();

  const [username, setUsername] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<any>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [guess, setGuess] = useState("");
  const [message, setMessage] = useState("");
  const [hasGuessed, setHasGuessed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatar, setAvatar] = useState("😀");
  const [lastWinner, setLastWinner] = useState<string | null>(null);
  const [roundEndWord, setRoundEndWord] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const socketRef = useRef<any>(null);

  useEffect(() => {
    const storedUsername = sessionStorage.getItem("wordquest_username");
    const storedAvatar = sessionStorage.getItem("wordquest_avatar");

    if (storedAvatar) setAvatar(storedAvatar);

    if (!storedUsername) {
      router.push("/");
      return;
    }

    setUsername(storedUsername);

    socketRef.current = getSocket();
    const socket = socketRef.current;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("joinRoom", {
      roomId,
      username: storedUsername,
      avatar: storedAvatar || "😀"
    });

    socket.on("roomUpdated", (data: any) => {
      setRoomData(data);
    });

    socket.on("roundStarted", (data: any) => {
      setGameState((prev: any) => ({ ...prev, ...data, status: "playing" }));
      setHasGuessed(false);
      setGuess("");
      setMessage("");
    });

    let lastTime = -1;

    socket.on("tickUpdate", (data: any) => {
      // ✅ Use server's authoritative timeLeft to prevent drift
      setGameState((prev: any) => ({ ...prev, ...data, timeLeft: data.timeLeft }));

      if (data.timeLeft !== lastTime) {
        lastTime = data.timeLeft;

        if (!isMuted) {
          const audio = new Audio("/tick.mp3");
          audio.volume = 0.2;
          audio.play().catch(() => { });
        }
      }
    });

    socket.on("roundEnded", (data: any) => {
      setGameState((prev: any) => ({
        ...prev,          // 🔥 keep previous state
        ...data,          // 🔥 apply new data
        revealed: data.revealed, // 🔥 force full word
        status: "roundEnd"
      }));

      setLastWinner(data.winner);
      setRoundEndWord(data.word); // ✅ show the word popup

      if (data.winner === socketRef.current.id) {
        setMessage("✅ Correct! +1");
      } else {
        setMessage("❌ Wrong Guess");
      }

      setTimeout(() => {
        setMessage("");
        setLastWinner(null);
        setRoundEndWord(null); // ✅ hide popup after 5 seconds
      }, 5000); // ✅ changed from 2500 to 5000
    });

    socket.on("matchEnded", (data: any) => {
      setGameState((prev: any) => ({
        ...data,
        status: "matchEnd"
      }));
    });

    socket.on("error", (data: { message: string }) => {
      setError(data.message);
    });
    socket.on("playerLeft", (data: { message: string }) => {
      setError(data.message);
    });

    return () => {
      socket.off("roomUpdated");
      socket.off("roundStarted");
      socket.off("tickUpdate");
      socket.off("roundEnded");
      socket.off("matchEnded");
      socket.off("error");
      socket.off("playerLeft");

      // ❌ DO NOT DISCONNECT SOCKET
    };
  }, [roomId, router]);

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomData?.roomId || roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess || hasGuessed || gameState?.status !== "playing") return;
    socketRef.current.emit("submitGuess", { roomId: roomData.roomId, guess });
    setHasGuessed(true);
    setMessage(`Guess submitted: ${guess.toUpperCase()}`);
  };

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <h1 className="mb-4 text-4xl font-bold text-red-400">Error</h1>
        <p className="mb-8 text-slate-400">{error}</p>
        <Button onClick={() => router.push("/")}>Back to Home</Button>
      </div>
    );
  }

  if (!roomData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-500" />
          <p className="text-xl font-medium text-slate-400">Preparing your quest...</p>
        </div>
      </div>
    );
  }

  const isLobby = roomData.status === "lobby" && roomData.players.length < 2;
  const isMatchEnd = gameState?.status === "matchEnd";
  const winnerPlayer = roomData?.players?.find(
    (p: any) => p.socketId === gameState?.winner
  );
  const myScore = gameState?.scores?.[socketRef.current.id] || 0;
  const opponent = roomData.players.find((p: any) => p.socketId !== socketRef.current.id);
  const opponentScore = gameState?.scores?.[opponent?.socketId] || 0;

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* 📝 ROUND END WORD POPUP */}
      <AnimatePresence>
        {roundEndWord && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-white/10 backdrop-blur-xl border border-white/20 px-10 py-6 rounded-2xl text-center shadow-2xl"
          >
            <p className="text-slate-400 text-sm mb-2">The word was</p>
            <p className="text-4xl font-black text-blue-400 tracking-widest">
              {roundEndWord}
            </p>
            <p className="text-slate-400 text-xs mt-3">Next round in 5s...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎉 MATCH END POPUP */}
      {/* 🎉 MATCH END POPUP */}
      <AnimatePresence>
        {isMatchEnd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-white/10 backdrop-blur-xl border border-white/20 p-10 rounded-3xl text-center shadow-2xl"
            >
              <h1 className="text-4xl font-black text-green-400 mb-4">
                🎉 Congratulations!
              </h1>

              <p className="text-xl mb-6">
                Winner:{" "}
                <span className="font-bold text-blue-400">
                  {winnerPlayer?.avatar || "👤"} {winnerPlayer?.username}
                </span>
              </p>

              <Button
                onClick={() => router.push("/")}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500"
              >
                Go Home
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute w-[600px] h-[600px] bg-blue-500/20 blur-[140px] top-[-20%] left-[-20%]" />
        <div className="absolute w-[600px] h-[600px] bg-purple-500/20 blur-[140px] bottom-[-20%] right-[-20%]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto p-6">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Button
            onClick={() => setIsMuted(!isMuted)}
            className="ml-4 bg-white/10"
          >
            {isMuted ? "🔇" : "🔊"}
          </Button>
          <Button onClick={() => router.push("/")} variant="ghost">
            ← Exit
          </Button>

          <div className="text-sm bg-white/10 px-4 py-2 rounded-xl">
            Room: <span className="text-blue-400 font-bold">{roomId}</span>
          </div>
        </div>

        {/* Lobby */}
        {isLobby ? (
          <div className="text-center mt-32">
            <h2 className="text-5xl font-black mb-4">Waiting for Opponent</h2>
            <p className="text-slate-400">Share the Room ID to start</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_300px] gap-8">

            {/* Game */}
            <div>

              {/* Score */}
              {/* ⏱ Timer */}
              <div className="text-center mb-6">
                <div className="text-xs text-slate-400 mb-1">TIME LEFT</div>
                <div className={`text-3xl font-black ${(gameState?.timeLeft || 5) <= 2 ? "text-red-500 animate-pulse" : "text-white"
                  }`}>
                  {gameState?.timeLeft || 5}s
                </div>
              </div>
              <div className="flex justify-between mb-6 text-center">
                <div>
                  <div className="text-xs text-blue-400">YOU</div>
                  <div className="text-4xl font-bold">{myScore}</div>
                </div>

                <div>
                  <div className="text-xs text-red-400">OPPONENT</div>
                  <div className="text-4xl font-bold">{opponentScore}</div>
                </div>
              </div>


              {/* 🎯 Round Info */}
              <div className="text-center mb-4 text-slate-400 font-bold">
                Round {gameState?.round || 1}
              </div>
              {/* Word */}
              <div className="flex justify-center gap-4 mb-10">
                {(gameState?.revealed || []).map((c: string, i: number) => (
                  <motion.div
                    key={i}
                    className={`w-16 h-20 flex items-center justify-center text-3xl font-bold rounded-xl shadow-xl transition-all duration-300 ${c === "_"
                      ? "bg-white/10"
                      : "bg-gradient-to-br from-blue-600 to-purple-600 scale-110"
                      }`}
                  >
                    {c === "_" ? "" : c}
                  </motion.div>
                ))}
              </div>

              {/* Input */}
              <form onSubmit={handleGuess} className="flex gap-4">
                <Input
                  value={guess}
                  onChange={(e) => setGuess(e.target.value.toUpperCase())}
                  className="h-16 text-2xl bg-black/50 border border-white/10"
                />
                <Button
                  type="submit"
                  disabled={hasGuessed || gameState?.status !== "playing"}
                  className={`h-16 px-6 ${hasGuessed || gameState?.status !== "playing"
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500"
                    }`}
                >
                  Guess
                </Button>
              </form>
              {/* 💥 Points Animation */}
              {message && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1.2, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`text-3xl font-black mt-4 text-center ${message.includes("Correct") ? "text-green-400" : "text-red-400"
                    }`}
                >
                  {message}
                </motion.div>
              )}

            </div>

            {/* Sidebar */}
            <div className="bg-white/5 p-6 rounded-2xl">
              <h3 className="text-sm text-slate-400 mb-4">Players</h3>
              {roomData.players.map((p: any) => (
                <div key={p.socketId} className="mb-3">
                  <div className="flex justify-between items-center">

                    {/* LEFT: avatar + name */}
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {p.avatar || "👤"}
                      </span>

                      <span>{p.username}</span>

                      {p.socketId === socketRef.current.id && (
                        <span className="text-blue-400 text-xs">YOU</span>
                      )}
                    </div>

                    {/* RIGHT: score + +10 animation */}
                    <div className="flex items-center gap-2">
                      <span className="font-bold">
                        {gameState?.scores?.[p.socketId] || 0}
                      </span>

                      {lastWinner === p.socketId && (
                        <motion.span
                          initial={{ y: 10, opacity: 0 }}
                          animate={{ y: -10, opacity: 1 }}
                          className="text-green-400 text-sm font-bold"
                        >
                          +1
                        </motion.span>
                      )}
                    </div>

                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}