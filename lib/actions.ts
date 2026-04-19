"use server";

import { prisma } from "@/lib/prisma";

export async function getLeaderboard() {
  try {
    const topPlayers = await prisma.player.findMany({
      orderBy: {
        wins: "desc",
      },
      take: 5,
      select: {
        username: true,
        wins: true,
      },
    });
    return topPlayers;
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return [];
  }
}
