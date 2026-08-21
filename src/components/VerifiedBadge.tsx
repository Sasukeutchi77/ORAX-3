import React from 'react';
import { BadgeCheck, Sparkles } from 'lucide-react';

interface VerifiedBadgeProps {
  isCertified: boolean;
  isLordDemon?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  labelText?: string;
  className?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  isCertified,
  isLordDemon = false,
  size = 'sm',
  showLabel = false,
  labelText,
  className = '',
}) => {
  if (!isCertified) return null;

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const textSizes = {
    xs: 'text-[9px]',
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  const titleText = isLordDemon
    ? 'Fondateur & Développeur Certifié NEXORA'
    : 'Développeur Certifié (+50 téléchargements et +100 vues sur un projet)';

  if (isLordDemon) {
    return (
      <span
        title={titleText}
        className={`inline-flex items-center gap-1 font-mono font-bold shrink-0 ${
          showLabel
            ? 'px-2 py-0.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm shadow-cyan-500/20'
            : 'text-cyan-400'
        } ${textSizes[size]} ${className}`}
      >
        <Sparkles className={`${iconSizes[size]} text-cyan-400 fill-cyan-400/30 shrink-0`} />
        {showLabel && <span>{labelText || 'Fondateur & Certifié'}</span>}
      </span>
    );
  }

  return (
    <span
      title={titleText}
      className={`inline-flex items-center gap-1 font-mono font-bold shrink-0 ${
        showLabel
          ? 'px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
          : 'text-emerald-400'
      } ${textSizes[size]} ${className}`}
    >
      <BadgeCheck className={`${iconSizes[size]} text-emerald-400 fill-emerald-400/20 shrink-0`} />
      {showLabel && <span>{labelText || 'Certifié'}</span>}
    </span>
  );
};
