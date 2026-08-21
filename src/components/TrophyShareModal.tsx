import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  Trophy, 
  Sparkles, 
  ExternalLink, 
  Pin, 
  Globe, 
  Lock, 
  Rocket, 
  Layers, 
  Building2, 
  ShieldCheck, 
  Download, 
  TrendingUp, 
  Flame, 
  Crown, 
  Eye, 
  Star, 
  Heart, 
  Zap,
  CheckCircle2
} from 'lucide-react';
import { UserProfile } from '../types';
import { Trophy as TrophyType } from '../utils/trophies';
import { useToast } from './Toast';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

interface TrophyShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  trophy: TrophyType | null;
  developerName: string;
  currentUser: UserProfile | null;
  isOwner?: boolean;
  isPinned?: boolean;
  isPublished?: boolean;
  onTogglePin?: (trophyId: string) => void;
  onTogglePublish?: (trophyId: string) => void;
}

const TIER_STYLES: Record<
  string, 
  { border: string; bg: string; text: string; glow: string; badgeBg: string; name: string }
> = {
  bronze: {
    border: 'border-amber-700/50',
    bg: 'from-amber-950/30 to-zinc-950',
    text: 'text-amber-400',
    glow: 'shadow-amber-900/20',
    badgeBg: 'bg-amber-950/60 border-amber-700/60 text-amber-300',
    name: 'Bronze',
  },
  silver: {
    border: 'border-slate-400/50',
    bg: 'from-slate-900/40 to-zinc-950',
    text: 'text-slate-200',
    glow: 'shadow-slate-500/20',
    badgeBg: 'bg-slate-900/80 border-slate-500/60 text-slate-200',
    name: 'Argent',
  },
  gold: {
    border: 'border-yellow-500/50',
    bg: 'from-yellow-950/30 to-zinc-950',
    text: 'text-yellow-400',
    glow: 'shadow-yellow-500/20',
    badgeBg: 'bg-yellow-950/60 border-yellow-600/60 text-yellow-300',
    name: 'Or',
  },
  platinum: {
    border: 'border-cyan-400/50',
    bg: 'from-cyan-950/40 to-zinc-950',
    text: 'text-cyan-300',
    glow: 'shadow-cyan-500/25',
    badgeBg: 'bg-cyan-950/80 border-cyan-500/60 text-cyan-200',
    name: 'Platine',
  },
  mythic: {
    border: 'border-purple-500/60',
    bg: 'from-purple-950/40 to-zinc-950',
    text: 'text-purple-300',
    glow: 'shadow-purple-500/30',
    badgeBg: 'bg-purple-950/80 border-purple-500/60 text-purple-200',
    name: 'Mythique Fondateur',
  },
};

const ICON_MAP: Record<string, React.ElementType> = {
  Rocket,
  Layers,
  Building2,
  ShieldCheck,
  Download,
  TrendingUp,
  Flame,
  Crown,
  Eye,
  Sparkles,
  Star,
  Heart,
  Zap,
};

export const TrophyShareModal: React.FC<TrophyShareModalProps> = ({
  isOpen,
  onClose,
  trophy,
  developerName,
  currentUser,
  isOwner = false,
  isPinned = false,
  isPublished = false,
  onTogglePin,
  onTogglePublish,
}) => {
  const { showToast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  if (!isOpen || !trophy || !isOwner) return null;

  const tierStyle = TIER_STYLES[trophy.tier] || TIER_STYLES.bronze;
  const IconComp = ICON_MAP[trophy.iconName] || Trophy;

  const shareUrl = `${window.location.origin}/#trophy/${encodeURIComponent(developerName)}/${trophy.id}`;
  const shareText = `🏆 J'ai débloqué le trophée "${trophy.title}" (${tierStyle.name}) sur ORAX PROJET ! Découvrez mes projets et créations :`;
  const markdownBadge = `[![Trophée ORAX: ${trophy.title}](https://img.shields.io/badge/ORAX%20PROJET-${encodeURIComponent(trophy.title)}-06b6d4?style=for-the-badge&logo=rocket)](${shareUrl})`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      try {
        confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 } });
      } catch {}
      showToast({
        title: 'Lien copié !',
        message: 'Le lien direct vers ce trophée a été copié dans le presse-papiers.',
        type: 'success',
      });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast({
        title: 'Erreur',
        message: 'Impossible de copier le lien.',
        type: 'error',
      });
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdownBadge);
      setCopiedMarkdown(true);
      showToast({
        title: 'Badge Markdown copié !',
        message: 'Collez ce badge dans votre README.md GitHub pour afficher votre trophée.',
        type: 'success',
      });
      setTimeout(() => setCopiedMarkdown(false), 2500);
    } catch {
      showToast({
        title: 'Erreur',
        message: 'Impossible de copier le code.',
        type: 'error',
      });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Trophée ORAX : ${trophy.title}`,
          text: shareText,
          url: shareUrl,
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <AnimatePresence>
      <div 
        id="trophy-share-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl space-y-6 p-6 sm:p-8 my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl bg-zinc-950 border ${tierStyle.border}`}>
                <Trophy className={`w-5 h-5 ${tierStyle.text}`} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                  Publier & Partager le Trophée
                </h2>
                <p className="text-xs text-zinc-400">
                  Vitrine de récompense officielle ORAX
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Achievement Card Preview */}
          <div className={`relative rounded-2xl bg-gradient-to-b ${tierStyle.bg} border-2 ${tierStyle.border} p-6 shadow-xl ${tierStyle.glow} space-y-4 overflow-hidden`}>
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-2xl bg-zinc-950 border ${tierStyle.border} flex items-center justify-center shadow-lg`}>
                  <IconComp className={`w-7 h-7 ${tierStyle.text}`} />
                </div>
                <div>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider border mb-1 ${tierStyle.badgeBg}`}>
                    Trophée {tierStyle.name}
                  </span>
                  <h3 className="text-lg font-black text-white font-mono tracking-tight">
                    {trophy.title}
                  </h3>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 text-xs font-bold font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Obtenu</span>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed relative z-10">
              {trophy.description}
            </p>

            <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3 text-[11px] text-zinc-400 relative z-10 font-mono">
              <span>Attribué à : <strong className="text-white">{developerName}</strong></span>
              <span className="text-cyan-400 font-bold">ORAX PROJET</span>
            </div>
          </div>

          {/* Owner Specific Controls (Pinning & Publishing to showcase) */}
          {isOwner && (
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold font-mono text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Gestion de votre vitrine
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {onTogglePublish && (
                  <button
                    type="button"
                    onClick={() => onTogglePublish(trophy.id)}
                    className={`px-3 py-2 rounded-xl border text-xs font-mono font-medium flex items-center justify-between transition-all ${
                      isPublished
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      Publié sur le profil
                    </span>
                    <span className="text-[10px] font-bold">
                      {isPublished ? 'Actif ✓' : 'Inactif'}
                    </span>
                  </button>
                )}

                {onTogglePin && (
                  <button
                    type="button"
                    onClick={() => onTogglePin(trophy.id)}
                    className={`px-3 py-2 rounded-xl border text-xs font-mono font-medium flex items-center justify-between transition-all ${
                      isPinned
                        ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Pin className="w-3.5 h-3.5 text-amber-400" />
                      Épingler en tête
                    </span>
                    <span className="text-[10px] font-bold">
                      {isPinned ? 'Épinglé ★' : 'Épingler'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Share Links & Actions */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs font-mono transition-all shadow-md shadow-cyan-500/20 active:scale-95"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Lien copié !' : 'Copier le lien direct'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-mono text-xs transition-all border border-zinc-700"
                title="Badge pour README GitHub"
              >
                {copiedMarkdown ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-cyan-400" />}
                <span>{copiedMarkdown ? 'Badge copié !' : 'Badge GitHub'}</span>
              </button>
            </div>

            {/* Social Sharing Icons */}
            <div className="flex items-center justify-center gap-2 pt-2 border-t border-zinc-800/80">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer noopener"
                className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono transition-colors"
                title="Partager sur X (Twitter)"
              >
                X (Twitter)
              </a>

              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer noopener"
                className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono transition-colors"
                title="Partager sur LinkedIn"
              >
                LinkedIn
              </a>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
                target="_blank"
                rel="noreferrer noopener"
                className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono transition-colors"
                title="Partager sur WhatsApp"
              >
                WhatsApp
              </a>

              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noreferrer noopener"
                className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono transition-colors"
                title="Partager sur Telegram"
              >
                Telegram
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
