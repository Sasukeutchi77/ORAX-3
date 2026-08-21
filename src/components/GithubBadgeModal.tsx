import React, { useState } from 'react';
import { 
  X, 
  Code2, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Download, 
  Star, 
  ShieldCheck, 
  Tag, 
  Layers,
  HelpCircle
} from 'lucide-react';
import { Project } from '../types';
import { useToast } from './Toast';
import { motion, AnimatePresence } from 'motion/react';

interface GithubBadgeModalProps {
  project: Project;
  onClose: () => void;
  isOpen?: boolean;
}

type BadgeStyle = 'for-the-badge' | 'flat' | 'flat-square' | 'plastic';
type BadgeType = 'downloads' | 'rating' | 'version' | 'certified' | 'platform';
type ExportFormat = 'markdown' | 'html' | 'url';

export const GithubBadgeModal: React.FC<GithubBadgeModalProps> = ({ project, onClose, isOpen = true }) => {
  if (!isOpen) return null;

  const { showToast } = useToast();
  const [badgeType, setBadgeType] = useState<BadgeType>('downloads');
  const [badgeStyle, setBadgeStyle] = useState<BadgeStyle>('for-the-badge');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [copied, setCopied] = useState(false);

  const baseUrl = window.location.origin;
  const projectLink = `${baseUrl}?project=${encodeURIComponent(project.slug || project.id)}`;

  // Generate badge image URL based on project stats
  const getBadgeImageUrl = (type: BadgeType, style: BadgeStyle) => {
    switch (type) {
      case 'downloads': {
        const count = project.downloads || 0;
        const formatted = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : `${count}`;
        return `https://img.shields.io/badge/NEXORA-${formatted}_téléchargements-06b6d4?style=${style}&logo=rocket&logoColor=white`;
      }
      case 'rating': {
        const rating = project.rating && project.rating > 0 ? project.rating.toFixed(1) : '5.0';
        return `https://img.shields.io/badge/NEXORA_Note-${rating}_★-eab308?style=${style}&logo=star&logoColor=white`;
      }
      case 'version': {
        const ver = project.version || 'v1.0.0';
        return `https://img.shields.io/badge/NEXORA_Release-${encodeURIComponent(ver)}-10b981?style=${style}&logo=tag&logoColor=white`;
      }
      case 'certified': {
        return `https://img.shields.io/badge/NEXORA-Projet_Vérifié-3b82f6?style=${style}&logo=shield&logoColor=white`;
      }
      case 'platform': {
        return `https://img.shields.io/badge/Disponible_sur-NEXORA-09090b?style=${style}&labelColor=06b6d4&color=18181b`;
      }
    }
  };

  const currentBadgeImageUrl = getBadgeImageUrl(badgeType, badgeStyle);

  // Generate the formatted snippet based on the export format
  const getCodeSnippet = () => {
    switch (exportFormat) {
      case 'markdown':
        return `[![NEXORA - ${project.name}](${currentBadgeImageUrl})](${projectLink})`;
      case 'html':
        return `<a href="${projectLink}" target="_blank" rel="noopener noreferrer"><img src="${currentBadgeImageUrl}" alt="NEXORA - ${project.name}" /></a>`;
      case 'url':
        return currentBadgeImageUrl;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopied(true);
    showToast({
      title: 'Badge copié dans le presse-papier !',
      message: 'Collez ce code dans le fichier README.md de votre dépôt GitHub.',
      type: 'success',
    });
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl space-y-6 p-6 sm:p-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-white font-mono">Générateur de Badges GitHub</h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 text-[10px] font-mono font-bold">
                  NEXORA Badges
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Affichez en direct vos statistiques et votre téléchargement NEXORA dans le README de votre projet.
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

        {/* Live Badge Preview Area */}
        <div className="space-y-3">
          <label className="text-xs font-mono font-bold text-zinc-300 flex items-center justify-between">
            <span>Aperçu en direct du Badge :</span>
            <span className="text-[11px] text-cyan-400">Style: {badgeStyle}</span>
          </label>

          <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center gap-4 min-h-[120px] shadow-inner text-center">
            <img 
              src={currentBadgeImageUrl} 
              alt="Badge Preview" 
              className="max-h-10 transition-transform duration-200 hover:scale-105"
            />
            <p className="text-[11px] text-zinc-500 font-mono">
              Clique sur le badge pour ouvrir la page du projet NEXORA
            </p>
          </div>
        </div>

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Badge Type Selector */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-zinc-300">1. Métrique à afficher :</label>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { id: 'downloads', label: '🚀 Téléchargements cumulés', sub: `${project.downloads || 0} téléchargements` },
                { id: 'rating', label: '⭐ Note et Avis communautaires', sub: `${project.rating || 5.0} ★` },
                { id: 'version', label: '🏷️ Version / Release actuelle', sub: project.version || 'v1.0.0' },
                { id: 'certified', label: '🛡️ Badge Projet Vérifié NEXORA', sub: 'Certifié et sécurisé' },
                { id: 'platform', label: '🌐 Bouton Disponible sur NEXORA', sub: 'Lien plateforme' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setBadgeType(item.id as BadgeType)}
                  className={`p-2.5 rounded-xl text-left border text-xs font-mono transition-all flex items-center justify-between ${
                    badgeType === item.id
                      ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="font-bold">{item.label}</span>
                  <span className="text-[10px] text-zinc-500">{item.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Badge Style Selector */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-zinc-300">2. Style visuel du Badge :</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'for-the-badge', label: 'FOR-THE-BADGE', desc: 'Moderne & Grand' },
                { id: 'flat', label: 'FLAT', desc: 'Standard GitHub' },
                { id: 'flat-square', label: 'FLAT SQUARE', desc: 'Coins Carrés' },
                { id: 'plastic', label: 'PLASTIC', desc: 'Effet Glossy' },
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => setBadgeStyle(style.id as BadgeStyle)}
                  className={`p-3 rounded-xl text-center border text-xs font-mono transition-all ${
                    badgeStyle === style.id
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="font-bold">{style.label}</div>
                  <div className="text-[9px] text-zinc-500 mt-0.5">{style.desc}</div>
                </button>
              ))}
            </div>

            {/* Export Format Selector */}
            <div className="pt-2">
              <label className="text-xs font-mono font-bold text-zinc-300 block mb-1.5">3. Format d'intégration :</label>
              <div className="flex gap-2">
                {[
                  { id: 'markdown', label: 'Markdown (README.md)' },
                  { id: 'html', label: 'HTML <img>' },
                  { id: 'url', label: 'Lien Image' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setExportFormat(fmt.id as ExportFormat)}
                    className={`flex-1 py-2 rounded-xl text-center border text-[11px] font-mono font-bold transition-all ${
                      exportFormat === fmt.id
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Code Snippet Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-zinc-300">Code à insérer dans votre projet :</span>
            <span className="text-[10px] font-mono text-zinc-500">Mise à jour en temps réel</span>
          </div>

          <div className="relative">
            <pre className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-cyan-300 overflow-x-auto selection:bg-cyan-500/30 whitespace-pre-wrap break-all">
              {getCodeSnippet()}
            </pre>

            <button
              onClick={handleCopy}
              className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-mono font-bold text-xs shadow-md transition-all active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Les compteurs de téléchargements et d'étoiles se synchronisent automatiquement.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold font-mono text-xs"
          >
            Fermer
          </button>
        </div>

      </motion.div>
    </div>
  );
};
