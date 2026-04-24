// --- TILE DEFINITIONS --------------------------------------------------------
export type TileCategory = {
  label: string;
  color: string;
  bg: string;
  accent: string;
  tiles: string[];
};

export type TileCategoryKey =
  | 'open_vowel' | 'closed_vowel' | 'double_vowel' | 'r_vowel'
  | 'main_consonants' | 'specials' | 'others';

export type Tile = {
  id: number;
  text: string;
  display: string;
  variants: string[] | null;
  activeVariant: number;
  category: TileCategoryKey;
};

export const TILE_CATEGORIES: Record<TileCategoryKey, TileCategory> = {
  open_vowel: {
    label: "Open Vowel",
    color: "#E84855",
    bg: "#1a0608",
    accent: "#ff6b78",
    tiles: ["a", "e", "i", "o", "u"],
  },
  closed_vowel: {
    label: "Closed Vowel",
    color: "#F4A261",
    bg: "#1a0e04",
    accent: "#ffbe85",
    tiles: ["a", "a", "e", "e", "i", "i", "o", "o", "u", "u"],
  },
  double_vowel: {
    label: "Double Vowel",
    color: "#2EC4B6",
    bg: "#041514",
    accent: "#5de8e0",
    tiles: [
      "ai/ay","ea","ia","oa","ui/ue","au/aw","ei/ey","ie","oo","ou/ow","ee","eu/ew",
      "oi/oy","ai/ay","ea","oa","au/aw","ie","oo","ou/ow","ee","oi/oy",
    ],
  },
  r_vowel: {
    label: "R-Vowel",
    color: "#CBF3F0",
    bg: "#071414",
    accent: "#a0f5f0",
    tiles: [
      "ar","er","ir","or","ur","air","eer","ier","oor","eur",
      "ar","er","ir","ur","oar","ore",
    ],
  },
  main_consonants: {
    label: "Consonants",
    color: "#FFBF69",
    bg: "#1a1004",
    accent: "#ffd699",
    tiles: [
      "b","p","m","f","d","t","n","l","g","ck","h/wh","j","tch","sh","th","s",
      "b","p","m","f","d","t","n","l","ck","h/wh","j","tch","sh","s","t",
    ],
  },
  specials: {
    label: "Specials",
    color: "#C77DFF",
    bg: "#120a1a",
    accent: "#e4acff",
    tiles: [
      "suffix","-tion","-ing","-ed","-ly","-ness","-ment","pre-","un-","re-",
      "-ful","-less","mis-","dis-",
    ],
  },
  others: {
    label: "Others",
    color: "#9EF01A",
    bg: "#0d1400",
    accent: "#c8ff5a",
    tiles: [
      "y","ph","r","al","ng","ge","qu","cy","c","ol","w/wh","v","x","z",
      "dr","nk","e","gu","tr","y","r","w",
    ],
  },
};

// For dual tiles like "ei/ey", extract both variants
export function parseTile(text: string, cat: TileCategoryKey, id: number): Tile {
  if (text.includes("/")) {
    const variants = text.split("/");
    return { id, text, display: text, variants, activeVariant: 0, category: cat };
  }
  return { id, text, display: text, variants: null, activeVariant: 0, category: cat };
}

// Build the full 108-tile deck
export function buildDeck(): Tile[] {
  const deck: Tile[] = [];
  let id = 0;
  Object.entries(TILE_CATEGORIES).forEach(([cat, data]) => {
    data.tiles.forEach((text) => {
      deck.push(parseTile(text, cat as TileCategoryKey, id++));
    });
  });
  return deck;
}

// Get the active sound of a tile (respects chosen variant for dual tiles)
export function getTileSound(tile: Tile): string {
  if (tile.variants) return tile.variants[tile.activeVariant];
  return tile.text.replace(/-/g, "");
}

// Global tile ID counter - always increases, guarantees uniqueness across recycled decks
export let _globalTileId = 10000;
export function freshTileId(): number { return _globalTileId++; }

// Fisher-Yates shuffle
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
