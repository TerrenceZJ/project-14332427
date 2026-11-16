import { useEffect, useRef, useState } from 'react';
import { START_AP } from '@/game/constants';

interface Props {
  ap: number;
}

/** 行动点条:每个格子表示 1 点行动点,消耗时最右格闪烁后暗掉 */
export default function ApBar({ ap }: Props) {
  const prevApRef = useRef(ap);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const maxAp = Math.max(START_AP, ap);

  useEffect(() => {
    const prev = prevApRef.current;
    prevApRef.current = ap;
    if (ap < prev) {
      setFlashIndex(ap);
      const t = window.setTimeout(() => setFlashIndex(null), 720);
      return () => window.clearTimeout(t);
    }
  }, [ap]);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: maxAp }).map((_, i) => {
        const lit = i < ap;
        return (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              lit ? 'bg-primary-400' : 'bg-background-300/70'
            } ${flashIndex === i ? 'ap-dim' : ''}`}
          />
        );
      })}
    </div>
  );
}
