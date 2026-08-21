import { Project, UserProfile, DeveloperInfo } from '../types';
import { getUserCertification } from './certification';

export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'mythic';
export type TrophyCategory = 'creator' | 'popularity' | 'quality' | 'community' | 'special';

export interface Trophy {
  id: string;
  title: string;
  description: string;
  iconName: string;
  tier: TrophyTier;
  category: TrophyCategory;
  isUnlocked: boolean;
  progressPercent: number;
  currentValue: number;
  targetValue: number;
  unit: string;
  unlockedAt?: string;
}

export interface DeveloperGamificationStats {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  progressToNextLevel: number;
  rankTitle: string;
  unlockedTrophiesCount: number;
  totalTrophiesCount: number;
  trophies: Trophy[];
}

export function computeDeveloperTrophies(
  developerIdentifier: string | undefined | null,
  allProjects: Project[] = [],
  userProfile?: UserProfile | null
): DeveloperGamificationStats {
  const target = (developerIdentifier || userProfile?.uid || userProfile?.displayName || '').trim();
  const targetLower = target.toLowerCase();

  const devProjects = allProjects.filter((p) => {
    if (!p) return false;
    return (
      (p.developerName && p.developerName.toLowerCase() === targetLower) ||
      (p.ownerId && p.ownerId === target) ||
      (userProfile?.uid && p.ownerId === userProfile.uid)
    );
  });

  const totalProjects = devProjects.length;
  const totalDownloads = devProjects.reduce((sum, p) => sum + (p.downloads || 0), 0);
  const totalViews = devProjects.reduce((sum, p) => sum + (p.views || 0), 0);
  const totalFavorites = devProjects.reduce((sum, p) => sum + (p.favoritesCount || 0), 0);

  // Highest rated project and average ratings count
  let totalRatingScore = 0;
  let totalRatingsCount = 0;
  devProjects.forEach((p) => {
    if (p.rating && p.ratingsCount) {
      totalRatingScore += p.rating * p.ratingsCount;
      totalRatingsCount += p.ratingsCount;
    } else if (p.rating && p.rating > 0) {
      totalRatingScore += p.rating;
      totalRatingsCount += 1;
    }
  });
  const avgRating = totalRatingsCount > 0 ? totalRatingScore / totalRatingsCount : 0;

  // Check certification and full admin/founder privileges
  const certStats = getUserCertification(userProfile || { uid: target, displayName: target }, allProjects);
  const isLordDemon = 
    certStats.isLordDemon || 
    Boolean(userProfile?.isAdmin) ||
    Boolean(userProfile?.email && (
      userProfile.email.toLowerCase() === 'mikeysano45t@gmail.com' ||
      userProfile.email.toLowerCase() === 'epargnelock@gmail.com' ||
      userProfile.email.toLowerCase() === 'lord.demon.dev@orax.net'
    )) ||
    target === 'dev_lord_demon' ||
    targetLower === 'lord demon' ||
    targetLower.includes('lord demon') ||
    userProfile?.uid === 'dev_lord_demon';

  // Define Trophy Definitions
  const trophyDefs: Omit<Trophy, 'isUnlocked' | 'progressPercent' | 'currentValue'>[] = [
    {
      id: 'first_launch',
      title: 'Pionnier du Code',
      description: 'Publier votre tout premier projet sur la plateforme NEXORA.',
      iconName: 'Rocket',
      tier: 'bronze',
      category: 'creator',
      targetValue: 1,
      unit: 'projet',
    },
    {
      id: 'prolific_author',
      title: 'Créateur Prolifique',
      description: 'Publier au moins 3 projets actifs sur NEXORA.',
      iconName: 'Layers',
      tier: 'silver',
      category: 'creator',
      targetValue: 3,
      unit: 'projets',
    },
    {
      id: 'studio_master',
      title: 'Grand Architecte',
      description: 'Publier 5 projets ou logiciels complets.',
      iconName: 'Building2',
      tier: 'gold',
      category: 'creator',
      targetValue: 5,
      unit: 'projets',
    },
    {
      id: 'certified_developer',
      title: 'Développeur Certifié',
      description: 'Obtenir la certification officielle (50 téléchargements & 100 vues sur 1 projet).',
      iconName: 'ShieldCheck',
      tier: 'gold',
      category: 'quality',
      targetValue: 1,
      unit: 'badge',
    },
    {
      id: 'first_10_downloads',
      title: 'Premiers Adeptes',
      description: 'Atteindre un cumul de 10 téléchargements sur vos projets.',
      iconName: 'Download',
      tier: 'bronze',
      category: 'popularity',
      targetValue: 10,
      unit: 'téléchargements',
    },
    {
      id: 'downloads_50',
      title: 'En Pleine Ascension',
      description: 'Cumuler 50 téléchargements au total sur la plateforme.',
      iconName: 'TrendingUp',
      tier: 'silver',
      category: 'popularity',
      targetValue: 50,
      unit: 'téléchargements',
    },
    {
      id: 'downloads_100',
      title: 'Succès Viral',
      description: 'Dépasser le cap des 100 téléchargements cumulés.',
      iconName: 'Flame',
      tier: 'gold',
      category: 'popularity',
      targetValue: 100,
      unit: 'téléchargements',
    },
    {
      id: 'downloads_500',
      title: 'Légende du Hub',
      description: 'Atteindre le palier impressionnant de 500 téléchargements.',
      iconName: 'Crown',
      tier: 'platinum',
      category: 'popularity',
      targetValue: 500,
      unit: 'téléchargements',
    },
    {
      id: 'views_100',
      title: 'Sous les Projecteurs',
      description: 'Attirer plus de 100 vues cumulées sur vos créations.',
      iconName: 'Eye',
      tier: 'bronze',
      category: 'popularity',
      targetValue: 100,
      unit: 'vues',
    },
    {
      id: 'views_500',
      title: 'Haute Visibilité',
      description: 'Cumuler 500 vues de visiteurs sur vos projets.',
      iconName: 'Sparkles',
      tier: 'silver',
      category: 'popularity',
      targetValue: 500,
      unit: 'vues',
    },
    {
      id: 'five_stars',
      title: 'Excellence Reconnue',
      description: 'Maintenir une note moyenne supérieure ou égale à 4.5/5 (min. 2 avis).',
      iconName: 'Star',
      tier: 'gold',
      category: 'quality',
      targetValue: 4.5,
      unit: 'note moyenne',
    },
    {
      id: 'favorites_5',
      title: 'Coup de Cœur',
      description: 'Avoir au moins 5 mises en favoris de la part de la communauté.',
      iconName: 'Heart',
      tier: 'silver',
      category: 'community',
      targetValue: 5,
      unit: 'favoris',
    },
    {
      id: 'lord_demon_legacy',
      title: 'Trône du Fondateur',
      description: 'Statut exclusif réservé au créateur et administrateur officiel LORD DEMON.',
      iconName: 'Zap',
      tier: 'mythic',
      category: 'special',
      targetValue: 1,
      unit: 'statut',
    },
  ];

  // Evaluate each trophy
  const evaluatedTrophies: Trophy[] = trophyDefs.map((def) => {
    let current = 0;
    let unlocked = false;

    switch (def.id) {
      case 'first_launch':
        current = totalProjects;
        unlocked = totalProjects >= 1;
        break;
      case 'prolific_author':
        current = totalProjects;
        unlocked = totalProjects >= 3;
        break;
      case 'studio_master':
        current = totalProjects;
        unlocked = totalProjects >= 5;
        break;
      case 'certified_developer':
        current = certStats.isCertified ? 1 : 0;
        unlocked = certStats.isCertified;
        break;
      case 'first_10_downloads':
        current = totalDownloads;
        unlocked = totalDownloads >= 10;
        break;
      case 'downloads_50':
        current = totalDownloads;
        unlocked = totalDownloads >= 50;
        break;
      case 'downloads_100':
        current = totalDownloads;
        unlocked = totalDownloads >= 100;
        break;
      case 'downloads_500':
        current = totalDownloads;
        unlocked = totalDownloads >= 500;
        break;
      case 'views_100':
        current = totalViews;
        unlocked = totalViews >= 100;
        break;
      case 'views_500':
        current = totalViews;
        unlocked = totalViews >= 500;
        break;
      case 'five_stars':
        current = parseFloat(avgRating.toFixed(1));
        unlocked = avgRating >= 4.5 && totalRatingsCount >= 2;
        break;
      case 'favorites_5':
        current = totalFavorites;
        unlocked = totalFavorites >= 5;
        break;
      case 'lord_demon_legacy':
        current = isLordDemon ? 1 : 0;
        unlocked = isLordDemon;
        break;
      default:
        current = 0;
        unlocked = false;
    }

    // Administrators and Founders receive full privileges and 100% unlocked trophies
    if (isLordDemon) {
      unlocked = true;
      current = Math.max(current, def.targetValue);
    }

    const progressPercent = unlocked ? 100 : Math.min(100, Math.round((current / def.targetValue) * 100));

    return {
      ...def,
      currentValue: current,
      isUnlocked: unlocked,
      progressPercent,
    };
  });

  // Calculate XP & Level
  // Each unlocked trophy awards XP according to tier
  const tierXpMap: Record<TrophyTier, number> = {
    bronze: 100,
    silver: 250,
    gold: 500,
    platinum: 1000,
    mythic: 2500,
  };

  let totalXp = 0;
  evaluatedTrophies.forEach((t) => {
    if (t.isUnlocked) {
      totalXp += tierXpMap[t.tier];
    } else {
      // Partial progress XP
      totalXp += Math.round((t.progressPercent / 100) * (tierXpMap[t.tier] * 0.2));
    }
  });

  if (isLordDemon) {
    // Admin / Founder VIP XP Bonus
    totalXp = Math.max(totalXp, 15000);
  }

  // Level formula: Level = floor(sqrt(totalXp / 150)) + 1
  const calculatedLevel = Math.max(1, Math.floor(Math.sqrt(totalXp / 150)) + 1);
  const level = isLordDemon ? Math.max(10, calculatedLevel) : calculatedLevel;
  const currentLevelBaseXp = Math.pow(level - 1, 2) * 150;
  const nextLevelTotalXp = Math.pow(level, 2) * 150;
  const levelXpNeeded = nextLevelTotalXp - currentLevelBaseXp;
  const currentLevelProgressXp = Math.max(0, totalXp - currentLevelBaseXp);
  const progressToNextLevel = isLordDemon ? 100 : Math.min(100, Math.round((currentLevelProgressXp / levelXpNeeded) * 100));

  // Rank Titles
  const getRankTitle = (lvl: number, isFounder: boolean) => {
    if (isFounder) return 'Fondateur & Super Admin NEXORA';
    if (lvl >= 10) return 'Grand Maître Code';
    if (lvl >= 7) return 'Développeur Élite';
    if (lvl >= 5) return 'Architecte Senior';
    if (lvl >= 3) return 'Développeur Confirmé';
    if (lvl >= 2) return 'Artisan Développeur';
    return 'Apprenti Codeur';
  };

  const unlockedCount = evaluatedTrophies.filter((t) => t.isUnlocked).length;

  return {
    level,
    currentXp: totalXp,
    nextLevelXp: nextLevelTotalXp,
    progressToNextLevel,
    rankTitle: getRankTitle(level, isLordDemon),
    unlockedTrophiesCount: unlockedCount,
    totalTrophiesCount: evaluatedTrophies.length,
    trophies: evaluatedTrophies,
  };
}
