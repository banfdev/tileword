// --- TILE THEMES --------------------------------------------------------------
import type { TileCategory } from '../data/tiles';
import type { TileThemeKey } from '../data/settings';

export type TileTheme = {
  label: string;
  emoji: string;
  desc: string;
  preview: string[];
  pageBg: string;
  pageText: string;
  pageBgImage: boolean;
  tileBg: (cat: TileCategory, selected: boolean) => string;
  tileBorder: (cat: TileCategory, selected: boolean) => string;
  tileText: (cat: TileCategory, selected: boolean) => string;
  tileShadow: (cat: TileCategory, selected: boolean, highlighted: boolean) => string;
  labelColor: (cat: TileCategory) => string;
  cardBg: string;
  cardBorder: string;
  headerBg: string;
  headerBorder: string;
};

export const TILE_THEMES: Record<TileThemeKey, TileTheme> = {
  neon: {
    label: "Neon",
    emoji: "🌙",
    desc: "Dark background with glowing neon tiles",
    preview: ["#E84855","#2EC4B6","#FFBF69","#C77DFF","#9EF01A"],
    pageBg: "#0d0d14",
    pageText: "#e0e0f0",
    pageBgImage: true,
    tileBg: (cat, selected) => selected
      ? `linear-gradient(145deg, ${cat.color}33, ${cat.color}18)`
      : `linear-gradient(145deg, #1e1e2e, #16161f)`,
    tileBorder: (cat, selected) => selected
      ? `2.5px solid ${cat.accent}`
      : `1.5px solid ${cat.color}44`,
    tileText: (cat, selected) => selected ? cat.accent : cat.color,
    tileShadow: (cat, selected, highlighted) => selected
      ? `0 8px 24px ${cat.color}55, 0 0 0 1px ${cat.color}44`
      : highlighted
      ? `0 0 0 2px #f0c06088, 0 0 16px 4px #f0c06044, 0 3px 8px #00000088`
      : `0 3px 8px #00000088, inset 0 1px 0 #ffffff0a`,
    labelColor: (cat) => cat.color,
    cardBg: "#ffffff06",
    cardBorder: "#ffffff10",
    headerBg: "#0d0d1499",
    headerBorder: "#ffffff0f",
  },
  mahjong: {
    label: "Mahjong",
    emoji: "🀄",
    desc: "Classic ivory tiles on green felt",
    preview: ["#c8401a","#1a6b3a","#b8860b","#1a4276","#2a6b2a"],
    pageBg: "#2d5a27",
    pageText: "#f5f0e8",
    pageBgImage: false,
    // Ivory tile face with thick raised-edge effect (like real mahjong bone tiles)
    tileBg: (cat, selected) => selected
      ? `linear-gradient(160deg, #fff8e8 0%, #f0e0b0 40%, #e8d090 100%)`
      : `linear-gradient(160deg, #fffef8 0%, #faf0d8 50%, #f0e4c0 100%)`,
    tileBorder: (cat, selected) => selected
      ? `2px solid ${cat.color}` 
      : `2px solid #c8a870`,
    tileText: (cat, selected) => cat.color,  // category colour shows through on ivory
    tileShadow: (cat, selected, highlighted) => selected
      ? `4px 6px 0 #7a5a2a, 0 8px 20px ${cat.color}55, inset 0 1px 0 #ffffff99`
      : highlighted
      ? `3px 5px 0 #c8a870, 0 0 0 2px #d4a020, inset 0 1px 0 #ffffff99`
      : `3px 5px 0 #9a7a40, inset 0 1px 0 #ffffff99, inset 0 -1px 0 #c8a87044`,
    labelColor: (cat) => cat.color,
    cardBg: "#1e4a1a",
    cardBorder: "#3a7a30",
    headerBg: "#1a3a16cc",
    headerBorder: "#3a7a30",
  },
  paper: {
    label: "Paper",
    emoji: "📄",
    desc: "Clean white with strong ink contrast",
    preview: ["#c8000a","#0a6b5a","#8a5a00","#5a0a8a","#2a6a00"],
    pageBg: "#f4f1eb",
    pageText: "#1a1208",
    pageBgImage: false,
    // White tile, dark ink text, bold coloured border
    tileBg: (cat, selected) => selected
      ? `linear-gradient(145deg, ${cat.color}28, ${cat.color}10)`
      : `#ffffff`,
    tileBorder: (cat, selected) => selected
      ? `2.5px solid ${cat.color}`
      : `2px solid ${cat.color}cc`,
    tileText: (cat, _selected) => {
      // Darken each category colour significantly for ink-on-paper legibility
      const darkMap: Record<string, string> = {
        "#E84855": "#8a000a", "#F4A261": "#7a3a00", "#2EC4B6": "#006b5a",
        "#CBF3F0": "#005a50", "#FFBF69": "#7a4a00", "#C77DFF": "#5a0090",
        "#9EF01A": "#3a7000",
      };
      return darkMap[cat.color] ?? "#1a1208";
    },
    tileShadow: (cat, selected, highlighted) => selected
      ? `0 6px 16px ${cat.color}55, 0 2px 0 ${cat.color}88`
      : highlighted
      ? `0 0 0 2.5px #d4a020, 0 4px 12px #d4a02033`
      : `0 2px 0 ${cat.color}55, 0 3px 8px #00000018`,
    labelColor: (cat) => {
      const darkMap: Record<string, string> = {
        "#E84855": "#8a000a", "#F4A261": "#7a3a00", "#2EC4B6": "#006b5a",
        "#CBF3F0": "#005a50", "#FFBF69": "#7a4a00", "#C77DFF": "#5a0090",
        "#9EF01A": "#3a7000",
      };
      return darkMap[cat.color] ?? "#1a1208";
    },
    cardBg: "#ffffff",
    cardBorder: "#d0c8b8",
    headerBg: "#f4f1ebee",
    headerBorder: "#d0c8b8",
  },
};
