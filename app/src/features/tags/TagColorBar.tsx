import { memo } from 'react';

export const TagColorBar = memo(function TagColorBar({ colors }: { colors: string[] }) {
  if (colors.length === 0) return null;
  return (
    <span className="absolute left-0 top-0 bottom-0 z-10 flex w-1 flex-col" aria-hidden>
      {colors.map((color, index) => (
        <span key={index} className="flex-1" style={{ backgroundColor: color }} />
      ))}
    </span>
  );
});
