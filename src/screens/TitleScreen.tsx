import { useState, useEffect, useCallback, useRef } from 'react';
import { useWindowSize } from '../hooks/useWindowSize';
import { TILE_CATEGORIES, getTileSound, buildDeck, shuffle, freshTileId, parseTile } from '../data/tiles';
import { WORD_LIST, SESSION_CUSTOM_WORDS, checkWordInSet, buildWordFromTiles, addCustomWord } from '../data/words';
import { DEFAULT_SETTINGS } from '../data/settings';
import type { Settings, TileThemeKey } from '../data/settings';
import { TILE_THEMES } from '../themes/tileThemes';
import { AudioEngine } from '../audio/AudioEngine';
import { Tile } from '../components/Tile';
import { CheerBurst } from '../components/CheerBurst';
import { WordSmokeCanvas, makeSmokeWord, getWordsForSound } from '../components/WordSmokeCanvas';
import { Modal } from '../components/Modal';
import { FloatingTile, FLOATING_TILES } from '../components/FloatingTile';

type TitleScreenProps = {
  onPlay: () => void;
  onPlayTimed: () => void;
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, val: Settings[K]) => void;
};

export function TitleScreen({ onPlay, onPlayTimed, settings, updateSetting }: TitleScreenProps) {
  const vw = useWindowSize();
  const isMobile = vw < 640;
  const [modal, setModal] = useState<"rules" | "credits" | "settings" | null>(null);
  const [entered, setEntered] = useState(false);
  const [wordImport, setWordImport] = useState(""); // textarea value for bulk word import
  const [customWordList, setCustomWordList] = useState(() => [...SESSION_CUSTOM_WORDS]); // reactive copy

  useEffect(() => {
    setTimeout(() => setEntered(true), 80);
  }, []);

  // Title screen ambient music
  useEffect(() => {
    AudioEngine.startMusic();
    return () => AudioEngine.stopMusic();
  }, []);
  useEffect(() => {
    AudioEngine.setMusicVolume(settings.ambientMusic);
  }, [settings.ambientMusic]);
  useEffect(() => {
    AudioEngine.setSfxVolume(settings.soundEffects);
  }, [settings.soundEffects]);

  const menuBtn = (label: string, color: string, onClick?: () => void, subtitle?: string) => (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "16px 28px",
        borderRadius: 14,
        background: `linear-gradient(135deg, ${color}22, ${color}0d)`,
        border: `1.5px solid ${color}55`,
        color: color,
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        cursor: "pointer",
        transition: "all 0.2s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        boxShadow: `0 4px 24px ${color}18`,
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = `linear-gradient(135deg, ${color}38, ${color}1a)`;
        e.currentTarget.style.transform = "translateX(6px)";
        e.currentTarget.style.boxShadow = `0 8px 32px ${color}44`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = `linear-gradient(135deg, ${color}22, ${color}0d)`;
        e.currentTarget.style.transform = "translateX(0)";
        e.currentTarget.style.boxShadow = `0 4px 24px ${color}18`;
      }}
    >
      <span>{label}</span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        {subtitle && <span style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.14em", fontWeight: 400 }}>{subtitle}</span>}
        <span style={{ fontSize: 18, opacity: 0.7 }}>{'>'}</span>
      </span>
    </button>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0d14",
      backgroundImage: `
        radial-gradient(ellipse at 30% 40%, #1a0a2e66 0%, transparent 55%),
        radial-gradient(ellipse at 75% 70%, #0a1a2e55 0%, transparent 55%),
        radial-gradient(ellipse at 60% 10%, #1a0808 33 0%, transparent 45%)
      `,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <style>{`
        @keyframes floatBob {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-18px) rotate(1deg); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes titleReveal {
          from { opacity: 0; transform: translateY(32px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-glow {
          0%,100% { box-shadow: 0 0 0 2px #f0c06088, 0 0 12px 2px #f0c06033; }
          50% { box-shadow: 0 0 0 3px #f0c060cc, 0 0 24px 6px #f0c06077; }
        }
        @keyframes subtitleFade {
          from { opacity: 0; letter-spacing: 0.3em; }
          to   { opacity: 1; letter-spacing: 0.22em; }
        }
        @keyframes menuFadeIn {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes mahjongSpin {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
      `}</style>

      {/* Floating background tiles */}
      {FLOATING_TILES.map((t, i) => <FloatingTile key={i} {...t} />)}

      {/* Decorative grid lines */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 80px, #ffffff03 80px, #ffffff03 81px),
          repeating-linear-gradient(90deg, transparent, transparent 80px, #ffffff03 80px, #ffffff03 81px)
        `,
      }} />

      {/* Center card */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", flexDirection: "column",
        alignItems: "center",
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(30px)",
        transition: "all 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* Logo area */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          {/* Mahjong tile icon cluster */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 6,
            marginBottom: 24,
            animation: "titleReveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s both",
          }}>
            {[
              { text: "🀇", label: "ph" },
              { text: "🀄", label: "" },
              { text: "🀙", label: "oo" },
            ].map((item, i) => (
              <div key={i} style={{
                width: i === 1 ? 72 : 52,
                height: i === 1 ? 82 : 60,
                borderRadius: 10,
                background: i === 1
                  ? "linear-gradient(145deg, #f0c06033, #f0c06011)"
                  : "linear-gradient(145deg, #2EC4B622, #2EC4B608)",
                border: i === 1 ? "2px solid #f0c06066" : "1.5px solid #2EC4B633",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: i === 1 ? 36 : 26,
                boxShadow: i === 1
                  ? "0 8px 32px #f0c06033, 0 0 0 1px #f0c06044"
                  : "0 4px 16px #2EC4B622",
                transform: i === 0 ? "rotate(-4deg) translateY(6px)" : i === 2 ? "rotate(4deg) translateY(6px)" : "translateY(0)",
                animation: `floatBob ${6 + i}s ease-in-out ${i * 0.4}s infinite`,
              }}>
                {item.text}
              </div>
            ))}
          </div>

          <div style={{
            fontFamily: "'Noto Serif SC', serif",
            fontSize: isMobile ? 38 : 52,
            fontWeight: 900,
            letterSpacing: "0.04em",
            lineHeight: 1,
            animation: "titleReveal 0.9s cubic-bezier(0.16,1,0.3,1) 0.2s both",
            background: "linear-gradient(135deg, #f0c060 0%, #ffdd88 40%, #e8963a 70%, #f0c060 100%)",
            backgroundSize: "400px 100%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Phonics
          </div>
          <div style={{
            fontFamily: "'Noto Serif SC', serif",
            fontSize: isMobile ? 38 : 52,
            fontWeight: 900,
            letterSpacing: "0.04em",
            lineHeight: 1,
            marginBottom: 14,
            animation: "titleReveal 0.9s cubic-bezier(0.16,1,0.3,1) 0.3s both",
            color: "#e0e0f0",
          }}>
            Mahjong
          </div>
          <div style={{
            fontSize: 12,
            color: "#ffffff55",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            animation: "subtitleFade 1s ease 0.6s both",
          }}>
            Build Words · Score Points · Master Phonics
          </div>
        </div>

        {/* Menu buttons */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 12,
          width: isMobile ? `calc(100vw - 32px)` : 340,
        }}>
          {[
            {
              label: "▶  Single Player",
              color: "#f0c060",
              delay: "0.5s",
              onClick: () => { AudioEngine.play("modeSelect"); onPlay(); },
            },
            {
              label: "⚔  Multiplayer",
              color: "#2EC4B6",
              delay: "0.62s",
              subtitle: "COMING SOON",
              onClick: () => {},
            },
            {
              label: "📖  Rules",
              color: "#C77DFF",
              delay: "0.74s",
              onClick: () => { AudioEngine.play("modalOpen"); setModal("rules"); },
            },
            {
              label: "⚙  Settings",
              color: "#F4A261",
              delay: "0.74s",
              onClick: () => { AudioEngine.play("modalOpen"); setModal("settings"); },
            },
            {
              label: "✦  Credits",
              color: "#9EF01A",
              delay: "0.86s",
              onClick: () => { AudioEngine.play("modalOpen"); setModal("credits"); },
            },
          ].map(({ label, color, delay, subtitle, onClick }, i) => (
            <div key={i} style={{
              animation: `menuFadeIn 0.5s ease ${delay} both`,
              opacity: subtitle ? 0.6 : 1,
            }}>
              {menuBtn(label, color, subtitle ? undefined : onClick, subtitle)}
            </div>
          ))}
        </div>

        {/* Version tag */}
        <div style={{
          marginTop: 36, fontSize: 10,
          color: "#ffffff22", letterSpacing: "0.14em",
          textTransform: "uppercase",
          animation: "fadeIn 1s ease 1.2s both",
        }}>
          v1.1 · 108 tiles · 3,500+ words
        </div>
      </div>

      {/* Rules Modal */}
      {modal === "rules" && (
        <Modal title="📖 How to Play" onClose={() => { AudioEngine.play("modalClose"); setModal(null); }}>
          <div style={{ color: "#ffffff99", fontSize: 13, lineHeight: 1.9 }}>
            {[
              ["🀄 Your Hand", "You are dealt 13 tiles at the start of each round. Tiles come in 7 categories - vowels, consonants, special blends, and more."],
              ["✏️ Building Words", "Click tiles in order to select them and build a word. The word preview updates live as you pick tiles."],
              ["⇄ Dual Tiles", "Tiles showing two sounds (like ei/ey or h/wh) have a small ⇄ badge. Click it to toggle between the two sounds before building your word."],
              ["✓ Make Word", "Select tiles to spell a word, then press Make Word. It checks the dictionary and scores instantly - valid words are banked, invalid ones shake and clear so you can try again."],
              ["🏁 Ending a Round", "Press End Round when you're done. Used tiles are discarded and replaced with fresh ones from the deck."],
              ["💡 Hints", "Stuck? Press Get Hint to see possible words from your current hand. Click any hint word to make its tiles glow gold for 3 seconds."],
              ["🔄 Reset", "Press Reset in the top bar to start the entire game over with a freshly shuffled deck."],
              ["⭐ Scoring", "Points = word length x tile value. Specials: 5pt · R-Vowel: 4pt · Double Vowel: 3pt · Others: 2pt · Consonants/Vowels: 1pt each."],
            ].map(([title, desc], i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ color: "#f0c060", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{title}</div>
                <div style={{ color: "#ffffff77", fontSize: 12 }}>{desc}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Settings Modal */}
      {modal === "settings" && (() => {
        const Toggle = ({ settingKey, on }: { settingKey: keyof Settings; on: boolean }) => (
          <button onClick={() => updateSetting(settingKey, !on)} style={{
            width: 46, height: 26, borderRadius: 13, flexShrink: 0,
            background: on ? "linear-gradient(90deg,#2EC4B6,#5de8e0)" : "#ffffff18",
            border: "none", cursor: "pointer", position: "relative",
            transition: "background 0.25s",
          }}>
            <div style={{
              position: "absolute", top: 3, left: on ? 23 : 3,
              width: 20, height: 20, borderRadius: "50%",
              background: "#fff", transition: "left 0.25s",
              boxShadow: "0 1px 4px #00000066",
            }}/>
          </button>
        );
        const Row = ({ settingKey, label, desc, on, accent: _accent }: { settingKey: keyof Settings; label: string; desc: string; on: boolean; accent?: string }) => (
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "11px 14px", marginBottom: 7,
            background: "#ffffff06", border: "1px solid #ffffff0d",
            borderRadius: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#e0e0f0", fontWeight: 600, fontSize: 13, marginBottom: 2, whiteSpace: "nowrap" }}>{label}</div>
              <div style={{ color: "#ffffff44", fontSize: 11, lineHeight: 1.4 }}>{desc}</div>
            </div>
            <Toggle settingKey={settingKey} on={on} />
          </div>
        );
        const SectionHead = ({ text }: { text: string }) => (
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "#F4A26199", margin: "18px 0 10px", paddingLeft: 2 }}>{text}</div>
        );
        return (
          <Modal title="⚙ Settings" onClose={() => { AudioEngine.play("modalClose"); setModal(null); }}>
            <SectionHead text="Visual Effects" />
            <Row settingKey="smokeEffect"    label="💨 Word Smoke"       desc="Words rise as smoke when hovering tiles"          on={settings.smokeEffect} />
            <Row settingKey="cheerEffect"    label="🎉 Cheer Effect"     desc="Confetti burst and message when you score a word" on={settings.cheerEffect} />
            <Row settingKey="tileAnimations" label="✨ Tile Animations"  desc="Tiles lift and glow on hover and select"          on={settings.tileAnimations} />

            <SectionHead text="Sound" />
            {/* Volume slider rows - not using the Toggle Row component */}
            {([
              { key: "soundEffects" as const, label: "🔊 Sound Effects", desc: "Tile clicks, word outcomes, hints & fanfares" },
              { key: "ambientMusic"  as const, label: "🎵 Ambient Music",  desc: "Lo-fi pentatonic loop while you play" },
            ] as Array<{ key: "soundEffects" | "ambientMusic"; label: string; desc: string }>).map(({ key, label, desc }) => {
              const vol = settings[key];   // 0–1
              const muted = vol <= 0;
              const pct = Math.round(vol * 100);
              const accent = key === "ambientMusic" ? "#2EC4B6" : "#9EF01A";
              return (
                <div key={key} style={{
                  padding: "11px 14px", marginBottom: 7,
                  background: "#ffffff06", border: "1px solid #ffffff0d",
                  borderRadius: 12,
                }}>
                  {/* Label row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <div style={{ color: "#e0e0f0", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{label}</div>
                      <div style={{ color: "#ffffff44", fontSize: 11, marginTop: 1 }}>{desc}</div>
                    </div>
                    {/* Mute toggle button */}
                    <button
                      onClick={() => updateSetting(key, muted ? 0.5 : 0)}
                      style={{
                        padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                        cursor: "pointer", letterSpacing: "0.05em", border: "none",
                        background: muted ? "#ffffff15" : `${accent}22`,
                        color: muted ? "#ffffff44" : accent,
                        flexShrink: 0, marginLeft: 12,
                      }}
                    >{muted ? "OFF" : "ON"}</button>
                  </div>
                  {/* Slider row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14 }}>{key === "ambientMusic" ? "🎵" : "🔊"}</span>
                    <div style={{ flex: 1, position: "relative" }}>
                      <input
                        type="range" min="0" max="1" step="0.01"
                        value={vol}
                        onChange={e => updateSetting(key, parseFloat(e.target.value))}
                        style={{
                          width: "100%", height: 4, cursor: "pointer",
                          accentColor: accent, opacity: muted ? 0.35 : 1,
                          transition: "opacity 0.2s",
                        }}
                      />
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, minWidth: 30, textAlign: "right",
                      color: muted ? "#ffffff33" : accent,
                      fontFamily: "monospace",
                    }}>{muted ? "-" : `${pct}%`}</span>
                  </div>
                </div>
              );
            })}

            <SectionHead text="Gameplay" />
            <Row settingKey="autoMakeWord" label="⚡ Auto-Make Word"   desc="Automatically score when selected tiles form a valid word" on={settings.autoMakeWord} />
            <Row settingKey="hintPenalty" label="💡 Hint Penalty"    desc="Halve points for words formed using hints"              on={settings.hintPenalty} />
            <Row settingKey="soundLabels" label="🏷 Category Labels" desc="Show the phonics category label on each tile"          on={settings.soundLabels} />

            <SectionHead text="My Words" />
            {/* Custom word import and management */}
            <div style={{ background: "#ffffff06", border: "1px solid #ffffff0d", borderRadius: 12, padding: "12px 14px", marginBottom: 7 }}>
              <div style={{ fontSize: 11, color: "#ffffff44", lineHeight: 1.5, marginBottom: 10 }}>
                Add words not in the built-in list. They're saved for this session only and scored normally when you use them.
              </div>
              {/* Bulk import */}
              <textarea
                value={wordImport}
                onChange={e => setWordImport(e.target.value)}
                placeholder="Type or paste words separated by commas or spaces…"
                rows={2}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#ffffff08", border: "1px solid #ffffff18",
                  borderRadius: 8, padding: "8px 10px",
                  color: "#e0e0f0", fontSize: 12, resize: "vertical",
                  fontFamily: "inherit", outline: "none", marginBottom: 8,
                }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: customWordList.length > 0 ? 10 : 0 }}>
                <button
                  onClick={() => {
                    const newWords = wordImport
                      .split(/[\s,]+/)
                      .map(w => w.trim().toLowerCase())
                      .filter(w => w.length >= 2 && /^[a-z]+$/.test(w));
                    newWords.forEach(addCustomWord);
                    setCustomWordList([...SESSION_CUSTOM_WORDS]);
                    setWordImport("");
                  }}
                  style={{
                    padding: "6px 14px", borderRadius: 8,
                    background: "linear-gradient(135deg, #C77DFF33, #C77DFF18)",
                    border: "1px solid #C77DFF66", color: "#e4acff",
                    fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em",
                  }}
                >+ Add Words</button>
                {customWordList.length > 0 && (
                  <button
                    onClick={() => {
                      SESSION_CUSTOM_WORDS.clear();
                      setCustomWordList([]);
                    }}
                    style={{
                      padding: "6px 12px", borderRadius: 8,
                      background: "#E8485518", border: "1px solid #E8485544",
                      color: "#ff6b7888", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}
                  >🗑 Clear All</button>
                )}
              </div>
              {/* Show current custom words */}
              {customWordList.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 80, overflowY: "auto" }}>
                  {customWordList.map((w, i) => (
                    <span key={i} style={{
                      fontFamily: "'Noto Serif SC', serif", fontSize: 12, fontWeight: 700,
                      color: "#C77DFF", background: "#C77DFF0d",
                      border: "1px solid #C77DFF33",
                      borderRadius: 12, padding: "2px 9px", cursor: "pointer",
                    }}
                      title="Click to remove"
                      onClick={() => {
                        SESSION_CUSTOM_WORDS.delete(w);
                        setCustomWordList([...SESSION_CUSTOM_WORDS]);
                      }}
                    >{w} ✕</span>
                  ))}
                </div>
              )}
            </div>

            <SectionHead text="Tile Theme" />
            {/* Theme Picker - chess.com style */}
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:7 }}>
              {Object.entries(TILE_THEMES).map(([key, t]) => {
                const isActive = (settings.tileTheme || "neon") === key;
                return (
                  <button key={key} onClick={() => updateSetting("tileTheme", key as TileThemeKey)} style={{
                    display:"flex", alignItems:"center", gap:14,
                    padding:"11px 14px", borderRadius:12, cursor:"pointer",
                    background: isActive ? "#C77DFF18" : "#ffffff06",
                    border: isActive ? "1.5px solid #C77DFF66" : "1px solid #ffffff0d",
                    color: "#e0e0f0", textAlign:"left", transition:"all 0.15s",
                    outline:"none",
                  }}>
                    {/* Colour swatches */}
                    <div style={{ display:"flex", gap:3, flexShrink:0 }}>
                      {t.preview.map((c, i) => (
                        <div key={i} style={{
                          width:14, height:22, borderRadius:3,
                          background: key === "mahjong"
                            ? `linear-gradient(145deg,#faf3e0,#ede0c4)`
                            : key === "paper"
                            ? "#ffffff"
                            : "linear-gradient(145deg,#1e1e2e,#16161f)",
                          border: `1.5px solid ${c}`,
                          boxShadow: key === "neon" ? `0 0 5px ${c}55` : "none",
                          position:"relative", overflow:"hidden",
                        }}>
                          <div style={{ position:"absolute", inset:0, background:c, opacity: key==="neon"?0.18:key==="mahjong"?0:0.25 }}/>
                        </div>
                      ))}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{t.emoji} {t.label}</div>
                      <div style={{ fontSize:11, color:"#ffffff55", lineHeight:1.4 }}>{t.desc}</div>
                    </div>
                    {isActive && <div style={{ color:"#C77DFF", fontSize:16, flexShrink:0 }}>✓</div>}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 20, textAlign: "center" }}>
              <button onClick={() => (Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>).forEach(k => updateSetting(k, DEFAULT_SETTINGS[k]))} style={{
                background: "#ffffff08", border: "1px solid #ffffff15",
                color: "#ffffff55", borderRadius: 8, padding: "7px 20px",
                cursor: "pointer", fontSize: 11, letterSpacing: "0.1em",
              }}>Reset to Defaults</button>
            </div>
          </Modal>
        );
      })()}

      {/* Credits Modal */}
      {modal === "credits" && (
        <Modal title="✦ Credits" onClose={() => { AudioEngine.play("modalClose"); setModal(null); }}>
          <div style={{ color: "#ffffff77", fontSize: 13, lineHeight: 1.8 }}>
            <div style={{ marginBottom: 24, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🀄</div>
              <div style={{ fontFamily: "'Noto Serif SC', serif", color: "#f0c060", fontSize: 18, fontWeight: 800 }}>
                Phonics Mahjong
              </div>
              <div style={{ fontSize: 11, color: "#ffffff33", letterSpacing: "0.12em", marginTop: 4 }}>
                A WORD-BUILDING PHONICS GAME
              </div>
            </div>

            {[
              ["🎮 Game Design", "Original concept combining Mahjong tile mechanics with structured phonics curriculum"],
              ["🔤 Phonics Curriculum", "Tile categories based on standard phonics frameworks: open/closed vowels, vowel teams, r-controlled vowels, consonant digraphs and blends"],
              ["📚 Word List", "~1,894 words drawn from Dolch, Fry, Oxford common word lists and phonics curriculum vocabulary"],
              ["⚙️ Built With", "React · Inline CSS · No external UI libraries"],
              ["💡 Special Thanks", "To everyone learning to read - one tile at a time"],
            ].map(([title, desc], i) => (
              <div key={i} style={{
                marginBottom: 16,
                padding: "12px 16px",
                background: "#ffffff06",
                borderRadius: 10,
                border: "1px solid #ffffff0d",
              }}>
                <div style={{ color: "#9EF01A", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{title}</div>
                <div style={{ color: "#ffffff66", fontSize: 12 }}>{desc}</div>
              </div>
            ))}

            <div style={{ textAlign: "center", marginTop: 20, color: "#ffffff22", fontSize: 11, letterSpacing: "0.1em" }}>
              v1.0 · 108 TILES · 1894 WORDS
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

