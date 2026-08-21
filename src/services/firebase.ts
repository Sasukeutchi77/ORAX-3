import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
  runTransaction,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  DocumentSnapshot,
  onSnapshot,
  Firestore
} from 'firebase/firestore';
import { 
  Project, 
  UserProfile, 
  ProjectReport, 
  ProjectStatus, 
  ReportStatus, 
  CloudSyncState,
  PaginatedProjectsResult,
  FilterOptions,
  ProjectComment,
  DeveloperInfo,
  FirebaseConfigDiagnostic
} from '../types';

// Clean legacy local storage items on initialization
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('orax_projet_items_v2');
    localStorage.removeItem('orax_projet_reports_v2');
    localStorage.removeItem('orax_demo_seeded');
    localStorage.removeItem('orax_projects_backup');
  } catch {}
}

// Helper to retrieve environment variable with or without VITE_ prefix (e.g. on Netlify / Vercel)
const getEnvVar = (viteKey: string, shortKey: string): string => {
  const env = (import.meta.env as Record<string, any>) || {};
  const val = env[viteKey] ?? env[shortKey] ?? (typeof process !== 'undefined' && process.env ? (process.env[viteKey] ?? process.env[shortKey]) : '');
  return typeof val === 'string' ? val.trim() : '';
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', 'FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID', 'FIREBASE_APP_ID'),
};

/**
 * Returns whether Firebase has minimum required configuration to operate
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey && 
    firebaseConfig.projectId &&
    firebaseConfig.apiKey.length > 5 &&
    firebaseConfig.projectId.length > 2
  );
}

/**
 * Validates the Firebase configuration and outputs a single formatted diagnostic notice.
 */
let hasLoggedConfigDiagnostic = false;
export function validateAndLogFirebaseConfig(): void {
  if (hasLoggedConfigDiagnostic || typeof window === 'undefined') return;
  hasLoggedConfigDiagnostic = true;

  const diagnostic = getFirebaseConfigDiagnostic();
  if (diagnostic.status === 'unconfigured') {
    console.warn(
      '%c[ORAX Cloud Engine]%c Configuration Firebase requise. Configurez les variables VITE_FIREBASE_* (ou FIREBASE_*) sur Netlify ou dans votre fichier .env.',
      'color: #f59e0b; font-weight: bold;',
      'color: #94a3b8;'
    );
  } else if (diagnostic.status === 'incomplete') {
    console.warn(
      `[ORAX Cloud Engine] Configuration incomplète. Variables manquantes : ${diagnostic.missingVariables.join(', ')}.`
    );
  } else {
    console.info(
      '%c[ORAX Cloud Engine]%c Connecté à Firebase Firestore Cloud : ' + diagnostic.projectId,
      'color: #10b981; font-weight: bold;',
      'color: #94a3b8;'
    );
  }
}

export function getFirebaseConfigDiagnostic(): FirebaseConfigDiagnostic {
  const variables = [
    { name: 'VITE_FIREBASE_API_KEY / FIREBASE_API_KEY', present: Boolean(firebaseConfig.apiKey) },
    { name: 'VITE_FIREBASE_AUTH_DOMAIN / FIREBASE_AUTH_DOMAIN', present: Boolean(firebaseConfig.authDomain) },
    { name: 'VITE_FIREBASE_PROJECT_ID / FIREBASE_PROJECT_ID', present: Boolean(firebaseConfig.projectId) },
    { name: 'VITE_FIREBASE_STORAGE_BUCKET / FIREBASE_STORAGE_BUCKET', present: Boolean(firebaseConfig.storageBucket) },
    { name: 'VITE_FIREBASE_MESSAGING_SENDER_ID / FIREBASE_MESSAGING_SENDER_ID', present: Boolean(firebaseConfig.messagingSenderId) },
    { name: 'VITE_FIREBASE_APP_ID / FIREBASE_APP_ID', present: Boolean(firebaseConfig.appId) },
  ];

  const missingVariables = variables.filter(v => !v.present).map(v => v.name);

  let status: 'connected' | 'incomplete' | 'unconfigured' = 'connected';
  if (missingVariables.length === variables.length) {
    status = 'unconfigured';
  } else if (missingVariables.length > 0) {
    status = 'incomplete';
  }

  return {
    isConfigured: isFirebaseConfigured(),
    status,
    variables,
    missingVariables,
    projectId: firebaseConfig.projectId || undefined,
  };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);

    // Set persistence to browserLocalPersistence
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('Firebase Auth persistence setup notice:', err);
    });

    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentSingleTabManager({ forceOwnership: true }),
        }),
      });
    } catch {
      db = getFirestore(app);
    }
  } catch (err) {
    console.error('Firebase initialization error:', err);
  }
}

// --------------------------------------------------------------------------
// SYNC STATE MANAGEMENT
// --------------------------------------------------------------------------
let currentSyncStatus: CloudSyncState = isFirebaseConfigured() ? 'connecting' : 'offline';
const syncListeners = new Set<(status: CloudSyncState) => void>();

export function getSyncStatus(): CloudSyncState {
  return currentSyncStatus;
}

export function subscribeToSyncStatus(listener: (status: CloudSyncState) => void): () => void {
  syncListeners.add(listener);
  listener(currentSyncStatus);
  return () => {
    syncListeners.delete(listener);
  };
}

function updateSyncStatus(newStatus: CloudSyncState): void {
  if (currentSyncStatus !== newStatus) {
    currentSyncStatus = newStatus;
    syncListeners.forEach((fn) => fn(currentSyncStatus));
  }
}

// --------------------------------------------------------------------------
// ADMIN CONFIGURATION
// --------------------------------------------------------------------------
export const ADMIN_EMAILS = new Set([
  'lorddemon@gmail.com',
  'lorddemon.orax@gmail.com',
  'lorddemon@orax.com',
  'admin@orax.com',
  'fondateur@orax.com'
]);

export function checkIsAdmin(user?: { email?: string; uid?: string } | null): boolean {
  if (!user) return false;
  if (user.uid === 'dev_lord_demon') return true;
  if (user.email && ADMIN_EMAILS.has(user.email.toLowerCase().trim())) {
    return true;
  }
  return false;
}

function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const clean: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        clean[key] = sanitizeForFirestore(value);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean;
}

// Session cache (Only for auth state preservation across page reloads)
const STORAGE_KEY_SESSION_UI = 'orax_projet_cached_session_v3';

function getCachedSession(): UserProfile | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SESSION_UI);
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.isAdmin = checkIsAdmin(parsed);
      return parsed;
    }
  } catch {}
  return null;
}

function saveCachedSession(user: UserProfile | null): void {
  try {
    if (user) {
      user.isAdmin = checkIsAdmin(user);
      localStorage.setItem(STORAGE_KEY_SESSION_UI, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_SESSION_UI);
    }
  } catch {}
}

export function clearUserPrivateCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_SESSION_UI);
  } catch {}
}

// --------------------------------------------------------------------------
// AUTHENTICATION ERROR HANDLING
// --------------------------------------------------------------------------
export function formatAuthErrorMessage(error: any): string {
  const code = error?.code || '';
  const msg = error?.message || '';

  if (code.includes('auth/invalid-email') || msg.includes('invalid-email')) {
    return 'L\'adresse email saisie est invalide. Veuillez vérifier le format.';
  }
  if (code.includes('auth/user-not-found') || msg.includes('user-not-found')) {
    return 'Aucun compte associé à cette adresse email.';
  }
  if (code.includes('auth/wrong-password') || msg.includes('wrong-password') || code.includes('auth/invalid-credential')) {
    return 'Email ou mot de passe incorrect.';
  }
  if (code.includes('auth/email-already-in-use') || msg.includes('email-already-in-use')) {
    return 'Cette adresse email est déjà enregistrée. Veuillez vous connecter.';
  }
  if (code.includes('auth/weak-password') || msg.includes('weak-password')) {
    return 'Le mot de passe doit contenir au moins 6 caractères.';
  }
  if (code.includes('auth/too-many-requests') || msg.includes('too-many-requests')) {
    return 'Trop de tentatives infructueuses. Veuillez patienter quelques minutes avant de réessayer.';
  }
  if (code.includes('auth/network-request-failed') || msg.includes('network-request-failed')) {
    return 'Erreur de connexion réseau. Veuillez vérifier votre accès Internet.';
  }
  if (code.includes('auth/configuration-not-found') || msg.includes('configuration-not-found')) {
    return 'Configuration Firebase Auth manquante. Vérifiez vos variables d\'environnement.';
  }

  return msg || 'Une erreur inattendue est survenue lors de l\'authentification.';
}

export async function signUp(email: string, password: string, displayName: string, avatarUrl?: string): Promise<UserProfile> {
  if (!auth || !isFirebaseConfigured()) {
    throw new Error('Configuration Firebase requise pour créer un compte cloud.');
  }

  try {
    updateSyncStatus('syncing');
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const fbUser = userCredential.user;

    const isAdmin = checkIsAdmin({ email, uid: fbUser.uid });
    let finalDisplayName = displayName.trim();
    if (!isAdmin) {
      const lower = finalDisplayName.toLowerCase();
      if (lower.includes('lord demon') || lower.includes('lorddemon') || lower === 'admin' || lower.includes('fondateur orax')) {
        finalDisplayName = email.split('@')[0] || 'Développeur';
      }
    }

    const defaultPhoto = avatarUrl?.trim() || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(finalDisplayName)}`;

    await updateProfile(fbUser, {
      displayName: finalDisplayName,
      photoURL: defaultPhoto,
    });

    const newProfile: UserProfile = {
      uid: fbUser.uid,
      email: fbUser.email || email,
      displayName: finalDisplayName,
      photoURL: defaultPhoto,
      createdAt: new Date().toISOString(),
      isAdmin,
      favorites: [],
      following: [],
      publishedTrophies: [],
      trophiesPrivacy: 'public',
    };

    if (db) {
      await setDoc(doc(db, 'users', fbUser.uid), sanitizeForFirestore(newProfile), { merge: true });
    }

    saveCachedSession(newProfile);
    updateSyncStatus('synced');
    return newProfile;
  } catch (err: any) {
    updateSyncStatus('error');
    throw new Error(formatAuthErrorMessage(err));
  }
}

export async function signIn(email: string, password: string): Promise<UserProfile> {
  if (!auth || !isFirebaseConfigured()) {
    throw new Error('Configuration Firebase requise pour se connecter.');
  }

  try {
    updateSyncStatus('syncing');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const fbUser = userCredential.user;
    const isAdmin = checkIsAdmin({ email: fbUser.email || email, uid: fbUser.uid });

    let profile: UserProfile = {
      uid: fbUser.uid,
      email: fbUser.email || email,
      displayName: fbUser.displayName || email.split('@')[0] || 'Utilisateur',
      photoURL: fbUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(fbUser.displayName || email)}`,
      createdAt: new Date().toISOString(),
      isAdmin,
      favorites: [],
      following: [],
      publishedTrophies: [],
      trophiesPrivacy: 'public',
    };

    if (db) {
      try {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          profile = { ...profile, ...userData, isAdmin, uid: fbUser.uid };
        } else {
          await setDoc(doc(db, 'users', fbUser.uid), sanitizeForFirestore(profile), { merge: true });
        }
      } catch (firestoreErr) {
        console.warn('User profile sync notice:', firestoreErr);
      }
    }

    saveCachedSession(profile);
    updateSyncStatus('synced');
    return profile;
  } catch (err: any) {
    updateSyncStatus('error');
    throw new Error(formatAuthErrorMessage(err));
  }
}

export async function logOut(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
  clearUserPrivateCache();
}

export const registerUser = signUp;
export const loginUser = signIn;

export async function sendPasswordReset(email: string): Promise<void> {
  if (!auth || !isFirebaseConfigured()) {
    throw new Error('Configuration Firebase requise pour réinitialiser le mot de passe.');
  }
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err: any) {
    throw new Error(formatAuthErrorMessage(err));
  }
}

export const resetUserPassword = sendPasswordReset;

export async function updateUserDisplayName(displayName: string): Promise<UserProfile> {
  const currentAuthUser = auth?.currentUser;
  if (!currentAuthUser) {
    throw new Error('Utilisateur non connecté.');
  }

  const cleanName = displayName.trim();
  if (!cleanName) {
    throw new Error('Le nom d\'affichage ne peut pas être vide.');
  }

  const isAdmin = checkIsAdmin({ email: currentAuthUser.email || '', uid: currentAuthUser.uid });
  if (!isAdmin) {
    const lower = cleanName.toLowerCase();
    if (lower.includes('lord demon') || lower.includes('lorddemon') || lower === 'admin' || lower.includes('fondateur orax')) {
      throw new Error('Ce nom d\'affichage est réservé.');
    }
  }

  await updateProfile(currentAuthUser, { displayName: cleanName });

  if (db && isFirebaseConfigured()) {
    await updateDoc(doc(db, 'users', currentAuthUser.uid), {
      displayName: cleanName,
      updatedAt: new Date().toISOString(),
    });
  }

  const currentSession = getCachedSession();
  const updatedProfile: UserProfile = {
    uid: currentAuthUser.uid,
    email: currentAuthUser.email || '',
    displayName: cleanName,
    photoURL: currentAuthUser.photoURL || undefined,
    createdAt: currentSession?.createdAt || new Date().toISOString(),
    isAdmin,
    ...currentSession,
  };

  saveCachedSession(updatedProfile);
  return updatedProfile;
}

export async function updateUserAvatar(photoURL: string): Promise<UserProfile> {
  const currentAuthUser = auth?.currentUser;
  if (!currentAuthUser) {
    throw new Error('Utilisateur non connecté.');
  }

  await updateProfile(currentAuthUser, { photoURL });

  if (db && isFirebaseConfigured()) {
    await updateDoc(doc(db, 'users', currentAuthUser.uid), {
      photoURL,
      updatedAt: new Date().toISOString(),
    });
  }

  const currentSession = getCachedSession();
  const updatedProfile: UserProfile = {
    uid: currentAuthUser.uid,
    email: currentAuthUser.email || '',
    displayName: currentAuthUser.displayName || 'Utilisateur',
    photoURL,
    createdAt: currentSession?.createdAt || new Date().toISOString(),
    isAdmin: checkIsAdmin(currentAuthUser),
    ...currentSession,
  };

  saveCachedSession(updatedProfile);
  return updatedProfile;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 Mo';
  const k = 1024;
  const sizes = ['Octets', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  const currentAuthUser = auth?.currentUser;
  if (!currentAuthUser && !uid) {
    throw new Error('Utilisateur non connecté.');
  }

  const effectiveUid = uid || currentAuthUser?.uid || '';
  const now = new Date().toISOString();

  if (currentAuthUser && updates.displayName) {
    await updateProfile(currentAuthUser, {
      displayName: updates.displayName,
      ...(updates.photoURL ? { photoURL: updates.photoURL } : {})
    });
  }

  if (db && isFirebaseConfigured() && effectiveUid) {
    await updateDoc(doc(db, 'users', effectiveUid), sanitizeForFirestore({
      ...updates,
      updatedAt: now,
    }));
  }

  const currentSession = getCachedSession();
  const updatedProfile: UserProfile = {
    uid: effectiveUid,
    email: currentAuthUser?.email || currentSession?.email || '',
    displayName: updates.displayName || currentSession?.displayName || 'Utilisateur',
    photoURL: updates.photoURL || currentSession?.photoURL,
    bio: updates.bio !== undefined ? updates.bio : currentSession?.bio,
    createdAt: currentSession?.createdAt || now,
    isAdmin: currentSession?.isAdmin || false,
    ...currentSession,
    ...updates,
  };

  saveCachedSession(updatedProfile);
  return updatedProfile;
}

export function onAuthChange(callback: (user: UserProfile | null) => void): () => void {
  const cached = getCachedSession();
  if (cached) {
    callback(cached);
  }

  if (auth && isFirebaseConfigured()) {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const userEmail = fbUser.email || '';
        const isAdmin = checkIsAdmin({ email: userEmail, uid: fbUser.uid });
        const defaultPhotoURL = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(fbUser.displayName || userEmail || 'user')}`;

        let profile: UserProfile = {
          uid: fbUser.uid,
          email: userEmail,
          displayName: fbUser.displayName || userEmail.split('@')[0] || 'Utilisateur',
          photoURL: fbUser.photoURL || defaultPhotoURL,
          createdAt: new Date().toISOString(),
          isAdmin,
          favorites: [],
          following: [],
          publishedTrophies: [],
          trophiesPrivacy: 'public',
        };

        if (db) {
          try {
            const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
            if (auth?.currentUser?.uid !== fbUser.uid) return;
            if (userDoc.exists()) {
              const userData = userDoc.data() as UserProfile;
              profile = { ...profile, ...userData, isAdmin, uid: fbUser.uid };
            } else {
              await setDoc(doc(db, 'users', fbUser.uid), sanitizeForFirestore(profile), { merge: true });
            }
          } catch {}
        }
        profile.isAdmin = isAdmin;

        saveCachedSession(profile);
        callback(profile);
      } else {
        clearUserPrivateCache();
        callback(null);
      }
    });
  }

  if (!cached) {
    callback(null);
  }
  return () => {};
}

export const subscribeToAuth = onAuthChange;
export const logoutUser = logOut;

// --------------------------------------------------------------------------
// POPULARITY ALGORITHM
// --------------------------------------------------------------------------
export function calculatePopularityScore(project: Project): number {
  const downloads = project.downloads || 0;
  const views = project.views || 0;
  const createdTime = new Date(project.createdAt || Date.now()).getTime();
  const daysSinceCreation = Math.max(0, (Date.now() - createdTime) / (1000 * 60 * 60 * 24));
  const recencyFactor = Math.max(0.3, 1 / (1 + daysSinceCreation * 0.03));
  const baseScore = (downloads * 3 + views * 1) * recencyFactor;
  const featuredBonus = project.featured ? 25 : 0;
  return Math.round(baseScore + featuredBonus);
}

// --------------------------------------------------------------------------
// FIRESTORE CLOUD PROJECT SERVICES (100% Cloud Authoritative)
// --------------------------------------------------------------------------
const DEMO_PROJECT_IDS = new Set([
  'orax-bot-v2',
  'cyber-shield-scanner',
  'nexus-ai-studio',
  'pulse-finance-app',
  'hyper-commerce-saas',
  'cyber-rogue-game',
  'devops-automation-toolkit',
  'electron-markdown-studio'
]);

export function deduplicateProjects(projects: Project[]): Project[] {
  const seen = new Set<string>();
  const unique: Project[] = [];
  for (const p of projects) {
    if (p && p.id && !DEMO_PROJECT_IDS.has(p.id) && !seen.has(p.id)) {
      seen.add(p.id);
      unique.push(p);
    }
  }
  return unique;
}

const PROJECTS_CHANGE_EVENT = 'orax_projects_changed';
export function broadcastProjectsChange(projects: Project[]): void {
  if (typeof window !== 'undefined') {
    const unique = deduplicateProjects(projects);
    window.dispatchEvent(new CustomEvent(PROJECTS_CHANGE_EVENT, { detail: unique }));
  }
}

export interface SubscribeProjectsOptions {
  isAdmin?: boolean;
  userId?: string;
  limitCount?: number;
}

export function generateSearchTokens(data: {
  name?: string;
  description?: string;
  shortDescription?: string;
  developerName?: string;
  category?: string;
  technologies?: string[];
  tags?: string[];
}): string[] {
  const tokenSet = new Set<string>();

  const addTokensFromText = (text?: string) => {
    if (!text) return;
    const clean = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ');

    const words = clean.split(/\s+/).filter(w => w.length >= 2);
    for (const word of words) {
      tokenSet.add(word);
      if (word.length >= 2 && word.length <= 8) {
        for (let i = 2; i <= word.length; i++) {
          tokenSet.add(word.substring(0, i));
        }
      }
    }
  };

  addTokensFromText(data.name);
  addTokensFromText(data.developerName);
  addTokensFromText(data.category);
  if (data.technologies) data.technologies.forEach(t => addTokensFromText(t));
  if (data.tags) data.tags.forEach(t => addTokensFromText(t));
  if (data.shortDescription) addTokensFromText(data.shortDescription);

  return Array.from(tokenSet).slice(0, 80);
}

/**
 * Real-time subscription to cloud projects.
 * Firestore onSnapshot is the sole, authoritative source of truth.
 */
export function subscribeToProjects(
  callback: (projects: Project[]) => void,
  options: SubscribeProjectsOptions = {}
): () => void {
  const maxLimit = options.limitCount || 200;

  if (!db || !isFirebaseConfigured()) {
    updateSyncStatus('offline');
    callback([]);
    return () => {};
  }

  let unsubscribeFirestore: (() => void) | null = null;

  const processSnapshot = (docs: any[]) => {
    const fetched = docs.map((d) => ({ id: d.id, ...d.data() } as Project));
    const visible = options.isAdmin
      ? fetched
      : fetched.filter(p => !p.status || p.status === 'published' || (options.userId && p.ownerId === options.userId));
    const realOnly = deduplicateProjects(visible);
    updateSyncStatus('synced');
    callback(realOnly);
  };

  try {
    updateSyncStatus(navigator.onLine ? 'connecting' : 'offline');

    // Query projects with single-field orderBy (supported natively without composite index requirements)
    const q = query(
      collection(db, 'projects'),
      orderBy('createdAt', 'desc'),
      limit(maxLimit)
    );

    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot) {
          processSnapshot(snapshot.docs);
        }
      },
      (err) => {
        console.warn('Primary onSnapshot notice, activating resilient collection fallback:', err);
        try {
          const fallbackQ = query(collection(db, 'projects'), limit(maxLimit));
          unsubscribeFirestore = onSnapshot(
            fallbackQ,
            (fallbackSnapshot) => {
              if (fallbackSnapshot) {
                const docs = [...fallbackSnapshot.docs];
                docs.sort((a, b) => {
                  const timeA = new Date(a.data()?.createdAt || 0).getTime();
                  const timeB = new Date(b.data()?.createdAt || 0).getTime();
                  return timeB - timeA;
                });
                processSnapshot(docs);
              }
            },
            (fallbackErr) => {
              console.error('Firestore fallback snapshot error:', fallbackErr);
              updateSyncStatus(navigator.onLine ? 'error' : 'offline');
              callback([]);
            }
          );
        } catch (fbInitErr) {
          console.error('Firestore fallback init error:', fbInitErr);
          updateSyncStatus(navigator.onLine ? 'error' : 'offline');
          callback([]);
        }
      }
    );
  } catch (err) {
    console.warn('Firestore onSnapshot init error, fallbacking:', err);
    try {
      const fallbackQ = query(collection(db, 'projects'), limit(maxLimit));
      unsubscribeFirestore = onSnapshot(
        fallbackQ,
        (fallbackSnapshot) => {
          if (fallbackSnapshot) {
            processSnapshot(fallbackSnapshot.docs);
          }
        },
        () => {
          updateSyncStatus(navigator.onLine ? 'error' : 'offline');
          callback([]);
        }
      );
    } catch {
      updateSyncStatus(navigator.onLine ? 'error' : 'offline');
      callback([]);
    }
  }

  return () => {
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
}

export async function getProjects(options: SubscribeProjectsOptions = {}): Promise<Project[]> {
  if (!db || !isFirebaseConfigured()) {
    updateSyncStatus('offline');
    return [];
  }

  const maxLimit = options.limitCount || 200;

  const processDocs = (docs: any[]): Project[] => {
    const fetched = docs.map(d => ({ id: d.id, ...d.data() } as Project));
    const visible = options.isAdmin
      ? fetched
      : fetched.filter(p => !p.status || p.status === 'published' || (options.userId && p.ownerId === options.userId));
    const realOnly = deduplicateProjects(visible);
    updateSyncStatus('synced');
    return realOnly;
  };

  try {
    updateSyncStatus('syncing');
    try {
      const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'), limit(maxLimit));
      const snapshot = await getDocs(q);
      if (snapshot) {
        return processDocs(snapshot.docs);
      }
    } catch (primaryErr) {
      console.warn('Primary getProjects query notice, using fallback:', primaryErr);
      const fallbackQ = query(collection(db, 'projects'), limit(maxLimit));
      const snapshot = await getDocs(fallbackQ);
      if (snapshot) {
        const docs = [...snapshot.docs];
        docs.sort((a, b) => {
          const timeA = new Date(a.data()?.createdAt || 0).getTime();
          const timeB = new Date(b.data()?.createdAt || 0).getTime();
          return timeB - timeA;
        });
        return processDocs(docs);
      }
    }
  } catch (err) {
    updateSyncStatus(navigator.onLine ? 'error' : 'offline');
    console.warn('Firestore getProjects network notice:', err);
  }

  return [];
}

export interface FetchPaginatedOptions {
  pageSize?: number;
  lastDoc?: DocumentSnapshot | null;
  filters?: Partial<FilterOptions>;
  isAdmin?: boolean;
  userId?: string;
}

export async function getPaginatedProjects(
  options: FetchPaginatedOptions = {}
): Promise<PaginatedProjectsResult> {
  const {
    pageSize = 12,
    lastDoc = null,
    filters = {},
    isAdmin = false,
  } = options;

  const normalize = (str: string) =>
    str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  if (!db || !isFirebaseConfigured()) {
    updateSyncStatus('offline');
    return {
      projects: [],
      hasMore: false,
      lastDocSnapshot: null,
      totalEstimate: 0,
    };
  }

  try {
    updateSyncStatus('syncing');
    const projectsCol = collection(db, 'projects');
    const queryConstraints: any[] = [];

    if (!isAdmin) {
      queryConstraints.push(where('status', '==', 'published'));
    }

    if (filters.category && filters.category !== 'all') {
      queryConstraints.push(where('category', '==', filters.category));
    }

    let appliedArrayFilter = false;
    const cleanSearch = filters.search?.trim();

    if (filters.technology && filters.technology !== 'all') {
      queryConstraints.push(where('technologies', 'array-contains', filters.technology));
      appliedArrayFilter = true;
    } else if (filters.tag && filters.tag !== 'all') {
      queryConstraints.push(where('tags', 'array-contains', filters.tag));
      appliedArrayFilter = true;
    } else if (cleanSearch && !cleanSearch.includes(' ') && cleanSearch.length >= 2) {
      const searchToken = normalize(cleanSearch);
      queryConstraints.push(where('searchKeywords', 'array-contains', searchToken));
      appliedArrayFilter = true;
    }

    switch (filters.sortBy) {
      case 'downloads':
        queryConstraints.push(orderBy('downloads', 'desc'));
        queryConstraints.push(orderBy('createdAt', 'desc'));
        break;
      case 'oldest':
        queryConstraints.push(orderBy('createdAt', 'asc'));
        break;
      case 'alpha':
        queryConstraints.push(orderBy('name', 'asc'));
        queryConstraints.push(orderBy('createdAt', 'desc'));
        break;
      case 'rating':
        queryConstraints.push(orderBy('rating', 'desc'));
        queryConstraints.push(orderBy('ratingsCount', 'desc'));
        queryConstraints.push(orderBy('createdAt', 'desc'));
        break;
      case 'popular':
        queryConstraints.push(orderBy('views', 'desc'));
        queryConstraints.push(orderBy('downloads', 'desc'));
        queryConstraints.push(orderBy('createdAt', 'desc'));
        break;
      case 'recent':
      default:
        queryConstraints.push(orderBy('createdAt', 'desc'));
        break;
    }

    if (lastDoc) {
      queryConstraints.push(startAfter(lastDoc));
    }

    queryConstraints.push(limit(pageSize + 1));

    const q = query(projectsCol, ...queryConstraints);
    const snapshot = await getDocs(q);

    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const validDocs = hasMore ? docs.slice(0, pageSize) : docs;
    const lastDocSnapshot = validDocs.length > 0 ? validDocs[validDocs.length - 1] : null;

    let pageProjects = validDocs.map(d => ({ id: d.id, ...d.data() } as Project));
    pageProjects = deduplicateProjects(pageProjects);

    if (filters.technology && filters.technology !== 'all' && !appliedArrayFilter) {
      const techLower = filters.technology.toLowerCase();
      pageProjects = pageProjects.filter(p => p.technologies.some(t => t.toLowerCase() === techLower));
    }
    if (filters.tag && filters.tag !== 'all' && (!appliedArrayFilter || filters.technology !== 'all')) {
      const tagLower = filters.tag.toLowerCase();
      pageProjects = pageProjects.filter(p => p.tags.some(t => t.toLowerCase() === tagLower));
    }
    if (cleanSearch) {
      const tokens = normalize(cleanSearch).split(/\s+/).filter(Boolean);
      pageProjects = pageProjects.filter(p => {
        const haystack = normalize(
          `${p.name} ${p.developerName} ${p.shortDescription || ''} ${p.description} ${p.category} ${p.technologies.join(' ')} ${p.tags.join(' ')}`
        );
        return tokens.every(tok => haystack.includes(tok));
      });
    }

    updateSyncStatus(navigator.onLine ? 'synced' : 'offline');

    return {
      projects: pageProjects,
      hasMore,
      lastDocSnapshot
    };
  } catch (err: any) {
    updateSyncStatus(navigator.onLine ? 'error' : 'offline');
    console.warn('Firestore getPaginatedProjects network notice:', err);
    return {
      projects: [],
      hasMore: false,
      lastDocSnapshot: null
    };
  }
}

export async function getProjectById(id: string): Promise<Project | null> {
  if (db && isFirebaseConfigured()) {
    try {
      const docRef = doc(db, 'projects', id);
      const snapshot = await getDoc(docRef);
      if (snapshot && snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() } as Project;
      }
    } catch (err) {
      console.warn('Firestore getProjectById notice:', err);
    }
  }
  return null;
}

export function subscribeToProjectById(
  projectId: string,
  callback: (project: Project | null) => void
): () => void {
  if (!db || !isFirebaseConfigured() || !projectId) {
    callback(null);
    return () => {};
  }

  try {
    const docRef = doc(db, 'projects', projectId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot && snapshot.exists()) {
          const live = { id: snapshot.id, ...snapshot.data() } as Project;
          callback(live);
        } else {
          callback(null);
        }
      },
      (err) => {
        console.warn('Firestore subscribeToProjectById notice:', err);
        callback(null);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Firestore subscribeToProjectById init error:', err);
    callback(null);
    return () => {};
  }
}

export function generateProjectSlug(name: string, id: string): string {
  const cleanName = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const shortId = id.substring(id.length - 6);
  return `${cleanName || 'projet'}-${shortId}`;
}

export async function saveNewProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'downloads' | 'views'>): Promise<Project> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error('Configuration Firebase manquante : Impossible de publier sans les variables VITE_FIREBASE_* configurées.');
  }

  const currentAuthUser = auth?.currentUser;
  if (!currentAuthUser) {
    throw new Error('Vous devez être authentifié avec votre compte pour publier un projet dans le Cloud.');
  }

  const verifiedOwnerId = currentAuthUser.uid;
  const newId = `orax_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const slug = generateProjectSlug(projectData.name, newId);
  const isAdmin = checkIsAdmin({ email: currentAuthUser.email || '', uid: verifiedOwnerId });

  let developerName = (projectData.developerName || currentAuthUser.displayName || 'Développeur').trim();
  if (!isAdmin) {
    const lower = developerName.toLowerCase();
    if (lower.includes('lord demon') || lower.includes('lorddemon') || lower === 'admin' || lower.includes('fondateur orax')) {
      developerName = currentAuthUser.displayName || 'Développeur';
    }
  }

  const searchKeywords = generateSearchTokens({
    name: projectData.name,
    developerName,
    description: projectData.description,
    shortDescription: projectData.shortDescription,
    category: projectData.category,
    technologies: projectData.technologies,
    tags: projectData.tags,
  });

  const newProject: Project = {
    ...projectData,
    id: newId,
    slug,
    developerName,
    ownerId: verifiedOwnerId,
    ownerEmail: currentAuthUser.email || projectData.ownerEmail || '',
    status: projectData.status || 'published',
    downloads: 0,
    views: 1,
    favoritesCount: 0,
    rating: 0,
    ratingsCount: 0,
    ratings: {},
    viewedBy: [verifiedOwnerId],
    downloadedBy: [],
    searchKeywords,
    createdAt: now,
    updatedAt: now,
  };

  updateSyncStatus('syncing');
  try {
    await setDoc(doc(db, 'projects', newId), sanitizeForFirestore(newProject));
    updateSyncStatus('synced');
  } catch (err: any) {
    updateSyncStatus('error');
    console.error('Erreur Firestore lors de la création du projet:', err);
    throw new Error(`Échec de publication sur Firestore: ${err?.message || 'Erreur inconnue'}`);
  }

  return newProject;
}

export async function updateExistingProject(id: string, updates: Partial<Project>): Promise<Project> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error('Configuration Firebase manquante pour la mise à jour.');
  }

  const authUser = auth?.currentUser;
  if (!authUser) {
    throw new Error('Connexion requise pour modifier un projet.');
  }

  const existingProject = await getProjectById(id);
  if (!existingProject) {
    throw new Error('Projet introuvable sur Firestore.');
  }

  const isAdmin = checkIsAdmin({ email: authUser.email || '', uid: authUser.uid });
  const isOwner = Boolean(existingProject.ownerId === authUser.uid);

  if (!isOwner && !isAdmin) {
    throw new Error('Vous n\'êtes pas autorisé à modifier ce projet.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { 
    ownerId: _ignoredOwnerId, 
    createdAt: _ignoredCreatedAt, 
    id: _ignoredId,
    downloads: _attemptedDownloads,
    views: _attemptedViews,
    rating: _attemptedRating,
    ratingsCount: _attemptedRatingsCount,
    favoritesCount: _attemptedFavs,
    isCertified: _attemptedCert,
    ...cleanUpdates 
  } = updates as any;

  const safeUpdates = isAdmin ? updates : cleanUpdates;
  if (safeUpdates.developerName && !isAdmin) {
    const lower = safeUpdates.developerName.toLowerCase();
    if (lower.includes('lord demon') || lower.includes('lorddemon') || lower === 'admin' || lower.includes('fondateur orax')) {
      delete safeUpdates.developerName;
    }
  }

  const now = new Date().toISOString();
  let newKeywords = safeUpdates.searchKeywords;
  if (
    safeUpdates.name ||
    safeUpdates.description ||
    safeUpdates.shortDescription ||
    safeUpdates.category ||
    safeUpdates.technologies ||
    safeUpdates.tags
  ) {
    newKeywords = generateSearchTokens({
      name: safeUpdates.name || existingProject.name,
      developerName: safeUpdates.developerName || existingProject.developerName,
      description: safeUpdates.description || existingProject.description,
      shortDescription: safeUpdates.shortDescription || existingProject.shortDescription,
      category: safeUpdates.category || existingProject.category,
      technologies: safeUpdates.technologies || existingProject.technologies,
      tags: safeUpdates.tags || existingProject.tags,
    });
  }

  const updatedData: Partial<Project> = { 
    ...safeUpdates,
    ...(newKeywords ? { searchKeywords: newKeywords } : {}),
    updatedAt: now,
  };

  updateSyncStatus('syncing');
  try {
    const docRef = doc(db, 'projects', id);
    await updateDoc(docRef, sanitizeForFirestore(updatedData));
    updateSyncStatus('synced');
  } catch (err: any) {
    updateSyncStatus('error');
    console.error('Erreur Firestore lors de la mise à jour:', err);
    throw new Error(`Échec de la mise à jour Firestore: ${err?.message || 'Erreur inconnue'}`);
  }

  return { ...existingProject, ...updatedData };
}

export async function deleteExistingProject(id: string, userId: string): Promise<boolean> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error('Configuration Firebase manquante pour la suppression.');
  }

  const authUser = auth?.currentUser;
  const project = await getProjectById(id);
  if (!project) {
    throw new Error('Projet introuvable.');
  }

  const isAdmin = authUser ? checkIsAdmin({ email: authUser.email || '', uid: authUser.uid }) : false;
  const isOwner = Boolean((authUser && project.ownerId === authUser.uid) || project.ownerId === userId);

  if (!isOwner && !isAdmin) {
    throw new Error('Vous n\'êtes pas autorisé à supprimer ce projet.');
  }

  updateSyncStatus('syncing');
  try {
    const docRef = doc(db, 'projects', id);
    await deleteDoc(docRef);
    updateSyncStatus('synced');
  } catch (err: any) {
    updateSyncStatus('error');
    console.error('Erreur Firestore lors de la suppression:', err);
    throw new Error(`Échec de la suppression Firestore: ${err?.message || 'Erreur inconnue'}`);
  }

  return true;
}

// --------------------------------------------------------------------------
// UNIQUE VIEW & DOWNLOAD TRACKING PER ACCOUNT / VISITOR
// --------------------------------------------------------------------------
const STORAGE_KEY_GUEST_ID = 'orax_guest_device_id';

export function getVisitorIdentifier(customUserId?: string): string {
  if (customUserId && customUserId.trim()) {
    return customUserId.trim();
  }
  const authUser = auth?.currentUser;
  if (authUser?.uid) {
    return authUser.uid;
  }
  const session = getCachedSession();
  if (session?.uid) {
    return session.uid;
  }
  try {
    let guestId = localStorage.getItem(STORAGE_KEY_GUEST_ID);
    if (!guestId) {
      guestId = `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(STORAGE_KEY_GUEST_ID, guestId);
    }
    return guestId;
  } catch {
    return 'visitor_guest';
  }
}

const recentViewCalls = new Map<string, number>();
const recentDownloadCalls = new Map<string, number>();

export async function recordProjectDownload(
  id: string, 
  customUserId?: string
): Promise<{ downloads: number; isNew: boolean }> {
  // Only authenticated users increment the official download counter
  const authUid = auth?.currentUser?.uid || customUserId;
  if (!authUid) {
    const current = await getProjectById(id);
    return { downloads: current?.downloads || 0, isNew: false };
  }

  const trackerKey = `usr_${authUid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const debounceKey = `${id}_${trackerKey}`;
  const nowMs = Date.now();

  if (recentDownloadCalls.has(debounceKey) && nowMs - (recentDownloadCalls.get(debounceKey) || 0) < 2500) {
    const current = await getProjectById(id);
    return { downloads: current?.downloads || 0, isNew: false };
  }
  recentDownloadCalls.set(debounceKey, nowMs);

  if (db && isFirebaseConfigured()) {
    try {
      const projectRef = doc(db, 'projects', id);
      const downloadTrackRef = doc(db, 'projects', id, 'downloads', trackerKey);

      const result = await runTransaction(db, async (transaction) => {
        const [projectSnap, trackSnap] = await Promise.all([
          transaction.get(projectRef),
          transaction.get(downloadTrackRef),
        ]);

        if (!projectSnap.exists()) {
          throw new Error('Projet introuvable');
        }

        const projectData = projectSnap.data();
        const currentCount = projectData.downloads || 0;

        if (trackSnap.exists()) {
          return { downloads: currentCount, isNew: false };
        }

        const newCount = currentCount + 1;
        const nowIso = new Date().toISOString();

        transaction.set(downloadTrackRef, {
          trackerId: trackerKey,
          createdAt: nowIso,
          type: 'download',
          isVerifiedUser: true,
          userId: authUid,
        });

        transaction.update(projectRef, {
          downloads: newCount,
          updatedAt: nowIso,
        });

        return { downloads: newCount, isNew: true };
      });

      return result;
    } catch (err) {
      console.warn('Firestore recordProjectDownload notice:', err);
    }
  }

  return { downloads: 1, isNew: true };
}

export async function recordProjectView(
  id: string, 
  customUserId?: string
): Promise<{ views: number; isNew: boolean }> {
  // Only authenticated users increment the official view counter
  const authUid = auth?.currentUser?.uid || customUserId;
  if (!authUid) {
    const current = await getProjectById(id);
    return { views: current?.views || 0, isNew: false };
  }

  const trackerKey = `usr_${authUid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const debounceKey = `${id}_${trackerKey}`;
  const nowMs = Date.now();

  if (recentViewCalls.has(debounceKey) && nowMs - (recentViewCalls.get(debounceKey) || 0) < 2500) {
    const current = await getProjectById(id);
    return { views: current?.views || 1, isNew: false };
  }
  recentViewCalls.set(debounceKey, nowMs);

  if (db && isFirebaseConfigured()) {
    try {
      const projectRef = doc(db, 'projects', id);
      const viewTrackRef = doc(db, 'projects', id, 'views', trackerKey);

      const result = await runTransaction(db, async (transaction) => {
        const [projectSnap, trackSnap] = await Promise.all([
          transaction.get(projectRef),
          transaction.get(viewTrackRef),
        ]);

        if (!projectSnap.exists()) {
          throw new Error('Projet introuvable');
        }

        const projectData = projectSnap.data();
        const currentCount = projectData.views || 0;

        if (trackSnap.exists()) {
          return { views: currentCount, isNew: false };
        }

        const newCount = currentCount + 1;
        const nowIso = new Date().toISOString();

        transaction.set(viewTrackRef, {
          trackerId: trackerKey,
          createdAt: nowIso,
          type: 'view',
          isVerifiedUser: true,
          userId: authUid,
        });

        transaction.update(projectRef, {
          views: newCount,
          updatedAt: nowIso,
        });

        return { views: newCount, isNew: true };
      });

      return result;
    } catch (err) {
      console.warn('Firestore recordProjectView notice:', err);
    }
  }

  return { views: 0, isNew: false };
}

// --------------------------------------------------------------------------
// MODERATION & REPORTS SERVICES
// --------------------------------------------------------------------------
export async function submitProjectReport(
  reportData: Omit<ProjectReport, 'id' | 'createdAt' | 'status'>
): Promise<ProjectReport> {
  const currentAuthUser = auth?.currentUser;
  const verifiedReporterId = currentAuthUser?.uid || reportData.reporterId;
  
  if (!verifiedReporterId) {
    throw new Error('Vous devez être authentifié pour signaler un projet.');
  }

  const newId = `report_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newReport: ProjectReport = {
    ...reportData,
    reporterId: verifiedReporterId,
    id: newId,
    status: 'pending',
    createdAt: now,
  };

  if (db && isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'reports', newId), sanitizeForFirestore(newReport));
    } catch (err: any) {
      console.error('Erreur Firestore submitProjectReport:', err);
      throw new Error(`Échec du signalement: ${err?.message || 'Erreur réseau'}`);
    }
  }

  return newReport;
}

export async function getProjectReports(): Promise<ProjectReport[]> {
  const authUser = auth?.currentUser;
  const isAdmin = authUser ? checkIsAdmin({ email: authUser.email || '', uid: authUser.uid }) : false;

  if (db && isFirebaseConfigured() && (!authUser || isAdmin)) {
    try {
      const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      if (snapshot && !snapshot.empty) {
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProjectReport));
      }
    } catch (err) {
      console.warn('Firestore reports fetch notice:', err);
    }
  }
  return [];
}

export async function updateReportStatus(reportId: string, status: ReportStatus): Promise<void> {
  const authUser = auth?.currentUser;
  const isAdmin = authUser ? checkIsAdmin({ email: authUser.email || '', uid: authUser.uid }) : false;

  if (authUser && !isAdmin) {
    throw new Error('Seul l\'administrateur peut modifier le statut d\'un signalement.');
  }

  if (db && isFirebaseConfigured()) {
    try {
      const docRef = doc(db, 'reports', reportId);
      await updateDoc(docRef, { status, updatedAt: new Date().toISOString() });
    } catch (err: any) {
      console.error('Firestore report status update error:', err);
      throw new Error(`Échec de la mise à jour du statut: ${err?.message || 'Erreur réseau'}`);
    }
  }
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
  await updateExistingProject(projectId, { status });
}

// --------------------------------------------------------------------------
// RATINGS & REVIEWS SERVICES (1 to 5 Stars System)
// --------------------------------------------------------------------------
export interface RatingDistribution {
  total: number;
  average: number;
  counts: { 1: number; 2: number; 3: number; 4: number; 5: number };
  percentages: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

export function getProjectRatingDistribution(project: Project | null | undefined): RatingDistribution {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (!project) {
    return {
      total: 0,
      average: 0,
      counts,
      percentages: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  const ratingsMap = project.ratings || {};
  const scores = Object.values(ratingsMap);

  if (scores.length > 0) {
    scores.forEach((val) => {
      const rounded = Math.max(1, Math.min(5, Math.round(val))) as 1 | 2 | 3 | 4 | 5;
      counts[rounded] = (counts[rounded] || 0) + 1;
    });
  } else if (project.rating && project.rating > 0 && project.ratingsCount && project.ratingsCount > 0) {
    const rounded = Math.max(1, Math.min(5, Math.round(project.rating))) as 1 | 2 | 3 | 4 | 5;
    counts[rounded] = project.ratingsCount;
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const sum = (counts[1] * 1) + (counts[2] * 2) + (counts[3] * 3) + (counts[4] * 4) + (counts[5] * 5);
  const average = total > 0 ? parseFloat((sum / total).toFixed(1)) : 0;

  const percentages = {
    5: total > 0 ? Math.round((counts[5] / total) * 100) : 0,
    4: total > 0 ? Math.round((counts[4] / total) * 100) : 0,
    3: total > 0 ? Math.round((counts[3] / total) * 100) : 0,
    2: total > 0 ? Math.round((counts[2] / total) * 100) : 0,
    1: total > 0 ? Math.round((counts[1] / total) * 100) : 0,
  };

  return {
    total,
    average,
    counts,
    percentages,
  };
}

export async function rateProject(
  projectId: string,
  score: number,
  user: UserProfile
): Promise<{ rating: number; ratingsCount: number; userRating: number; distribution: RatingDistribution }> {
  const cleanScore = Math.max(1, Math.min(5, Math.round(score)));

  if (!db || !isFirebaseConfigured()) {
    throw new Error('Configuration Firebase requise pour noter un projet.');
  }

  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error('Projet introuvable.');
  }

  const currentRatings: Record<string, number> = { ...(project.ratings || {}) };
  currentRatings[user.uid] = cleanScore;

  const totalScores = Object.values(currentRatings);
  const count = totalScores.length;
  const avg = count > 0 ? parseFloat((totalScores.reduce((a, b) => a + b, 0) / count).toFixed(1)) : cleanScore;

  updateSyncStatus('syncing');
  try {
    const projectRef = doc(db, 'projects', projectId);
    const ratingDocRef = doc(db, 'projects', projectId, 'ratings', user.uid);

    await Promise.all([
      setDoc(ratingDocRef, sanitizeForFirestore({
        userId: user.uid,
        userDisplayName: user.displayName,
        rating: cleanScore,
        updatedAt: new Date().toISOString(),
      })),
      updateDoc(projectRef, {
        rating: avg,
        ratingsCount: count,
        [`ratings.${user.uid}`]: cleanScore,
        updatedAt: new Date().toISOString(),
      })
    ]);
    updateSyncStatus('synced');
  } catch (err: any) {
    updateSyncStatus('error');
    console.error('Erreur Firestore rateProject:', err);
    throw new Error(`Échec de l'enregistrement de votre note: ${err?.message || 'Erreur inconnue'}`);
  }

  const updatedProject = {
    ...project,
    rating: avg,
    ratingsCount: count,
    ratings: currentRatings,
  };
  const distribution = getProjectRatingDistribution(updatedProject);
  return { rating: avg, ratingsCount: count, userRating: cleanScore, distribution };
}

export async function deleteProjectRating(
  projectId: string,
  user: UserProfile
): Promise<{ rating: number; ratingsCount: number; distribution: RatingDistribution }> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error('Configuration Firebase requise.');
  }

  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error('Projet introuvable.');
  }

  const currentRatings: Record<string, number> = { ...(project.ratings || {}) };
  delete currentRatings[user.uid];

  const totalScores = Object.values(currentRatings);
  const count = totalScores.length;
  const avg = count > 0 ? parseFloat((totalScores.reduce((a, b) => a + b, 0) / count).toFixed(1)) : 0;

  updateSyncStatus('syncing');
  try {
    const projectRef = doc(db, 'projects', projectId);
    const ratingDocRef = doc(db, 'projects', projectId, 'ratings', user.uid);

    await Promise.all([
      deleteDoc(ratingDocRef),
      updateDoc(projectRef, {
        rating: avg,
        ratingsCount: count,
        ratings: currentRatings,
        updatedAt: new Date().toISOString(),
      })
    ]);
    updateSyncStatus('synced');
  } catch (err: any) {
    updateSyncStatus('error');
    console.error('Erreur Firestore deleteProjectRating:', err);
    throw new Error(`Échec de la suppression de votre note: ${err?.message || 'Erreur inconnue'}`);
  }

  const updatedProject = {
    ...project,
    rating: avg,
    ratingsCount: count,
    ratings: currentRatings,
  };
  const distribution = getProjectRatingDistribution(updatedProject);
  return { rating: avg, ratingsCount: count, distribution };
}

// --------------------------------------------------------------------------
// COMMENTS SERVICES
// --------------------------------------------------------------------------
export async function getProjectComments(projectId: string): Promise<ProjectComment[]> {
  if (db && isFirebaseConfigured() && projectId) {
    try {
      const q = query(
        collection(db, 'projects', projectId, 'comments'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      if (snapshot && !snapshot.empty) {
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProjectComment));
      }
    } catch (err) {
      console.warn('Firestore comments fetch notice:', err);
    }
  }
  return [];
}

export function subscribeToProjectComments(
  projectId: string,
  callback: (comments: ProjectComment[]) => void
): () => void {
  if (!db || !isFirebaseConfigured() || !projectId) {
    callback([]);
    return () => {};
  }

  try {
    const q = query(
      collection(db, 'projects', projectId, 'comments'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot) {
          const comments = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProjectComment));
          callback(comments);
        }
      },
      (err) => {
        console.warn('Firestore comments onSnapshot notice:', err);
        callback([]);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Firestore comments subscription init notice:', err);
    callback([]);
    return () => {};
  }
}

export async function addProjectComment(
  projectId: string,
  content: string,
  user: UserProfile,
  rating?: number
): Promise<ProjectComment> {
  const cleanContent = content.trim();
  if (!cleanContent) {
    throw new Error('Le commentaire ne peut pas être vide.');
  }

  const commentId = `comment_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const isLordDemon = user.displayName.toUpperCase().includes('LORD DEMON') || user.uid === 'dev_lord_demon';

  const newComment: ProjectComment = {
    id: commentId,
    projectId,
    userId: user.uid,
    userDisplayName: user.displayName || 'Utilisateur ORAX',
    userPhotoURL: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.displayName)}`,
    userIsLordDemon: isLordDemon,
    rating: rating ? Math.max(1, Math.min(5, Math.round(rating))) : undefined,
    content: cleanContent,
    createdAt: now,
  };

  if (db && isFirebaseConfigured()) {
    updateSyncStatus('syncing');
    try {
      const commentDocRef = doc(db, 'projects', projectId, 'comments', commentId);
      await setDoc(commentDocRef, sanitizeForFirestore(newComment));
      updateSyncStatus('synced');
    } catch (err: any) {
      updateSyncStatus('error');
      console.error('Erreur Firestore addProjectComment:', err);
      throw new Error(`Échec de la publication de votre commentaire: ${err?.message || 'Erreur inconnue'}`);
    }
  }

  if (rating) {
    try {
      await rateProject(projectId, rating, user);
    } catch (err) {
      console.warn('Rate project alongside comment warning:', err);
    }
  }

  return newComment;
}

export async function editProjectComment(
  commentId: string,
  projectId: string,
  content: string,
  rating: number | undefined,
  user: UserProfile
): Promise<ProjectComment> {
  const cleanContent = content.trim();
  if (!cleanContent) {
    throw new Error('Le commentaire ne peut pas être vide.');
  }

  if (!db || !isFirebaseConfigured()) {
    throw new Error('Configuration Firebase requise.');
  }

  const commentDocRef = doc(db, 'projects', projectId, 'comments', commentId);
  const snap = await getDoc(commentDocRef);
  if (!snap.exists()) {
    throw new Error('Commentaire introuvable.');
  }

  const existing = { id: snap.id, ...snap.data() } as ProjectComment;
  if (existing.userId !== user.uid && !user.isAdmin) {
    throw new Error('Vous n\'êtes pas autorisé à modifier ce commentaire.');
  }

  const cleanRating = rating ? Math.max(1, Math.min(5, Math.round(rating))) : undefined;
  const updatedComment: ProjectComment = {
    ...existing,
    content: cleanContent,
    rating: cleanRating,
    updatedAt: new Date().toISOString(),
  };

  updateSyncStatus('syncing');
  try {
    await setDoc(commentDocRef, sanitizeForFirestore(updatedComment), { merge: true });
    updateSyncStatus('synced');
  } catch (err: any) {
    updateSyncStatus('error');
    console.error('Erreur Firestore editProjectComment:', err);
    throw new Error(`Échec de la modification du commentaire: ${err?.message || 'Erreur inconnue'}`);
  }

  if (cleanRating) {
    try {
      await rateProject(projectId, cleanRating, user);
    } catch (err) {
      console.warn('Update rate alongside comment warning:', err);
    }
  }

  return updatedComment;
}

export async function toggleCommentHelpful(
  commentId: string,
  projectId: string,
  user: UserProfile
): Promise<{ helpfulCount: number; isHelpful: boolean }> {
  if (!db || !isFirebaseConfigured()) {
    throw new Error('Configuration Firebase requise.');
  }

  const commentDocRef = doc(db, 'projects', projectId, 'comments', commentId);
  const snap = await getDoc(commentDocRef);
  if (!snap.exists()) {
    throw new Error('Commentaire introuvable.');
  }

  const comment = { id: snap.id, ...snap.data() } as ProjectComment;
  const helpfulUsers = Array.from(new Set(comment.helpfulUsers || []));
  const userIdx = helpfulUsers.indexOf(user.uid);
  const isHelpful = userIdx === -1;

  if (isHelpful) {
    helpfulUsers.push(user.uid);
  } else {
    helpfulUsers.splice(userIdx, 1);
  }

  try {
    await updateDoc(commentDocRef, {
      helpfulUsers,
      helpfulCount: helpfulUsers.length,
    });
  } catch (err: any) {
    console.error('Erreur Firestore toggleCommentHelpful:', err);
    throw new Error(`Échec de la mise à jour: ${err?.message || 'Erreur réseau'}`);
  }

  return { helpfulCount: helpfulUsers.length, isHelpful };
}

export async function replyToProjectComment(
  commentId: string,
  projectId: string,
  replyContent: string,
  developerUser: UserProfile
): Promise<ProjectComment> {
  const cleanReply = replyContent.trim();
  if (!cleanReply) {
    throw new Error('La réponse ne peut pas être vide.');
  }

  if (!db || !isFirebaseConfigured()) {
    throw new Error('Configuration Firebase requise.');
  }

  const commentDocRef = doc(db, 'projects', projectId, 'comments', commentId);
  const snap = await getDoc(commentDocRef);
  if (!snap.exists()) {
    throw new Error('Commentaire introuvable.');
  }

  const replyObj = {
    content: cleanReply,
    createdAt: new Date().toISOString(),
    developerName: developerUser.displayName || 'Développeur',
    developerPhotoURL: developerUser.photoURL,
  };

  updateSyncStatus('syncing');
  try {
    await updateDoc(commentDocRef, {
      developerReply: sanitizeForFirestore(replyObj),
    });
    updateSyncStatus('synced');
  } catch (err: any) {
    updateSyncStatus('error');
    console.error('Erreur Firestore replyToProjectComment:', err);
    throw new Error(`Échec de l'envoi de la réponse: ${err?.message || 'Erreur inconnue'}`);
  }

  return { ...snap.data(), id: snap.id, developerReply: replyObj } as ProjectComment;
}

export async function deleteProjectComment(
  commentId: string,
  projectId: string,
  _userId: string,
  _isAdmin?: boolean
): Promise<boolean> {
  if (db && isFirebaseConfigured()) {
    updateSyncStatus('syncing');
    try {
      const commentDocRef = doc(db, 'projects', projectId, 'comments', commentId);
      await deleteDoc(commentDocRef);
      updateSyncStatus('synced');
    } catch (err: any) {
      updateSyncStatus('error');
      console.error('Erreur Firestore deleteProjectComment:', err);
      throw new Error(`Échec de la suppression du commentaire: ${err?.message || 'Erreur inconnue'}`);
    }
  }
  return true;
}

// --------------------------------------------------------------------------
// DEVELOPER FOLLOW & FAVORITES SYSTEM
// --------------------------------------------------------------------------
export function isFollowingDeveloper(developerIdentifier: string, user: UserProfile | null): boolean {
  if (!developerIdentifier || !user?.following) return false;
  const cleanId = developerIdentifier.trim().toLowerCase();
  return user.following.some(f => f.trim().toLowerCase() === cleanId);
}

export async function toggleFollowDeveloper(
  developerIdentifier: string,
  user: UserProfile
): Promise<{ isFollowing: boolean; followingList: string[] }> {
  if (!developerIdentifier || !user) {
    throw new Error('Identifiant ou utilisateur invalide.');
  }

  const cleanTarget = developerIdentifier.trim();
  const currentList = Array.from(new Set(user.following || []));
  const targetLower = cleanTarget.toLowerCase();

  const isCurrentlyFollowing = currentList.some(f => f.toLowerCase() === targetLower);
  let updatedList: string[];

  if (isCurrentlyFollowing) {
    updatedList = currentList.filter(f => f.toLowerCase() !== targetLower);
  } else {
    updatedList = [...currentList, cleanTarget];
  }

  if (db && isFirebaseConfigured() && user.uid) {
    updateSyncStatus('syncing');
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { following: updatedList, updatedAt: new Date().toISOString() });
      updateSyncStatus('synced');
    } catch (err: any) {
      updateSyncStatus('error');
      console.error('Erreur Firestore toggleFollowDeveloper:', err);
      throw new Error(`Échec de la mise à jour du suivi: ${err?.message || 'Erreur inconnue'}`);
    }
  }

  const updatedUser: UserProfile = { ...user, following: updatedList };
  saveCachedSession(updatedUser);

  return { isFollowing: !isCurrentlyFollowing, followingList: updatedList };
}

export function isProjectFavorited(projectId: string, user?: UserProfile | null): boolean {
  if (!projectId || !user?.favorites) return false;
  return user.favorites.includes(projectId);
}

export async function toggleFavoriteProject(
  projectId: string,
  user: UserProfile
): Promise<{ isFavorited: boolean; favorites: string[] }> {
  if (!projectId || !user) {
    throw new Error('Projet ou utilisateur invalide.');
  }

  const currentList = Array.from(new Set(user.favorites || []));
  const isCurrentlyFav = currentList.includes(projectId);
  let updatedList: string[];

  if (isCurrentlyFav) {
    updatedList = currentList.filter(id => id !== projectId);
  } else {
    updatedList = [...currentList, projectId];
  }

  if (db && isFirebaseConfigured()) {
    updateSyncStatus('syncing');
    try {
      const promises: Promise<any>[] = [];
      if (user.uid) {
        const userRef = doc(db, 'users', user.uid);
        promises.push(updateDoc(userRef, { favorites: updatedList, updatedAt: new Date().toISOString() }));
      }
      const projectRef = doc(db, 'projects', projectId);
      promises.push(updateDoc(projectRef, {
        favoritesCount: increment(isCurrentlyFav ? -1 : 1),
      }));

      await Promise.all(promises);
      updateSyncStatus('synced');
    } catch (err: any) {
      updateSyncStatus('error');
      console.error('Erreur Firestore toggleFavoriteProject:', err);
      throw new Error(`Échec de la mise à jour des favoris: ${err?.message || 'Erreur inconnue'}`);
    }
  }

  const updatedUser: UserProfile = { ...user, favorites: updatedList };
  saveCachedSession(updatedUser);

  return { isFavorited: !isCurrentlyFav, favorites: updatedList };
}

export async function getUserProjects(userId: string): Promise<Project[]> {
  if (!db || !isFirebaseConfigured() || !userId) return [];
  try {
    try {
      const q = query(
        collection(db, 'projects'),
        where('ownerId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
    } catch (indexErr) {
      console.warn('getUserProjects compound query notice, using resilient fallback:', indexErr);
      const fallbackQ = query(
        collection(db, 'projects'),
        where('ownerId', '==', userId)
      );
      const snap = await getDocs(fallbackQ);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      docs.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      return docs;
    }
  } catch (err) {
    console.warn('getUserProjects error:', err);
    return [];
  }
}

export async function getUserFavoriteProjects(favorites: string[]): Promise<Project[]> {
  if (!db || !isFirebaseConfigured() || !favorites || favorites.length === 0) return [];
  try {
    const promises = favorites.slice(0, 30).map(id => getProjectById(id));
    const results = await Promise.all(promises);
    return results.filter((p): p is Project => p !== null);
  } catch (err) {
    console.warn('getUserFavoriteProjects error:', err);
    return [];
  }
}

// --------------------------------------------------------------------------
// DEVELOPERS LEADERBOARD & RANKINGS
// --------------------------------------------------------------------------
export function getDevelopersLeaderboard(allProjects: Project[]): DeveloperInfo[] {
  const devMap: Record<string, { name: string; isLord: boolean; projects: Project[] }> = {};

  allProjects.forEach(project => {
    const name = (project.developerName || 'Développeur').trim();
    const isLord =
      project.ownerId === 'dev_lord_demon' ||
      Boolean(project.ownerEmail && ADMIN_EMAILS.has(project.ownerEmail.toLowerCase()));
    const key = isLord ? 'LORD DEMON' : name.toLowerCase();

    if (!devMap[key]) {
      devMap[key] = {
        name: isLord ? 'LORD DEMON' : name,
        isLord,
        projects: [],
      };
    }
    devMap[key].projects.push(project);
  });

  const leaderboard = Object.values(devMap).map(devGroup => {
    const totalDownloads = devGroup.projects.reduce((sum, p) => sum + (p.downloads || 0), 0);
    const totalViews = devGroup.projects.reduce((sum, p) => sum + (p.views || 0), 0);

    let totalScore = 0;
    let totalRatingsCount = 0;
    devGroup.projects.forEach(p => {
      if (p.rating && p.ratingsCount) {
        totalScore += p.rating * p.ratingsCount;
        totalRatingsCount += p.ratingsCount;
      } else if (p.rating && p.rating > 0) {
        totalScore += p.rating;
        totalRatingsCount += 1;
      }
    });

    const avgRating = totalRatingsCount > 0
      ? parseFloat((totalScore / totalRatingsCount).toFixed(1))
      : 0;

    const isCertified = devGroup.isLord || devGroup.projects.some(p => (p.downloads || 0) >= 50 && (p.views || 0) >= 100);

    return {
      id: devGroup.projects[0]?.ownerId || devGroup.name,
      name: devGroup.name,
      role: devGroup.isLord ? 'Fondateur & Développeur' : (isCertified ? 'Développeur Certifié' : 'Développeur'),
      photoURL: devGroup.isLord
        ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80'
        : (devGroup.projects[0]?.thumbnail || undefined),
      bio: devGroup.isLord ? 'Créateur et fondateur de l\'écosystème ORAX PROJET.' : undefined,
      projectsCount: devGroup.projects.length,
      totalDownloads,
      totalViews,
      rating: avgRating,
      ratingsCount: totalRatingsCount,
      followersCount: devGroup.isLord ? 142 : Math.max(1, devGroup.projects.length * 3),
      isLordDemon: devGroup.isLord,
      isCertified,
      projects: devGroup.projects,
    };
  });

  leaderboard.sort((a, b) => {
    if (a.isLordDemon && !b.isLordDemon) return -1;
    if (!a.isLordDemon && b.isLordDemon) return 1;
    return b.totalDownloads - a.totalDownloads;
  });

  return leaderboard;
}

export function getDeveloperInfo(
  developerIdentifier: string,
  allProjects: Project[]
): DeveloperInfo {
  const target = (developerIdentifier || '').trim();
  const targetLower = target.toLowerCase();

  const devProjects = allProjects.filter(p => 
    (p.developerName && p.developerName.toLowerCase() === targetLower) || 
    (p.ownerId && p.ownerId === target)
  );

  const isLordDemon =
    target === 'dev_lord_demon' ||
    devProjects.some(
      (p) =>
        p.ownerId === 'dev_lord_demon' ||
        Boolean(p.ownerEmail && ADMIN_EMAILS.has(p.ownerEmail.toLowerCase()))
    );

  const name = isLordDemon ? 'LORD DEMON' : (devProjects[0]?.developerName || target || 'Développeur');
  const role = isLordDemon ? 'Fondateur & Développeur' : 'Développeur';

  const totalDownloads = devProjects.reduce((sum, p) => sum + (p.downloads || 0), 0);
  const totalViews = devProjects.reduce((sum, p) => sum + (p.views || 0), 0);

  let totalRatingScore = 0;
  let totalRatingsCount = 0;

  devProjects.forEach(p => {
    if (p.rating && p.ratingsCount) {
      totalRatingScore += p.rating * p.ratingsCount;
      totalRatingsCount += p.ratingsCount;
    } else if (p.rating && p.rating > 0) {
      totalRatingScore += p.rating;
      totalRatingsCount += 1;
    }
  });

  const avgRating = totalRatingsCount > 0 
    ? parseFloat((totalRatingScore / totalRatingsCount).toFixed(1)) 
    : 0;

  const fallbackRatingsCount = totalRatingsCount;
  const isCertified = isLordDemon || devProjects.some(p => (p.downloads || 0) >= 50 && (p.views || 0) >= 100);

  return {
    id: devProjects[0]?.ownerId || target,
    name,
    role: isLordDemon ? 'Fondateur & Développeur' : (isCertified ? 'Développeur Certifié' : 'Développeur'),
    photoURL: isLordDemon 
      ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80'
      : (devProjects[0]?.thumbnail || undefined),
    bio: isLordDemon ? 'Créateur et développeur de l\'écosystème ORAX PROJET.' : undefined,
    projectsCount: devProjects.length,
    totalDownloads,
    totalViews,
    rating: avgRating,
    ratingsCount: fallbackRatingsCount,
    followersCount: isLordDemon ? 142 : Math.max(1, devProjects.length * 3),
    isLordDemon,
    isCertified,
    trophiesPrivacy: 'public',
    pinnedTrophyId: isLordDemon ? 'trophy_legendary_lord' : undefined,
    publishedTrophies: isLordDemon ? ['trophy_legendary_lord', 'trophy_verified_creator', 'trophy_download_titan'] : [],
    projects: devProjects,
  };
}

export function getDeveloperTrophiesPrivacy(_developerIdentifier?: string, _ownerId?: string): 'public' | 'private' {
  return 'public';
}

export async function updateTrophiesPrivacy(
  privacy: 'public' | 'private',
  user: UserProfile
): Promise<UserProfile> {
  const updatedUser: UserProfile = {
    ...user,
    trophiesPrivacy: privacy,
  };

  if (db && isFirebaseConfigured() && user.uid) {
    updateSyncStatus('syncing');
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        trophiesPrivacy: privacy,
        updatedAt: new Date().toISOString(),
      });
      updateSyncStatus('synced');
    } catch (err: any) {
      updateSyncStatus('error');
      console.warn('Firestore updateTrophiesPrivacy warning:', err);
    }
  }

  saveCachedSession(updatedUser);
  return updatedUser;
}

export async function togglePublishTrophy(
  trophyId: string,
  user: UserProfile
): Promise<{ isPublished: boolean; user: UserProfile }> {
  const currentList = user.publishedTrophies || [];
  const isAlreadyPublished = currentList.includes(trophyId);
  const updatedPublished = isAlreadyPublished
    ? currentList.filter(id => id !== trophyId)
    : [...currentList, trophyId];

  const updatedUser: UserProfile = {
    ...user,
    publishedTrophies: updatedPublished,
  };

  if (db && isFirebaseConfigured() && user.uid) {
    updateSyncStatus('syncing');
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        publishedTrophies: updatedPublished,
        updatedAt: new Date().toISOString(),
      });
      updateSyncStatus('synced');
    } catch (err: any) {
      updateSyncStatus('error');
      console.warn('Firestore togglePublishTrophy warning:', err);
    }
  }

  saveCachedSession(updatedUser);
  return { isPublished: !isAlreadyPublished, user: updatedUser };
}

export async function setPinnedTrophy(
  trophyId: string | null,
  user: UserProfile
): Promise<UserProfile> {
  const updatedUser: UserProfile = {
    ...user,
    pinnedTrophyId: trophyId || undefined,
  };

  if (db && isFirebaseConfigured() && user.uid) {
    updateSyncStatus('syncing');
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        pinnedTrophyId: trophyId || null,
        updatedAt: new Date().toISOString(),
      });
      updateSyncStatus('synced');
    } catch (err: any) {
      updateSyncStatus('error');
      console.warn('Firestore setPinnedTrophy warning:', err);
    }
  }

  saveCachedSession(updatedUser);
  return updatedUser;
}
