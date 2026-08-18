import { useEffect, useState } from 'react';
import { apiBaseUrl } from '../api/client.js';

interface AvatarImageProps {
  userId: string;
  name: string;
  hasAvatar?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  cacheKey?: number | string;
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base font-semibold',
  xl: 'w-24 h-24 text-2xl font-bold',
};

const BG_COLORS = [
  'bg-blue-600',
  'bg-indigo-600',
  'bg-slate-700',
  'bg-teal-700',
  'bg-cyan-700',
  'bg-sky-700',
  'bg-violet-700',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'PH';
  if (parts.length === 1) return (parts[0]?.substring(0, 2) ?? 'PH').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

function getColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % BG_COLORS.length;
}

export function AvatarImage({
  userId,
  name,
  hasAvatar = true,
  size = 'md',
  className = '',
  cacheKey,
}: AvatarImageProps): React.JSX.Element {
  const [loadFailed, setLoadFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  useEffect(() => {
    setLoadFailed(false);
  }, [userId, cacheKey]);

  if (userId && hasAvatar !== false && !loadFailed) {
    const avatarUrl = `${apiBaseUrl}/users/${encodeURIComponent(userId)}/avatar${cacheKey ? `?t=${cacheKey}` : ''}`;
    return (
      <img
        src={avatarUrl}
        alt={`Foto de perfil de ${name}`}
        onError={() => setLoadFailed(true)}
        className={`rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0 ${sizeClass} ${className}`}
      />
    );
  }

  const initials = getInitials(name);
  const colorClass = BG_COLORS[getColorIndex(name)] ?? 'bg-blue-600';

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white shrink-0 select-none shadow-sm ${colorClass} ${sizeClass} ${className}`}
      title={name}
      aria-label={`Iniciais de ${name}`}
    >
      {initials}
    </div>
  );
}
