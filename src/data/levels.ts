import { freshTileId } from './tiles';
import type { Tile, TileCategoryKey } from './tiles';

export type PhonicsLevel = {
  id: number;
  title: string;
  focus: string;
  description: string;
  tileTexts: string[];
  targetWords: string[];   // achievable words (for hints / reference)
  wordsToUnlock: number;
};

function catFor(text: string): TileCategoryKey {
  if (['a','e','i','o','u'].includes(text)) return 'open_vowel';
  if (['ai','ay','ea','ee','ie','oa','oe','oo','ou','ow','ue','ui','eu','oi','oy','au','aw'].includes(text)) return 'double_vowel';
  if (['ar','er','ir','or','ur'].includes(text)) return 'r_vowel';
  if (['ck','ng','nk','tch','dge','le','tion','ing','re','pre','un','dis','out','over'].includes(text)) return 'specials';
  if (['bl','br','ch','cl','cr','dr','fl','fr','gl','gr','pl','pr','sh','sk','sl','sm','sn','sp','st','str','sw','th','tr','tw','wh','wr','qu'].includes(text)) return 'others';
  return 'main_consonants';
}

export function makeLevelTiles(texts: string[]): Tile[] {
  return texts.map(text => ({
    id: freshTileId(),
    text,
    display: text,
    variants: null,
    activeVariant: 0,
    category: catFor(text),
  }));
}

export const PHONICS_LEVELS: PhonicsLevel[] = [
  {
    id: 1,
    title: 'The EA Sound',
    focus: 'ea',
    description: "ea says 'ee'",
    tileTexts: ['t', 'ea', 'm', 'p', 'ch', 'r', 'b', 'n'],
    targetWords: ['eat','each','team','beam','meat','beat','reach','teach','beach','bean','mean','neat','peat','peach','cheap','cheat'],
    wordsToUnlock: 3,
  },
  {
    id: 2,
    title: 'The EE Sound',
    focus: 'ee',
    description: "ee says 'ee'",
    tileTexts: ['t', 'ee', 'f', 'r', 's', 'n', 'gr', 'qu'],
    targetWords: ['see','tree','free','green','queen','teen','feet','reef','greet','sneer','seen','teem'],
    wordsToUnlock: 3,
  },
  {
    id: 3,
    title: 'EA meets EE',
    focus: 'ea + ee',
    description: 'Both say the same! Spot the difference',
    tileTexts: ['t', 'ea', 'ee', 'm', 'r', 's', 'n', 'b'],
    targetWords: ['eat','sea','see','tree','team','beam','seem','bean','seen','mean','teen','neat','meet','seat','beat','teem'],
    wordsToUnlock: 4,
  },
  {
    id: 4,
    title: 'AI and AY',
    focus: 'ai + ay',
    description: 'ai and ay both say the same sound!',
    tileTexts: ['r', 'ai', 'ay', 'n', 'cl', 'pl', 'tr', 's'],
    targetWords: ['rain','train','clay','play','say','ray','tray','plain','trail','snail','strain'],
    wordsToUnlock: 4,
  },
  {
    id: 5,
    title: 'Bossy R',
    focus: 'ar / or / er',
    description: 'R changes the vowel sound!',
    tileTexts: ['c', 'ar', 'or', 'er', 'n', 't', 'ch', 'b'],
    targetWords: ['car','corn','barn','born','tar','torn','nor','bar','chart','corner','archer','charter','barter'],
    wordsToUnlock: 3,
  },
  {
    id: 6,
    title: 'Blend It!',
    focus: 'blends',
    description: 'Two consonants, one smooth sound',
    tileTexts: ['bl', 'tr', 'str', 'ea', 'ee', 't', 'm', 'r'],
    targetWords: ['bleat','tree','street','stream','treat','meet','team','meat','teem'],
    wordsToUnlock: 3,
  },
  {
    id: 7,
    title: 'Free Build!',
    focus: 'all sounds',
    description: "You've mastered phonics — build anything!",
    tileTexts: ['t', 'ea', 'ee', 'ai', 'str', 'r', 'm', 'n'],
    targetWords: ['stream','strain','street','rain','main','train','teen','meet','meat','mean','team','teem'],
    wordsToUnlock: 5,
  },
];
