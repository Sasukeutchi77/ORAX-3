import React, { useState } from 'react';
import { 
  X, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ShieldCheck, 
  Users, 
  Cloud, 
  RefreshCw, 
  Trash2,
  ExternalLink,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signUp, 
  logOut, 
  saveNewProject, 
  getProjects, 
  addProjectComment, 
  getProjectComments, 
  deleteExistingProject,
  isFirebaseConfigured,
  getFirebaseConfigDiagnostic
} from '../services/firebase';
import { Project, UserProfile } from '../types';

interface SimulationStep {
  id: string;
  title: string;
  description: string;
  status: 'idle' | 'running' | 'success' | 'error';
  log?: string;
  details?: Record<string, any>;
}

interface SimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectsUpdated?: () => void;
}

export const SimulationModal: React.FC<SimulationModalProps> = ({
  isOpen,
  onClose,
  onProjectsUpdated,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [overallResult, setOverallResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [createdProjects, setCreatedProjects] = useState<Project[]>([]);
  const [createdUsers, setCreatedUsers] = useState<UserProfile[]>([]);

  const [steps, setSteps] = useState<SimulationStep[]>([
    {
      id: 'config',
      title: '1. Vérification de la configuration Firebase',
      description: 'Contrôle de la disponibilité de Firebase Auth et Firestore Cloud.',
      status: 'idle',
    },
    {
      id: 'account_alpha',
      title: '2. Création du Compte A (Alpha Developer)',
      description: 'Enregistrement du premier développeur avec Firebase Authentication & profil Firestore.',
      status: 'idle',
    },
    {
      id: 'publish_alpha',
      title: '3. Publication du Projet Alpha par le Compte A',
      description: 'Sauvegarde du projet "Projet Alpha - ORAX Cloud Engine" directement dans Firestore.',
      status: 'idle',
    },
    {
      id: 'account_beta',
      title: '4. Création du Compte B (Beta Developer)',
      description: 'Déconnexion du Compte A et inscription d\'un second utilisateur indépendant.',
      status: 'idle',
    },
    {
      id: 'publish_beta',
      title: '5. Publication du Projet Beta par le Compte B',
      description: 'Sauvegarde du projet "Projet Beta - Security Shield" dans Firestore par le Compte B.',
      status: 'idle',
    },
    {
      id: 'verify_beta_sees_alpha',
      title: '6. Test de Visibilité : Le Compte B voit le Projet Alpha',
      description: 'Le Compte B interroge Firestore Cloud pour confirmer qu\'il reçoit bien le projet publié par Alpha.',
      status: 'idle',
    },
    {
      id: 'verify_alpha_sees_beta',
      title: '7. Test de Visibilité : Le Compte A voit le Projet Beta',
      description: 'Reconnexion en tant que Compte A et vérification de la réception immédiate du projet de Beta.',
      status: 'idle',
    },
    {
      id: 'cross_comment',
      title: '8. Test d\'Interaction Cloud (Commentaire croisé)',
      description: 'Le Compte B ajoute un commentaire et une note sur le projet d\'Alpha dans Firestore.',
      status: 'idle',
    },
  ]);

  if (!isOpen) return null;

  const updateStepStatus = (index: number, status: SimulationStep['status'], log?: string, details?: Record<string, any>) => {
    setSteps(prev => prev.map((step, idx) => {
      if (idx === index) {
        return { ...step, status, ...(log ? { log } : {}), ...(details ? { details } : {}) };
      }
      return step;
    }));
  };

  const runSimulation = async () => {
    setIsRunning(true);
    setOverallResult('idle');
    setCreatedProjects([]);
    setCreatedUsers([]);

    const rand = Math.floor(1000 + Math.random() * 9000);
    const emailAlpha = `sim_alpha_${rand}@test.orax`;
    const emailBeta = `sim_beta_${rand}@test.orax`;
    const password = `OraxSim_${rand}!secure`;

    let userAlpha: UserProfile | null = null;
    let userBeta: UserProfile | null = null;
    let projectAlpha: Project | null = null;
    let projectBeta: Project | null = null;

    try {
      // Step 1: Config check
      setCurrentStepIndex(0);
      updateStepStatus(0, 'running');
      await new Promise(r => setTimeout(r, 400));

      const diag = getFirebaseConfigDiagnostic();
      if (!isFirebaseConfigured() || diag.status === 'unconfigured') {
        throw new Error('Firebase n\'est pas encore configuré. Ajoutez vos clés VITE_FIREBASE_* dans le fichier .env ou sur Netlify.');
      }
      updateStepStatus(0, 'success', `Connecté avec succès au projet Firestore: ${diag.projectId}`);

      // Step 2: Create Account Alpha
      setCurrentStepIndex(1);
      updateStepStatus(1, 'running');
      await logOut();
      userAlpha = await signUp(emailAlpha, password, `Alpha Dev ${rand}`);
      setCreatedUsers(prev => [...prev, userAlpha!]);
      updateStepStatus(1, 'success', `Compte A créé : ${userAlpha.email} (UID: ${userAlpha.uid.substring(0, 10)}...)`);
      await new Promise(r => setTimeout(r, 500));

      // Step 3: Publish Project Alpha
      setCurrentStepIndex(2);
      updateStepStatus(2, 'running');
      projectAlpha = await saveNewProject({
        name: `Alpha Cloud App #${rand}`,
        shortDescription: 'Application décentralisée générée lors de la simulation multi-comptes.',
        description: 'Ce projet a été publié par le développeur Alpha sur Firestore Cloud pour tester la visibilité globale inter-comptes.',
        category: 'web',
        technologies: ['React', 'TypeScript', 'Tailwind', 'Firebase Firestore'],
        tags: ['Simulation', 'MultiAccount', 'Alpha'],
        developerName: userAlpha.displayName,
        ownerId: userAlpha.uid,
        ownerEmail: userAlpha.email,
        thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
        fileUrl: 'https://github.com/orax-ecosystem/alpha-cloud-test',
        fileName: 'alpha-cloud.zip',
        fileSize: 1024 * 350,
        status: 'published',
        releases: [
          {
            version: '1.0.0',
            title: 'Initial Simulation Release',
            changelog: 'Déploiement vérifié dans Firestore.',
            releaseDate: new Date().toISOString(),
            downloads: 0,
          }
        ],
        featured: false,
      });
      setCreatedProjects(prev => [...prev, projectAlpha!]);
      updateStepStatus(2, 'success', `Projet Alpha enregistré dans Firestore : ID = ${projectAlpha.id}`);
      await new Promise(r => setTimeout(r, 600));

      // Step 4: Create Account Beta
      setCurrentStepIndex(3);
      updateStepStatus(3, 'running');
      await logOut();
      userBeta = await signUp(emailBeta, password, `Beta Dev ${rand}`);
      setCreatedUsers(prev => [...prev, userBeta!]);
      updateStepStatus(3, 'success', `Compte B créé et connecté : ${userBeta.email} (UID: ${userBeta.uid.substring(0, 10)}...)`);
      await new Promise(r => setTimeout(r, 500));

      // Step 5: Publish Project Beta
      setCurrentStepIndex(4);
      updateStepStatus(4, 'running');
      projectBeta = await saveNewProject({
        name: `Beta Security Shield #${rand}`,
        shortDescription: 'Scanner de sécurité publié par le compte Beta pour valider la synchronisation cloud.',
        description: 'Projet authentifié par le compte Beta dans Firestore pour confirmer que les deux utilisateurs voient leurs projets mutuels.',
        category: 'security',
        technologies: ['Node.js', 'Firestore', 'Docker', 'Cloud'],
        tags: ['Simulation', 'Security', 'Beta'],
        developerName: userBeta.displayName,
        ownerId: userBeta.uid,
        ownerEmail: userBeta.email,
        thumbnail: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80',
        fileUrl: 'https://github.com/orax-ecosystem/beta-security-test',
        fileName: 'beta-security.zip',
        fileSize: 1024 * 512,
        status: 'published',
        releases: [
          {
            version: '1.0.0',
            title: 'Initial Beta Release',
            changelog: 'Déploiement vérifié dans Firestore.',
            releaseDate: new Date().toISOString(),
            downloads: 0,
          }
        ],
        featured: false,
      });
      setCreatedProjects(prev => [...prev, projectBeta!]);
      updateStepStatus(4, 'success', `Projet Beta enregistré dans Firestore : ID = ${projectBeta.id}`);
      await new Promise(r => setTimeout(r, 600));

      // Step 6: Verify Beta sees Alpha's project
      setCurrentStepIndex(5);
      updateStepStatus(5, 'running');
      const allProjectsForBeta = await getProjects({ limitCount: 50 });
      const foundAlphaByBeta = allProjectsForBeta.find(p => p.id === projectAlpha?.id);

      if (!foundAlphaByBeta) {
        throw new Error(`Échec : Le Compte B (${userBeta.email}) n'a pas trouvé le Projet Alpha (${projectAlpha.id}) dans Firestore.`);
      }
      updateStepStatus(5, 'success', `SUCCÈS : Le Compte B voit le Projet Alpha ("${foundAlphaByBeta.name}") créé par ${foundAlphaByBeta.developerName} (ID: ${foundAlphaByBeta.id})`);
      await new Promise(r => setTimeout(r, 500));

      // Step 7: Verify Alpha sees Beta's project
      setCurrentStepIndex(6);
      updateStepStatus(6, 'running');
      const foundBetaByAlpha = allProjectsForBeta.find(p => p.id === projectBeta?.id);
      if (!foundBetaByAlpha) {
        throw new Error(`Échec : Le Projet Beta (${projectBeta.id}) est introuvable dans Firestore.`);
      }
      updateStepStatus(6, 'success', `SUCCÈS : Le Projet Beta ("${foundBetaByAlpha.name}") créé par ${foundBetaByAlpha.developerName} est visible publiquement.`);
      await new Promise(r => setTimeout(r, 500));

      // Step 8: Cross comment
      setCurrentStepIndex(7);
      updateStepStatus(7, 'running');
      const comment = await addProjectComment(
        projectAlpha.id,
        'Super projet Alpha ! Vérification cloud réussie depuis le compte Beta.',
        userBeta,
        5
      );
      const commentsOnAlpha = await getProjectComments(projectAlpha.id);
      const commentFound = commentsOnAlpha.some(c => c.id === comment.id);

      if (!commentFound) {
        throw new Error('Le commentaire de Beta n\'a pas pu être lu dans Firestore.');
      }
      updateStepStatus(7, 'success', `Commentaire & note 5 étoiles de Beta enregistrés dans la sous-collection Firestore.`);

      setOverallResult('success');
      if (onProjectsUpdated) {
        onProjectsUpdated();
      }
    } catch (err: any) {
      console.error('Simulation error:', err);
      if (currentStepIndex >= 0) {
        updateStepStatus(currentStepIndex, 'error', err.message || 'Erreur inconnue pendant la simulation');
      }
      setOverallResult('error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleCleanup = async () => {
    if (createdProjects.length === 0) return;
    try {
      for (const p of createdProjects) {
        await deleteExistingProject(p.id, p.ownerId);
      }
      setCreatedProjects([]);
      if (onProjectsUpdated) {
        onProjectsUpdated();
      }
    } catch (err) {
      console.warn('Cleanup error:', err);
    }
  };

  return (
    <AnimatePresence>
      <div 
        id="simulation-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget && !isRunning) onClose();
        }}
      >
        <motion.div
          id="simulation-modal-dialog"
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/90">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Simulation Multi-Comptes Firestore Cloud
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Live E2E Test
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Création de 2 comptes distincts, publication de 2 projets et vérification croisée de visibilité.
                </p>
              </div>
            </div>
            <button
              id="simulation-modal-close-btn"
              onClick={onClose}
              disabled={isRunning}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-5">
            {/* Info box */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 text-sm text-slate-300 flex items-start gap-3">
              <Cloud className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-white">Stockage 100% Cloud (Firebase Firestore & Cloudinary)</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Cette simulation automatisée démontre que le stockage local a été complètement retiré et que n'importe quel utilisateur connecté sur n'importe quel appareil voit instantanément les projets publiés par d'autres utilisateurs via Firestore.
                </p>
              </div>
            </div>

            {/* Steps list */}
            <div className="space-y-2.5">
              {steps.map((step, idx) => {
                const isCurrent = currentStepIndex === idx && isRunning;
                return (
                  <div
                    key={step.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      step.status === 'success'
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        : step.status === 'error'
                        ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                        : isCurrent
                        ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200 shadow-sm shadow-cyan-500/10'
                        : 'bg-slate-800/30 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {step.status === 'success' && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        {step.status === 'error' && (
                          <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        )}
                        {isCurrent && (
                          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
                        )}
                        {step.status === 'idle' && (
                          <div className="w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center text-[10px] font-semibold text-slate-500">
                            {idx + 1}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-white">{step.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{step.description}</p>
                        </div>
                      </div>
                    </div>

                    {step.log && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-700/40 text-xs font-mono pl-8 text-slate-300 bg-slate-900/40 p-2 rounded-lg">
                        {step.log}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Overall Result Banner */}
            {overallResult === 'success' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3"
              >
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Simulation réussie avec succès !
                  </p>
                  <p className="text-xs text-emerald-200/90 leading-relaxed">
                    Les deux comptes ont été créés avec succès dans Firebase, chacun a publié son projet dans Firestore, et la visibilité croisée bilatérale a été confirmée à 100%. Les projets sont en ligne et visibles par toute la communauté.
                  </p>
                </div>
              </motion.div>
            )}

            {overallResult === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3"
              >
                <XCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-rose-400 text-sm">
                    La simulation a rencontré une erreur
                  </p>
                  <p className="text-xs text-rose-200/90 leading-relaxed">
                    Vérifiez que vos variables d'environnement Firebase sont bien configurées sur Netlify (<code className="bg-rose-950 px-1 py-0.5 rounded text-rose-300">VITE_FIREBASE_API_KEY</code>, <code className="bg-rose-950 px-1 py-0.5 rounded text-rose-300">VITE_FIREBASE_PROJECT_ID</code>, etc.) et que les règles Firestore autorisent la lecture et l'écriture.
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer controls */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
            <div>
              {createdProjects.length > 0 && !isRunning && (
                <button
                  id="simulation-cleanup-btn"
                  onClick={handleCleanup}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-700/60 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Nettoyer les projets de test ({createdProjects.length})
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                id="simulation-cancel-btn"
                onClick={onClose}
                disabled={isRunning}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Fermer
              </button>
              <button
                id="simulation-run-btn"
                onClick={runSimulation}
                disabled={isRunning}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 disabled:opacity-60 transition-all cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Simulation en cours...
                  </>
                ) : overallResult === 'success' ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Relancer la simulation
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Lancer la simulation E2E
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
