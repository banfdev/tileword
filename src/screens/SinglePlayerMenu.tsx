import { useState, useEffect } from 'react';
import { useWindowSize } from '../hooks/useWindowSize';
import { AudioEngine } from '../audio/AudioEngine';

type SinglePlayerMenuProps = {
  onEndless: () => void;
  onTimed: () => void;
  onClassic: () => void;
  onBack: () => void;
};

// --- SINGLE PLAYER SUB-MENU ---------------------------------------------------
export function SinglePlayerMenu({ onEndless, onTimed, onClassic, onBack }: SinglePlayerMenuProps) {
  const vw = useWindowSize();
  const isMobile = vw < 640;
  const [entered, setEntered] = useState(false);
  const [hovered, setHovered]   = useState<string | null>(null);

  useEffect(() => { setTimeout(() => setEntered(true), 60); }, []);

  const modes = [
    {
      id: "endless",
      icon: "∞",
      label: "Endless Mode",
      desc: "Build words round after round. No timer, no pressure - pure phonics zen.",
      color: "#f0c060",
      bg: "linear-gradient(135deg, #f0c06018, #f0c06006)",
      border: "#f0c06055",
      onClick: () => { AudioEngine.play("modeSelect"); onEndless(); },
    },
    {
      id: "timed",
      icon: "⏱",
      label: "Timed Mode",
      desc: "Race the clock. Score as many words as you can before time runs out.",
      color: "#E84855",
      bg: "linear-gradient(135deg, #E8485518, #E8485506)",
      border: "#E8485555",
      onClick: () => { AudioEngine.play("modeSelect"); onTimed(); },
    },
    {
      id: "classic",
      icon: "🀄",
      label: "Classic Mahjong",
      desc: "Draw, discard, fuse words. Play against bots on a real Mahjong table.",
      color: "#C77DFF",
      bg: "linear-gradient(135deg, #C77DFF18, #C77DFF06)",
      border: "#C77DFF55",
      onClick: () => { AudioEngine.play("modeSelect"); onClassic(); },
    },
  ];

  // Mini floating tile decoration positions
  const floaters = [
    { text:"sh", color:"#FFBF69", x:5,  y:12, dur:7, delay:0   },
    { text:"ee", color:"#2EC4B6", x:88, y:8,  dur:8, delay:1.2 },
    { text:"or", color:"#CBF3F0", x:7,  y:75, dur:6, delay:0.5 },
    { text:"ng", color:"#9EF01A", x:90, y:70, dur:9, delay:2   },
    { text:"ai", color:"#2EC4B6", x:4,  y:45, dur:7, delay:1.8 },
    { text:"th", color:"#FFBF69", x:93, y:38, dur:8, delay:0.3 },
    { text:"oo", color:"#C77DFF", x:48, y:90, dur:6, delay:2.5 },
    { text:"ph", color:"#9EF01A", x:52, y:4,  dur:9, delay:0.9 },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0d14",
      backgroundImage: `
        radial-gradient(ellipse at 15% 25%, #1a0a2e55 0%, transparent 45%),
        radial-gradient(ellipse at 85% 75%, #0a1a2e55 0%, transparent 45%),
        radial-gradient(ellipse at 50% 50%, #0d1a0d33 0%, transparent 60%)
      `,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: "#e0e0f0",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes spFloat {
          0%,100% { transform: translateY(0px) rotate(-1deg); }
          50%      { transform: translateY(-22px) rotate(1deg); }
        }
        @keyframes spFadeIn {
          from { opacity:0; transform: translateY(28px) scale(0.96); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }
        @keyframes spCardIn {
          from { opacity:0; transform: translateX(-20px) scale(0.97); }
          to   { opacity:1; transform: translateX(0) scale(1); }
        }
        @keyframes shimmerSlide {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes iconBounce {
          0%,100% { transform: translateY(0) scale(1); }
          40%     { transform: translateY(-8px) scale(1.15); }
          70%     { transform: translateY(-3px) scale(1.05); }
        }
        @keyframes orbPulse {
          0%,100% { transform: scale(1); opacity:0.4; }
          50%     { transform: scale(1.15); opacity:0.7; }
        }
        .sp-card:hover { transform: translateY(-4px) scale(1.012) !important; }
        .sp-card { transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), box-shadow 0.22s ease, border-color 0.2s ease !important; }
      `}</style>

      {/* Floating background tiles */}
      {floaters.map((f, i) => (
        <div key={i} style={{
          position:"absolute", left:`${f.x}%`, top:`${f.y}%`,
          width:46, height:54, borderRadius:8,
          border:`1.5px solid ${f.color}44`,
          background:`linear-gradient(145deg, ${f.color}14, ${f.color}06)`,
          display:"flex", alignItems:"center", justifyContent:"center",
          color:`${f.color}77`, fontFamily:"'Noto Serif SC',serif",
          fontSize: f.text.length > 2 ? 12 : 18, fontWeight:700,
          boxShadow:`0 4px 18px ${f.color}18`,
          animation:`spFloat ${f.dur}s ease-in-out ${f.delay}s infinite`,
          pointerEvents:"none",
        }}>{f.text}</div>
      ))}

      {/* Ambient orbs */}
      {[
        { color:"#C77DFF", x:20, y:30, size:180, delay:0 },
        { color:"#f0c060", x:75, y:60, size:140, delay:1.5 },
        { color:"#E84855", x:50, y:80, size:120, delay:3 },
      ].map((orb, i) => (
        <div key={i} style={{
          position:"absolute", left:`${orb.x}%`, top:`${orb.y}%`,
          width:orb.size, height:orb.size,
          borderRadius:"50%",
          background:`radial-gradient(circle, ${orb.color}0f 0%, transparent 70%)`,
          animation:`orbPulse ${5+i}s ease-in-out ${orb.delay}s infinite`,
          pointerEvents:"none",
          transform:"translate(-50%,-50%)",
        }}/>
      ))}

      {/* Center content */}
      <div style={{
        position:"relative", zIndex:10,
        opacity: entered ? 1 : 0,
        animation: entered ? "spFadeIn 0.6s cubic-bezier(0.16,1,0.3,1) both" : "none",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 32,
        width: isMobile ? "calc(100vw - 32px)" : 400,
      }}>
        {/* Header */}
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:44, marginBottom:12, animation:"iconBounce 2.4s ease-in-out 0.6s infinite" }}>🎮</div>
          <div style={{ fontFamily:"'Noto Serif SC',serif", fontSize:28, fontWeight:900, color:"#f0c060", letterSpacing:"0.04em",
            background:"linear-gradient(90deg, #f0c060, #ffde9a, #f0c060)",
            backgroundSize:"400px 100%",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            animation:"shimmerSlide 3s linear infinite",
          }}>Single Player</div>
          <div style={{ fontSize:11, color:"#ffffff33", letterSpacing:"0.18em", textTransform:"uppercase", marginTop:8 }}>Choose your mode</div>
        </div>

        {/* Mode cards */}
        <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%" }}>
          {modes.map((mode, i) => (
            <button
              key={mode.id}
              className="sp-card"
              onClick={mode.onClick}
              onMouseEnter={e => { setHovered(mode.id); }}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: hovered === mode.id
                  ? mode.bg.replace("06", "12").replace("18", "28")
                  : mode.bg,
                border: `1.5px solid ${hovered === mode.id ? mode.color + "99" : mode.border}`,
                borderRadius: 16, padding: "18px 22px",
                color: mode.color, cursor: "pointer",
                textAlign: "left",
                display: "flex", alignItems: "center", gap: 16,
                boxShadow: hovered === mode.id ? `0 8px 32px ${mode.color}22, inset 0 1px 0 ${mode.color}22` : "none",
                position:"relative", overflow:"hidden",
                animation: `spCardIn 0.45s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.1}s both`,
                outline:"none",
              }}
            >
              {/* Shimmer sweep on hover */}
              {hovered === mode.id && (
                <div style={{
                  position:"absolute", inset:0, pointerEvents:"none",
                  background:`linear-gradient(105deg, transparent 30%, ${mode.color}18 50%, transparent 70%)`,
                  backgroundSize:"400px 100%",
                  animation:"shimmerSlide 1.2s linear infinite",
                }}/>
              )}
              <div style={{
                fontSize: mode.icon.length > 1 ? 28 : 34,
                animation: hovered === mode.id ? "iconBounce 0.6s ease" : "none",
                minWidth:40, textAlign:"center",
              }}>{mode.icon}</div>
              <div>
                <div style={{ fontFamily:"'Noto Serif SC',serif", fontSize:17, fontWeight:800, marginBottom:4 }}>{mode.label}</div>
                <div style={{ fontSize:11, color:`${mode.color}88`, lineHeight:1.55 }}>{mode.desc}</div>
              </div>
              {/* Arrow indicator */}
              <div style={{ marginLeft:"auto", fontSize:16, opacity: hovered === mode.id ? 1 : 0.2, transform: hovered === mode.id ? "translateX(3px)" : "translateX(0)", transition:"all 0.2s", color:mode.color }}>{'>'}</div>
            </button>
          ))}
        </div>

        <button onClick={() => { AudioEngine.play("backToMenu"); onBack(); }} style={{
          background:"none", border:"none", color:"#ffffff28", cursor:"pointer",
          fontSize:12, letterSpacing:"0.12em", display:"flex", alignItems:"center", gap:6,
          transition:"color 0.2s", outline:"none",
          padding:"6px 12px", borderRadius:8,
        }}
        onMouseEnter={e => e.currentTarget.style.color="#ffffff66"}
        onMouseLeave={e => e.currentTarget.style.color="#ffffff28"}
        >← Back to Menu</button>
      </div>
    </div>
  );
}
