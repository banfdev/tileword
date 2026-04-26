const KEY = 'tileword_learning_v1';

export type WordRecord = { word: string; ts: number; level: number };

export type LearningStats = {
  totalWordsFound: number;
  uniqueWords: string[];
  levelsCompleted: number[];
  sessions: number;
  lastPlayed: string;    // toDateString()
  streakDays: number;
  recentWords: WordRecord[];
};

function blank(): LearningStats {
  return {
    totalWordsFound: 0, uniqueWords: [], levelsCompleted: [],
    sessions: 0, lastPlayed: '', streakDays: 0, recentWords: [],
  };
}

function load(): LearningStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return blank();
}

function save(s: LearningStats) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function startSession() {
  const s = load();
  const today = new Date().toDateString();
  if (s.lastPlayed !== today) {
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();
    s.streakDays = s.lastPlayed === yesterday ? s.streakDays + 1 : 1;
    s.lastPlayed = today;
  }
  s.sessions += 1;
  save(s);
}

export function recordWordFound(word: string, levelId: number) {
  const s = load();
  s.totalWordsFound += 1;
  if (!s.uniqueWords.includes(word)) s.uniqueWords.push(word);
  s.recentWords = [{ word, ts: Date.now(), level: levelId }, ...s.recentWords].slice(0, 50);
  save(s);
}

export function recordLevelCompleted(levelId: number) {
  const s = load();
  if (!s.levelsCompleted.includes(levelId)) {
    s.levelsCompleted.push(levelId);
    save(s);
  }
}

export function getLearningStats(): LearningStats { return load(); }

export function clearLearningData() { localStorage.removeItem(KEY); }
