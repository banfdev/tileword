import { TILE_CATEGORIES } from '../data/tiles.js';
import { TILE_THEMES } from '../themes/tileThemes.js';
import { getTileSound } from '../data/tiles.js';

// ─── TILE COMPONENT─────────────────────────────────────
export function Tile({ tile, selected, highlighted, autoPulse, onClick, onCycleVariant, onHover, disabled, small, theme, animated = true, showLabel = true }) {
  const cat = TILE_CATEGORIES[tile.category];
  const size = small ? 52 : 64;
  const isDual = !!(tile.variants && tile.variants.length > 1);
  const activeSound = getTileSound(tile);
  const th = TILE_THEMES[theme] || TILE_THEMES.neon;
  const isMahjong = theme === "mahjong";

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={e => { if (!disabled && onHover) { const r = e.currentTarget.getBoundingClientRect(); onHover(tile, r.left + r.width/2, r.top + r.height/2); } }}
      onMouseLeave={() => { if (onHover) onHover(null, 0, 0); }}
    >
      <button
        onClick={e => { e.stopPropagation(); if (!disabled) onClick(tile); }}
        disabled={disabled}
        style={{
          width: size,
          height: size + 10,
          borderRadius: isMahjong ? 5 : 8,
          background: th.tileBg(cat, selected),
          color: th.tileText(cat, selected),
          border: th.tileBorder(cat, selected),
          fontFamily: "'Noto Serif SC', serif",
          fontSize: activeSound.length > 3 ? 11 : activeSound.length > 2 ? 14 : 18,
          fontWeight: 800,
          cursor: disabled ? "default" : "pointer",
          transition: "all 0.15s ease",
          transform: selected && animated ? "translateY(-6px) scale(1.06)" : "translateY(0)",
          boxShadow: th.tileShadow(cat, selected, highlighted),
          animation: autoPulse ? "tileAutoPulse 1.4s ease-in-out" : "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          position: "relative",
          overflow: "hidden",
          letterSpacing: "0.02em",
          userSelect: "none",
          padding: 0,
        }}
      >
        {/* Mahjong inner frame — mimics the decorative border of real tiles */}
        {isMahjong && (
          <div style={{
            position: "absolute", inset: 3, borderRadius: 2,
            border: `1.5px solid ${cat.color}55`,
            pointerEvents: "none", zIndex: 0,
          }} />
        )}
        {selected && (
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at center, ${cat.color}22 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />
        )}
        {isDual ? (
          <div style={{ display: "flex", alignItems: "center", gap: 1, lineHeight: 1, position: "relative", zIndex: 1 }}>
            {tile.variants.map((v, i) => {
              const isActive = i === tile.activeVariant;
              const fs = v.length > 2 ? 10 : 13;
              return (
                <span
                  key={i}
                  onClick={e => {
                    if (!isActive && !disabled && onCycleVariant) { e.stopPropagation(); onCycleVariant(tile); }
                  }}
                  title={isActive ? undefined : `Switch to "${v}"`}
                  style={{
                    fontSize: fs, fontWeight: 800,
                    opacity: isActive ? 1 : 0.28,
                    color: th.tileText(cat, selected),
                    cursor: isActive ? "default" : "pointer",
                    transition: "opacity 0.15s",
                    lineHeight: 1, letterSpacing: 0,
                  }}
                >
                  {i === 1 && <span style={{ opacity: 0.35, fontSize: fs - 2, margin: "0 1px" }}>/</span>}
                  {v}
                </span>
              );
            })}
          </div>
        ) : (
          <span style={{ lineHeight: 1, fontSize: activeSound.length > 3 ? 11 : activeSound.length > 2 ? 14 : 18, position: "relative", zIndex: 1 }}>
            {activeSound}
          </span>
        )}
        {showLabel && <span style={{
          fontSize: 7, opacity: 0.75,
          fontFamily: "monospace", textTransform: "uppercase",
          letterSpacing: "0.08em", color: th.labelColor(cat),
          fontWeight: 700, position: "relative", zIndex: 1,
        }}>
          {cat.label.split(" ")[0]}
        </span>}
      </button>
    </div>
  );
}
