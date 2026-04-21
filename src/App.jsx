import { useState } from 'react';
import { DEFAULT_SETTINGS } from './data/settings.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { TitleScreen } from './screens/TitleScreen.jsx';
import { SinglePlayerMenu } from './screens/SinglePlayerMenu.jsx';
import { MahjongPhonicsGame } from './screens/MahjongPhonicsGame.jsx';
import { TimedMode } from './screens/TimedMode.jsx';
import { ClassicMode } from './screens/ClassicMode.jsx';

// ─── ROOT APP — manages screen routing ────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("title"); // "title" | "singleplayer" | "endless" | "timed" | "classic"
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const updateSetting = (key, val) => setSettings(s => ({ ...s, [key]: val }));

  const handleUnlock = () => AudioEngine.unlock();

  let content;
  if (screen === "endless") {
    content = <MahjongPhonicsGame onBackToTitle={() => setScreen("title")} settings={settings} />;
  } else if (screen === "timed") {
    content = <TimedMode onBackToTitle={() => setScreen("title")} settings={settings} />;
  } else if (screen === "classic") {
    content = <ClassicMode onBackToTitle={() => setScreen("title")} settings={settings} />;
  } else if (screen === "singleplayer") {
    content = <SinglePlayerMenu
      onEndless={() => setScreen("endless")}
      onTimed={() => setScreen("timed")}
      onClassic={() => setScreen("classic")}
      onBack={() => setScreen("title")}
    />;
  } else {
    content = <TitleScreen
      onPlay={() => setScreen("singleplayer")}
      onPlayTimed={() => setScreen("singleplayer")}
      settings={settings}
      updateSetting={updateSetting}
    />;
  }

  return (
    <div onClick={handleUnlock} onKeyDown={handleUnlock} style={{ outline: "none" }}>
      {content}
    </div>
  );
}
