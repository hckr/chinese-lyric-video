import { formatRulerTime } from "./timing.ts";

export function RulerMarks({
  major,
  minor,
  duration,
}: {
  major: number[];
  minor: number[];
  duration: number;
}) {
  const position = (time: number) => `${(time / duration) * 100}%`;
  return (
    <>
      {minor.map((time) => (
        <i aria-hidden="true" key={time} style={{ left: position(time) }} />
      ))}
      {major.map((time) => (
        <span key={time} style={{ left: position(time) }}>
          <span className="timing-ruler-label">{formatRulerTime(time)}</span>
        </span>
      ))}
    </>
  );
}
