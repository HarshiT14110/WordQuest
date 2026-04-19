"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { motion, AnimatePresence } from "motion/react";
import { Gamepad2, Plus, LogIn } from "lucide-react";
import { getSocket } from "@/lib/socket";

const EMOJIS = ["😀", "😎", "🤖", "👻", "🐱", "🐵", "🐸", "🦊", "👽", "👾"];
const FLOATING_EMOJIS = ["🎮", "✨", "🎲", "🎯", "🏆", "🔥", "⚡", "⭐"];

export default function Home() {
  const [username, setUsername] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [rounds, setRounds] = useState(5);
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJIS[0]);
  const router = useRouter();

  const handleCreateRoom = () => {
    if (!username) return alert("Please enter a username");
    if (isCreating) return;
    setIsCreating(true);

    sessionStorage.setItem("wordquest_username", username);
    sessionStorage.setItem("wordquest_avatar", selectedEmoji);
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    socket.emit("createRoom", { username, rounds });

    socket.once("roomCreated", (data: { roomId: string }) => {
      router.push(`/room/${data.roomId}`);
    });

    setTimeout(() => setIsCreating(false), 5000);
  };

  const handleJoinRoom = () => {
    if (!username) return alert("Please enter a username");
    if (!showJoinInput) {
      setShowJoinInput(true);
      return;
    }
    if (!joinRoomId) return alert("Enter Room ID");
    sessionStorage.setItem("wordquest_username", username);
    router.push(`/room/${joinRoomId.toUpperCase()}`);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#050510] text-white overflow-hidden font-sans">

      {/* 🔥 Animated Background Blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute w-[800px] h-[800px] bg-blue-600/20 blur-[150px] rounded-full top-[-20%] left-[-10%]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute w-[600px] h-[600px] bg-purple-600/20 blur-[150px] rounded-full bottom-[-10%] right-[-10%]"
        />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {FLOATING_EMOJIS.map((emoji, i) => (
          <motion.div
            key={i}
            initial={{
              opacity: 0,
              y: "120vh",
              x: `${(i * 15) + 5}vw`,
              rotate: 0
            }}
            animate={{
              opacity: [0, 0.3, 0],
              y: "-20vh",
              x: `${(i * 15) + (i % 2 === 0 ? 10 : -10)}vw`,
              rotate: 360
            }}
            transition={{
              duration: 15 + (i * 2),
              repeat: Infinity,
              delay: i * 2,
              ease: "linear"
            }}
            className="absolute text-4xl opacity-20 blur-[2px]"
          >
            {emoji}
          </motion.div>
        ))}
      </div>

      {/* 🔥 Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
        className="relative z-10 w-full max-w-lg rounded-[2.5rem] border border-white/10 bg-white/[0.02] backdrop-blur-3xl p-8 md:p-12 shadow-[0_0_80px_rgba(79,70,229,0.15)] text-center"
      >
        {/* Header */}
        <div className="mb-10">
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", bounce: 0.6 }}
            className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-[0_0_40px_rgba(147,51,234,0.5)]"
          >
            <Gamepad2 size={48} className="text-white drop-shadow-md" />
          </motion.div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 drop-shadow-sm">
            WordQuest
          </h1>
          <p className="text-slate-400 mt-3 font-medium text-lg tracking-wide uppercase">
            Multiplayer Word Battle
          </p>
        </div>

        <div className="space-y-8">

          {/* Avatar Selector */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Choose your avatar</label>
            <div className="flex flex-wrap justify-center gap-3">
              {EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.2, y: -5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`flex h-12 w-12 items-center justify-center text-2xl rounded-2xl transition-all duration-300 ${selectedEmoji === emoji
                    ? "bg-white/20 border-2 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-110"
                    : "bg-white/5 border border-white/5 hover:bg-white/10"
                    }`}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Username Input */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <Input
              placeholder="Enter your name..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="relative h-16 w-full text-center text-xl font-bold rounded-2xl bg-black/50 border border-white/10 placeholder:text-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all shadow-inner"
            />
          </div>

          <AnimatePresence mode="wait">
            {showJoinInput && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="relative group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
                <Input
                  placeholder="Paste Room ID..."
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                  className="relative h-16 w-full text-center text-xl font-bold rounded-2xl bg-black/50 border border-white/10 placeholder:text-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all shadow-inner uppercase tracking-widest mt-4"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buttons */}
          <div className="flex flex-col gap-4 pt-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <div className="mb-4">
                <label className="text-sm text-slate-400">Rounds: {rounds}</label>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <Button
                onClick={handleCreateRoom}
                className="relative group h-16 w-full text-xl font-black rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-[0_0_40px_rgba(79,70,229,0.4)] overflow-hidden border-none"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <span className="relative flex items-center justify-center gap-2 drop-shadow-md">
                  <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                  {isCreating ? "CREATING..." : "CREATE ROOM"}
                </span>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleJoinRoom}
                className="h-16 w-full text-xl font-bold rounded-2xl border-2 border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 backdrop-blur-md transition-all shadow-lg text-slate-300 hover:text-white"
              >
                <LogIn size={22} className="mr-3" />
                {showJoinInput ? "JOIN BATTLE" : "JOIN ROOM"}
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}