import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Flame, Trophy, Star, Zap } from 'lucide-react';

const LEVELS = [
  { min: 0, label: 'Starter', icon: Star, color: 'text-gray-500', bg: 'bg-gray-100', glow: 'shadow-gray-300/50' },
  { min: 50, label: 'Rising', icon: Zap, color: 'text-blue-600', bg: 'bg-blue-100', glow: 'shadow-blue-300/60' },
  { min: 150, label: 'Closer', icon: Flame, color: 'text-orange-600', bg: 'bg-orange-100', glow: 'shadow-orange-300/60' },
  { min: 400, label: 'Champion', icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-100', glow: 'shadow-amber-300/60' },
];

function getLevel(points = 0) {
  return [...LEVELS].reverse().find((l) => points >= l.min) || LEVELS[0];
}

export function getNextLevel(points = 0) {
  return LEVELS.find((l) => l.min > points) || null;
}

export default function PointsBadge({ points = 0, size = 'md' }) {
  const level = getLevel(points);
  const Icon = level.icon;
  const sizes = size === 'sm' ? 'text-xs px-2 py-1 gap-1' : 'text-sm px-3 py-1.5 gap-1.5';
  const iconRef = useRef(null);

  // Gentle continuous pulse on the icon — subtle "alive" feel without being distracting
  useEffect(() => {
    if (!iconRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(iconRef.current, {
        scale: 1.15,
        duration: 0.9,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold shadow-sm ${level.bg} ${level.color} ${level.glow} ${sizes}`}
    >
      <span ref={iconRef} className="inline-flex">
        <Icon size={size === 'sm' ? 13 : 15} />
      </span>
      {points} pts &middot; {level.label}
    </span>
  );
}

export { LEVELS, getLevel };
