import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";

/**
 * Repeating heart-tile overlay used in the Keep Walking outro sequence.
 * Exact replica of the HeartBackground local component in LyricVideo.tsx
 * and LyricVideoOnlyPinin.tsx.
 */
export const HeartBackground: React.FC = () => {
  const { width, height } = useVideoConfig();
  const HEART_SIZE = 30;

  const cells = React.useMemo(() => {
    const cols = Math.ceil(width / HEART_SIZE);
    const rows = Math.ceil(height / HEART_SIZE);
    return Array.from({ length: rows * cols }, (_, i) => ({
      row: Math.floor(i / cols),
      col: i % cols,
    }));
  }, [width, height]);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {cells.map(({ row, col }) => (
        <div
          key={`${row}-${col}`}
          style={{
            position: "absolute",
            left: col * HEART_SIZE,
            top: row * HEART_SIZE,
            width: HEART_SIZE,
            height: HEART_SIZE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "36px",
            opacity: 0.15,
          }}
        >
          <svg viewBox="0 0 100 100">
            <path
              d="M50 88 C20 65, 5 50, 5 33 C5 18, 17 8, 30 8 C38 8, 45 12, 50 18 C55 12, 62 8, 70 8 C83 8, 95 18, 95 33 C95 50, 80 65, 50 88Z"
              fill="#dd3b43"
            />
          </svg>
        </div>
      ))}
    </AbsoluteFill>
  );
};
