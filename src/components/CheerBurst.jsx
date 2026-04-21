// ─── CONFETTI / CHEER EFFECT ─────────────────────────────────────────────────
const CHEER_MESSAGES = [
  { text: "✨ Nice Word! ✨",    color: "#f0c060" },
  { text: "🔥 On Fire!",         color: "#E84855" },
  { text: "💎 Brilliant!",       color: "#2EC4B6" },
  { text: "⚡ Wordsmith!",       color: "#C77DFF" },
  { text: "🌟 Magnificent!",     color: "#f0c060" },
  { text: "🎯 Spot On!",         color: "#9EF01A" },
  { text: "🚀 Incredible!",      color: "#CBF3F0" },
  { text: "👑 Legendary!",       color: "#F4A261" },
  { text: "💥 Boom! Word!",      color: "#E84855" },
  { text: "🎉 Fantastic!",       color: "#C77DFF" },
  { text: "⭐ Superb!",          color: "#f0c060" },
  { text: "🏆 Champion!",        color: "#9EF01A" },
  { text: "🌈 Dazzling!",        color: "#2EC4B6" },
  { text: "🎸 Rock Star!",       color: "#F4A261" },
  { text: "🦄 Extraordinary!",   color: "#C77DFF" },
  { text: "💫 Unstoppable!",     color: "#f0c060" },
  { text: "🎪 Showstopper!",     color: "#E84855" },
  { text: "🌊 Crushing It!",     color: "#2EC4B6" },
  { text: "🎓 Scholar!",         color: "#CBF3F0" },
  { text: "🔮 Spellbinding!",    color: "#C77DFF" },
];

export function CheerBurst() {
  // Self-contained: mounts → plays → unmounts via CSS animation duration
  // Parent controls visibility by mounting/unmounting via key prop
  const msg = CHEER_MESSAGES[Math.floor(Math.random() * CHEER_MESSAGES.length)];
  const pieces = 32;
  const colors = ["#f0c060","#E84855","#2EC4B6","#C77DFF","#9EF01A","#CBF3F0","#F4A261","#fff"];

  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:10000, overflow:"hidden" }}>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes cheerPop {
          0%   { transform: translateX(-50%) scale(0); opacity: 0; }
          40%  { transform: translateX(-50%) scale(1.2); opacity: 1; }
          70%  { transform: translateX(-50%) scale(0.97); opacity: 1; }
          100% { transform: translateX(-50%) scale(0.9) translateY(-40px); opacity: 0; }
        }
      `}</style>
      {Array.from({ length: pieces }).map((_, i) => {
        const color = colors[i % colors.length];
        const left = 2 + Math.random() * 96;
        const delay = Math.random() * 0.6;
        const dur = 1.0 + Math.random() * 1.0;
        const size = 5 + Math.random() * 9;
        const shape = Math.random();
        return (
          <div key={i} style={{
            position:"absolute", left:`${left}%`, top:"-10px",
            width:size,
            height: shape > 0.66 ? size : shape > 0.33 ? size * 0.35 : size * 0.7,
            borderRadius: shape > 0.66 ? "50%" : shape > 0.33 ? 1 : "2px 6px",
            background: color,
            animation: `confettiFall ${dur}s ease-in ${delay}s forwards`,
            boxShadow: `0 0 5px ${color}88`,
          }}/>
        );
      })}
      <div style={{
        position:"absolute", left:"50%", top:"36%",
        fontFamily:"'Noto Serif SC',serif",
        fontSize: 50,
        fontWeight:900,
        color: msg.color,
        textShadow:`0 0 40px ${msg.color}88, 0 0 80px ${msg.color}44, 0 4px 16px #00000099`,
        animation:"cheerPop 1.6s cubic-bezier(0.16,1,0.3,1) forwards",
        whiteSpace:"nowrap",
        pointerEvents:"none",
        letterSpacing:"0.02em",
      }}>
        {msg.text}
      </div>
    </div>
  );
}
