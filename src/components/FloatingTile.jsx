export const FLOATING_TILES = [
  { text: "ai", color: "#2EC4B6", x: 8,  y: 15, delay: 0,    dur: 7 },
  { text: "sh", color: "#FFBF69", x: 78, y: 10, delay: 1.2,  dur: 8 },
  { text: "ee", color: "#2EC4B6", x: 22, y: 72, delay: 0.5,  dur: 6 },
  { text: "th", color: "#FFBF69", x: 88, y: 65, delay: 2,    dur: 9 },
  { text: "or", color: "#CBF3F0", x: 5,  y: 45, delay: 1.8,  dur: 7 },
  { text: "ng", color: "#9EF01A", x: 92, y: 38, delay: 0.3,  dur: 8 },
  { text: "oo", color: "#2EC4B6", x: 55, y: 82, delay: 2.5,  dur: 6 },
  { text: "ph", color: "#9EF01A", x: 35, y: 8,  delay: 0.9,  dur: 9 },
  { text: "er", color: "#CBF3F0", x: 68, y: 78, delay: 1.5,  dur: 7 },
  { text: "ck", color: "#FFBF69", x: 15, y: 88, delay: 3,    dur: 8 },
  { text: "ea", color: "#2EC4B6", x: 72, y: 22, delay: 0.7,  dur: 6 },
  { text: "wh", color: "#FFBF69", x: 42, y: 90, delay: 2.2,  dur: 7 },
  { text: "ir", color: "#CBF3F0", x: 3,  y: 60, delay: 1.1,  dur: 9 },
  { text: "qu", color: "#9EF01A", x: 85, y: 85, delay: 0.4,  dur: 6 },
  { text: "oi", color: "#2EC4B6", x: 58, y: 5,  delay: 3.3,  dur: 8 },
  { text: "dr", color: "#9EF01A", x: 28, y: 55, delay: 1.9,  dur: 7 },
];

export function FloatingTile({ text, color, x, y, delay, dur }) {
  return (
    <div style={{
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      width: 54,
      height: 62,
      borderRadius: 9,
      border: `1.5px solid ${color}55`,
      background: `linear-gradient(145deg, ${color}18, ${color}08)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: `${color}99`,
      fontFamily: "'Noto Serif SC', serif",
      fontSize: text.length > 2 ? 13 : 20,
      fontWeight: 700,
      boxShadow: `0 4px 20px ${color}22`,
      animation: `floatBob ${dur}s ease-in-out ${delay}s infinite`,
      pointerEvents: "none",
      userSelect: "none",
    }}>
      {text}
    </div>
  );
}
