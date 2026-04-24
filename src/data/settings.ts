// --- GLOBAL SETTINGS (defaults) ----------------------------------------------
export type TileThemeKey = 'neon' | 'mahjong' | 'paper';

export type Settings = {
  smokeEffect: boolean;
  cheerEffect: boolean;
  hintPenalty: boolean;
  tileAnimations: boolean;
  soundLabels: boolean;
  autoMakeWord: boolean;
  soundEffects: number;
  ambientMusic: number;
  tileTheme: TileThemeKey;
};

export const DEFAULT_SETTINGS: Settings = {
  smokeEffect: false,
  cheerEffect: true,
  hintPenalty: true,
  tileAnimations: true,
  soundLabels: true,
  autoMakeWord: true,
  soundEffects: 0.5,
  ambientMusic: 0.5,
  tileTheme: "neon",
};
