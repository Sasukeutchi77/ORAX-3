import React, { useState, useMemo } from 'react';
import { 
  Trophy as TrophyIcon, 
  Sparkles, 
  Zap, 
  Award, 
  ShieldCheck, 
  Crown, 
  Flame, 
  Star, 
  Heart, 
  Download, 
  Eye, 
  Layers, 
  Rocket, 
  Building2, 
  TrendingUp, 
  Lock, 
  CheckCircle2, 
  Info,
  ChevronRight
} from 'lucide-react';
import { Trophy, TrophyTier, TrophyCategory, DeveloperGamificationStats, computeDeveloperTrophies } from '../utils/trophies';
import { UserProfile, Project } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface TrophiesDisplayProps {
  stats?: DeveloperGamificationStats;
  user?: UserProfile | null;
  userProjects?: Project[];
  developerName?: string;
  compact?: boolean;
}

export const TrophiesDisplay: React.FC<TrophiesDisplayProps> = ({ 
  stats, 
  user,
  userProjects = [],
  developerName,
  compact = false 
}) => {
  const [selectedCategory, setSelectedCategory] = useState<TrophyCategory | 'all'>('all');
  const [activeTrophy, setActiveTrophy] = useState<Trophy | null>(null);

  const activeStats: DeveloperGamificationStats = useMemo(() => {
    if (stats) return stats;
    return computeDeveloperTrophies(developerName || user?.displayName || user?.uid, userProjects, user);
  }, [stats, developerName, user, userProjects]);

  const getTierBadgeStyle = (tier: TrophyTier) => {
    switch (tier) {
      case 'mythic':
        return 'bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-cyan-500/20 border-amber-400/40 text-amber-300';
      case 'platinum':
        return 'bg-cyan-500/15 border-cyan-400/30 text-cyan-300';
      case 'gold':
        return 'bg-amber-500/15 border-amber-400/30 text-amber-400';
      case 'silver':
        return 'bg-slate-400/15 border-slate-300/30 text-slate-300';
      case 'bronze':
      default:
        return 'bg-orange-600/15 border-orange-500/30 text-orange-400';
    }
  };

  const getTierName = (tier: TrophyTier) => {
    switch (tier) {
      case 'mythic': return 'Mythique';
      case 'platinum': return 'Platine';
      case 'gold': return 'Or';
      case 'silver': return 'Argent';
      case 'bronze': return 'Bronze';
    }
  };

  const renderIcon = (iconName: string, className: string = 'w-5 h-5') => {
    switch (iconName) {
      case 'Rocket': return <Rocket className={className} />;
      case 'Layers': return <Layers className={className} />;
      case 'Building2': return <Building2 className={className} />;
      case 'ShieldCheck': return <ShieldCheck className={className} />;
      case 'Download': return <Download className={className} />;
      case 'TrendingUp': return <TrendingUp className={className} />;
      case 'Flame': return <Flame className={className} />;
      case 'Crown': return <Crown className={className} />;
      case 'Eye': return <Eye className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      case 'Star': return <Star className={className} />;
      case 'Heart': return <Heart className={className} />;
      case 'Zap': return <Zap className={className} />;
      default: return <Award className={className} />;
    }
  };

  const filteredTrophies = selectedCategory === 'all' 
    ? (activeStats.trophies || [])
    : (activeStats.trophies || []).filter(t => t.category === selectedCategory);

  if (compact) {
    return (
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrophyIcon className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold text-white">Niveau {activeStats.level} • {activeStats.rankTitle}</span>
          </div>
          <span className="text-[11px] font-mono text-cyan-400 font-bold">
            {activeStats.unlockedTrophiesCount}/{activeStats.totalTrophiesCount} Trophées
          </span>
        </div>

        {/* Level XP bar */}
        <div className="space-y-1">
          <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-amber-400 transition-all duration-500"
              style={{ width: `${activeStats.progressToNextLevel}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>{activeStats.currentXp} XP</span>
            <span>{activeStats.progressToNextLevel}% vers Niv. {activeStats.level + 1}</span>
          </div>
        </div>

        {/* Mini icons row */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {(activeStats.trophies || []).slice(0, 7).map((t) => (
            <div 
              key={t.id} 
              className={`p-1.5 rounded-lg border text-xs transition-transform hover:scale-110 ${
                t.isUnlocked 
                  ? getTierBadgeStyle(t.tier) 
                  : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-600 opacity-40'
              }`}
              title={`${t.title} (${t.isUnlocked ? 'Débloqué !' : 'Verrouillé'})`}
            >
              {renderIcon(t.iconName, 'w-3.5 h-3.5')}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Gamification Level & Rank Overview Card */}
      <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-purple-600 p-0.5 shadow-lg shadow-amber-500/20">
                <div className="w-full h-full bg-zinc-950 rounded-[14px] flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase font-mono font-bold text-amber-400">Niveau</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono leading-none mt-0.5">{activeStats.level}</span>
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-amber-500 text-zinc-950">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-extrabold text-white font-mono">{activeStats.rankTitle}</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono font-bold">
                  {activeStats.currentXp.toLocaleString()} XP
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Débloquez des trophées et accomplissements en publiant des projets, recevant des avis et accumulant des téléchargements.
              </p>
            </div>
          </div>

          <div className="w-full md:w-64 space-y-2 bg-zinc-950/60 border border-zinc-800/80 p-4 rounded-2xl">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-mono">Progression Niveau {activeStats.level + 1}</span>
              <span className="text-cyan-400 font-bold font-mono">{activeStats.progressToNextLevel}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-amber-400"
                initial={{ width: 0 }}
                animate={{ width: `${activeStats.progressToNextLevel}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>{activeStats.unlockedTrophiesCount} débloqués</span>
              <span>{activeStats.totalTrophiesCount - activeStats.unlockedTrophiesCount} restants</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'creator', 'popularity', 'quality', 'special'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all ${
                selectedCategory === cat
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {cat === 'all' && 'Tous les Trophées'}
              {cat === 'creator' && '🚀 Création'}
              {cat === 'popularity' && '🔥 Popularité'}
              {cat === 'quality' && '⭐ Qualité'}
              {cat === 'special' && '👑 Spécial & Fondateur'}
            </button>
          ))}
        </div>

        <span className="text-xs text-zinc-400 font-mono">
          Affichage de <strong className="text-zinc-200">{filteredTrophies.length}</strong> trophées
        </span>
      </div>

      {/* Trophies Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTrophies.map((trophy) => {
          const isUnlocked = trophy.isUnlocked;

          return (
            <motion.div
              key={trophy.id}
              whileHover={{ y: -2 }}
              onClick={() => setActiveTrophy(trophy)}
              className={`relative p-5 rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                isUnlocked
                  ? 'bg-zinc-900/80 border-zinc-700/80 hover:border-amber-500/40 shadow-lg'
                  : 'bg-zinc-950/40 border-zinc-800/60 opacity-60 hover:opacity-80'
              }`}
            >
              {/* Top Row: Icon + Tier Pill */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-md ${
                  isUnlocked
                    ? getTierBadgeStyle(trophy.tier)
                    : 'bg-zinc-900 border-zinc-800 text-zinc-600'
                }`}>
                  {isUnlocked ? renderIcon(trophy.iconName, 'w-6 h-6') : <Lock className="w-5 h-5 text-zinc-600" />}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border ${getTierBadgeStyle(trophy.tier)}`}>
                    {getTierName(trophy.tier)}
                  </span>
                  {isUnlocked && (
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      Obtenu
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1">
                <h4 className={`text-sm font-bold font-mono ${isUnlocked ? 'text-white' : 'text-zinc-400'}`}>
                  {trophy.title}
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                  {trophy.description}
                </p>
              </div>

              {/* Progress bar */}
              <div className="mt-4 pt-3 border-t border-zinc-800/80 space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-zinc-500">Progression</span>
                  <span className={isUnlocked ? 'text-emerald-400 font-bold' : 'text-zinc-400'}>
                    {trophy.currentValue} / {trophy.targetValue} {trophy.unit}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      isUnlocked 
                        ? 'bg-emerald-400' 
                        : 'bg-cyan-500'
                    }`}
                    style={{ width: `${trophy.progressPercent}%` }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
};
