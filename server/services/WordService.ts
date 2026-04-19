export class WordService {
  private words: string[] = [
    "APPLE", "BANANA", "CHERRY", "DRAGON", "EAGLE", "FALCON", "GUITAR", "HAMMER", "ICEBERG", "JUNGLE",
    "KETTLE", "LEMON", "MAGNET", "NEST", "ORANGE", "PIANO", "QUARTZ", "ROCKET", "SILVER", "TIGER",
    "UMBRELLA", "VIOLET", "WHALE", "XYLOPHONE", "YACHT", "ZEBRA", "ABACUS", "BEACON", "CACTUS", "DESERT",
    "ENGINE", "FLOWER", "GEYSER", "HARBOR", "ISLAND", "JACKET", "KNIGHT", "LANTERN", "METEOR", "NEBULA",
    "OASIS", "PALACE", "QUIVER", "RADAR", "SPHERE", "TUNNEL", "UPGRADE", "VORTEX", "WIZARD", "ZENITH"
  ];

  constructor() {
    this.shuffle();
  }

  private shuffle() {
    for (let i = this.words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.words[i], this.words[j]] = [this.words[j], this.words[i]];
    }
  }

  getRandomWord(): string {
    if (this.words.length === 0) this.shuffle();
    return this.words.pop()!.toUpperCase();
  }
}

export const wordService = new WordService();
