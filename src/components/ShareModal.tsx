import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Sparkles, 
  MessageSquare, 
  Send, 
  Smartphone,
  Globe
} from 'lucide-react';
import { Project } from '../types';
import { useToast } from './Toast';
import { motion, AnimatePresence } from 'motion/react';

interface ShareModalProps {
  project: Project;
  onClose: () => void;
  isOpen?: boolean;
}

export const ShareModal: React.FC<ShareModalProps> = ({ project, onClose, isOpen = true }) => {
  if (!isOpen) return null;

  const { showToast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  const baseUrl = window.location.origin;
  const projectLink = `${baseUrl}?project=${encodeURIComponent(project.slug || project.id)}`;
  const shareTitle = `Découvrez "${project.name}" sur ORAX PROJET`;
  const shareText = `Téléchargez et testez "${project.name}" par ${project.developerName} sur la plateforme de projets ORAX PROJET ! 🚀`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(projectLink);
    setCopiedLink(true);
    showToast({
      title: 'Lien copié !',
      message: 'Le lien direct du projet est copié dans votre presse-papier.',
      type: 'success',
    });
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: projectLink,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  // Social Share URL helpers
  const shareNetworks = [
    {
      name: 'X (Twitter)',
      icon: '𝕏',
      color: 'bg-black hover:bg-zinc-800 text-white border-zinc-700',
      action: () => {
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(projectLink)}&hashtags=ORAX,OpenSource,Dev`;
        window.open(url, '_blank', 'width=600,height=450');
      },
    },
    {
      name: 'WhatsApp',
      icon: '💬',
      color: 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-500/30',
      action: () => {
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${projectLink}`)}`;
        window.open(url, '_blank');
      },
    },
    {
      name: 'Telegram',
      icon: '✈️',
      color: 'bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border-sky-500/30',
      action: () => {
        const url = `https://t.me/share/url?url=${encodeURIComponent(projectLink)}&text=${encodeURIComponent(shareText)}`;
        window.open(url, '_blank');
      },
    },
    {
      name: 'Discord Embed',
      icon: '👾',
      color: 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border-indigo-500/30',
      action: () => {
        const discordMarkdown = `**${project.name}** par *${project.developerName}*\n> ${project.shortDescription || project.description}\n📥 **Téléchargement ORAX :** <${projectLink}>`;
        navigator.clipboard.writeText(discordMarkdown);
        showToast({
          title: 'Format Discord copié !',
          message: 'Collez ce texte formaté directement dans n\'importe quel salon Discord.',
          type: 'success',
        });
      },
    },
    {
      name: 'LinkedIn',
      icon: '💼',
      color: 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-500/30',
      action: () => {
        const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(projectLink)}`;
        window.open(url, '_blank', 'width=600,height=500');
      },
    },
    {
      name: 'Reddit',
      icon: '🤖',
      color: 'bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border-orange-500/30',
      action: () => {
        const url = `https://reddit.com/submit?url=${encodeURIComponent(projectLink)}&title=${encodeURIComponent(shareTitle)}`;
        window.open(url, '_blank', 'width=600,height=550');
      },
    },
  ];

  // Simple QR Code image URL via public QR service
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(projectLink)}&color=06b6d4&bgcolor=09090b&margin=10`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl space-y-6 p-6 sm:p-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-white font-mono">Partager le Projet</h3>
              <p className="text-xs text-zinc-400">
                Faites découvrir ce projet à vos amis et collègues développeurs.
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

        {/* Project Mini Preview Card */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800">
          <img 
            src={project.thumbnail} 
            alt={project.name} 
            className="w-14 h-14 rounded-xl object-cover border border-zinc-800 shrink-0" 
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-white font-mono truncate">{project.name}</h4>
            <p className="text-xs text-zinc-400 truncate">Par {project.developerName}</p>
            <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-cyan-400">
              <span>⬇️ {project.downloads || 0} dl</span>
              <span>⭐ {project.rating ? project.rating.toFixed(1) : '5.0'}</span>
            </div>
          </div>
        </div>

        {/* 1-Click Copy Link Box */}
        <div className="space-y-2">
          <label className="text-xs font-mono font-bold text-zinc-300">Lien direct :</label>
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              readOnly 
              value={projectLink} 
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold font-mono text-xs shadow-md transition-all active:scale-95 shrink-0"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copier</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Social Networks Grid */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold text-zinc-300">Partage rapide :</label>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono font-bold flex items-center gap-1"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Partage natif</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {shareNetworks.map((net) => (
              <button
                key={net.name}
                onClick={net.action}
                className={`p-3 rounded-2xl border text-xs font-mono font-bold transition-all flex flex-col items-center justify-center gap-1.5 hover:scale-105 active:scale-95 ${net.color}`}
              >
                <span className="text-lg">{net.icon}</span>
                <span className="text-[11px]">{net.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* QR Code toggle */}
        <div className="pt-2 border-t border-zinc-800 space-y-3">
          <button
            onClick={() => setShowQrCode(!showQrCode)}
            className="w-full py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span>{showQrCode ? 'Masquer le QR Code' : 'Afficher le QR Code pour mobile'}</span>
          </button>

          {showQrCode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col items-center justify-center p-4 bg-zinc-950 rounded-2xl border border-zinc-800 text-center space-y-2"
            >
              <img 
                src={qrCodeUrl} 
                alt="QR Code" 
                className="w-44 h-44 rounded-xl border border-zinc-800 bg-zinc-950 p-2"
              />
              <p className="text-[11px] text-zinc-400 font-mono">
                Scannez avec votre appareil photo pour ouvrir sur smartphone.
              </p>
            </motion.div>
          )}
        </div>

      </motion.div>
    </div>
  );
};
