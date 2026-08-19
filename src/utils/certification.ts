import { Project, UserProfile } from '../types';

export interface DeveloperCertificationStats {
  isCertified: boolean;
  isLordDemon: boolean;
  maxDownloads: number;
  maxViews: number;
  qualifyingProject: Project | null;
  downloadsProgress: number; // 0 to 100%
  viewsProgress: number;     // 0 to 100%
  totalProjects: number;
  requiredDownloads: number;
  requiredViews: number;
}

export const CERTIFICATION_REQUIREMENTS = {
  MIN_DOWNLOADS: 50,
  MIN_VIEWS: 100,
};

const VERIFIED_ADMIN_EMAILS = new Set([
  'epargnelock@gmail.com',
  'mikeysano45t@gmail.com',
  'lord.demon.dev@orax.net',
]);

/**
 * Evaluates whether a developer has reached the certification threshold:
 * At least 50 downloads AND at least 100 views on at least ONE project.
 * Founders and verified administrators are automatically certified.
 */
export function getDeveloperCertification(
  developerIdentifier: string | undefined | null,
  allProjects: Project[] = []
): DeveloperCertificationStats {
  const reqDl = CERTIFICATION_REQUIREMENTS.MIN_DOWNLOADS;
  const reqViews = CERTIFICATION_REQUIREMENTS.MIN_VIEWS;

  if (!developerIdentifier) {
    return {
      isCertified: false,
      isLordDemon: false,
      maxDownloads: 0,
      maxViews: 0,
      qualifyingProject: null,
      downloadsProgress: 0,
      viewsProgress: 0,
      totalProjects: 0,
      requiredDownloads: reqDl,
      requiredViews: reqViews,
    };
  }

  const target = developerIdentifier.trim();
  const targetLower = target.toLowerCase();

  // Find all projects belonging to this developer (by name or owner ID)
  const devProjects = allProjects.filter((p) => {
    if (!p) return false;
    return (
      (p.developerName && p.developerName.toLowerCase() === targetLower) ||
      (p.ownerId && p.ownerId === target)
    );
  });

  // Strict check: Only grant isLordDemon if linked to verified admin projects or admin UID
  const isLordDemon =
    target === 'dev_lord_demon' ||
    devProjects.some(
      (p) =>
        p.ownerId === 'dev_lord_demon' ||
        (p.ownerEmail && VERIFIED_ADMIN_EMAILS.has(p.ownerEmail.toLowerCase()))
    );

  let maxDownloads = 0;
  let maxViews = 0;
  let qualifyingProject: Project | null = null;

  for (const project of devProjects) {
    const dls = project.downloads || 0;
    const views = project.views || 0;

    if (dls > maxDownloads) maxDownloads = dls;
    if (views > maxViews) maxViews = views;

    // Check if this project satisfies both thresholds
    if (dls >= reqDl && views >= reqViews && !qualifyingProject) {
      qualifyingProject = project;
    }
  }

  const isCertified = isLordDemon || qualifyingProject !== null;
  const downloadsProgress = Math.min(100, Math.round((maxDownloads / reqDl) * 100));
  const viewsProgress = Math.min(100, Math.round((maxViews / reqViews) * 100));

  return {
    isCertified,
    isLordDemon,
    maxDownloads,
    maxViews,
    qualifyingProject,
    downloadsProgress,
    viewsProgress,
    totalProjects: devProjects.length,
    requiredDownloads: reqDl,
    requiredViews: reqViews,
  };
}

/**
 * Checks if a specific User Profile is certified.
 */
export function getUserCertification(
  user: UserProfile | { uid?: string; displayName?: string; email?: string; isAdmin?: boolean } | null,
  allProjects: Project[] = []
): DeveloperCertificationStats {
  if (!user) {
    return getDeveloperCertification(null, allProjects);
  }

  const isLord = 
    Boolean(user.isAdmin) || 
    user.uid === 'dev_lord_demon' ||
    Boolean(user.email && VERIFIED_ADMIN_EMAILS.has(user.email.toLowerCase()));

  // Check by UID first
  const statsByUid = getDeveloperCertification(user.uid, allProjects);
  if (statsByUid.isCertified || statsByUid.totalProjects > 0) {
    if (isLord) {
      statsByUid.isLordDemon = true;
      statsByUid.isCertified = true;
    }
    return statsByUid;
  }

  // Fallback by display name
  const statsByName = getDeveloperCertification(user.displayName, allProjects);
  if (isLord) {
    statsByName.isLordDemon = true;
    statsByName.isCertified = true;
  }
  return statsByName;
}
