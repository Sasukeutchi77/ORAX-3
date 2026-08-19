import { CloudinaryUploadResult, CloudinaryConfigDiagnostic } from '../types';

// Cloudinary settings strictly from Vite frontend environment variables
// SECURITY NOTE: Never declare or import CLOUDINARY_API_SECRET in the client bundle.
const CLOUD_NAME = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
const UPLOAD_PRESET = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();

// Configurable Limits
export const MAX_FILE_SIZE = 250 * 1024 * 1024; // 250 MB
export const MAX_THUMBNAIL_SIZE = 15 * 1024 * 1024; // 15 MB
export const MAX_AVATAR_SIZE = 10 * 1024 * 1024; // 10 MB

// Exhaustive Allowed Extensions
export const ALLOWED_ARCHIVE_EXTENSIONS = [
  // Archives & Compressed Packages
  '.zip', '.tar', '.tar.gz', '.tgz', '.rar', '.7z', '.gz', '.bz2', '.xz', '.iso',
  // Mobile, Binaries & Executables
  '.apk', '.aab', '.ipa', '.deb', '.rpm', '.appimage', '.exe', '.dmg', '.msi', '.bin',
  // Web & Scripting
  '.js', '.jsx', '.ts', '.tsx', '.py', '.rs', '.go', '.c', '.cpp', '.h', '.hpp', 
  '.java', '.kt', '.dart', '.php', '.rb', '.sh', '.bat', '.ps1', '.lua', '.swift',
  // Data & Documents
  '.json', '.yaml', '.yml', '.xml', '.csv', '.html', '.css', '.scss', '.md', '.txt', '.pdf', '.sql'
];

export const ALLOWED_IMAGE_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.bmp', '.avif'
];

/**
 * Checks if Cloudinary is fully configured via frontend environment variables.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

/**
 * Returns current Cloudinary configuration status (without exposing secrets).
 */
export function getCloudinaryConfig(): { cloudName: string; isConfigured: boolean } {
  return {
    cloudName: CLOUD_NAME,
    isConfigured: isCloudinaryConfigured(),
  };
}

/**
 * Diagnostic tool for Cloudinary frontend environment variables.
 * NEVER exposes secret keys.
 */
export function getCloudinaryConfigDiagnostic(): CloudinaryConfigDiagnostic {
  const vars = [
    { name: 'VITE_CLOUDINARY_CLOUD_NAME', present: Boolean(CLOUD_NAME) },
    { name: 'VITE_CLOUDINARY_UPLOAD_PRESET', present: Boolean(UPLOAD_PRESET) },
  ];

  const missingVariables = vars.filter((v) => !v.present).map((v) => v.name);
  const isConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

  let status: 'connected' | 'incomplete' | 'unconfigured' = 'unconfigured';
  if (missingVariables.length === 0) {
    status = 'connected';
  } else if (CLOUD_NAME || UPLOAD_PRESET) {
    status = 'incomplete';
  }

  return {
    isConfigured,
    status,
    variables: vars,
    missingVariables,
    cloudName: CLOUD_NAME || undefined,
    uploadPreset: UPLOAD_PRESET ? `${UPLOAD_PRESET.substring(0, 3)}***` : undefined,
  };
}

/**
 * Formats byte size into human-readable representation (e.g. "12.4 MB").
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Translates Cloudinary HTTP errors into clear, actionable messages in French.
 */
export function translateCloudinaryError(status: number, responseText: string): string {
  let serverMessage = '';
  try {
    const parsed = JSON.parse(responseText);
    serverMessage = parsed.error?.message || '';
  } catch {
    serverMessage = responseText;
  }

  const lower = serverMessage.toLowerCase();

  if (lower.includes('preset') && (lower.includes('unsigned') || lower.includes('not found') || lower.includes('whitelist'))) {
    return `Le preset d'upload Cloudinary "${UPLOAD_PRESET}" est introuvable ou n'est pas configuré en mode 'Unsigned'. Dans la console Cloudinary (Settings > Upload > Upload presets), assurez-vous que "Signing Mode" est défini sur "Unsigned".`;
  }

  if (lower.includes('cloud_name') || lower.includes('invalid cloud') || lower.includes('not found')) {
    return `Le Cloud Name "${CLOUD_NAME}" est invalide ou n'existe pas. Vérifiez la variable VITE_CLOUDINARY_CLOUD_NAME.`;
  }

  if (lower.includes('file size') || lower.includes('exceed') || status === 413) {
    return 'La taille du fichier dépasse la limite maximale autorisée par votre forfait Cloudinary.';
  }

  if (lower.includes('must use api key') || lower.includes('signature') || lower.includes('signed')) {
    return 'Erreur de signature : Veuillez utiliser un upload preset en mode "Unsigned" pour autoriser l\'envoi direct depuis le navigateur sans clé secrète.';
  }

  if (status === 401 || status === 403) {
    return 'Accès refusé par l\'API Cloudinary. Vérifiez que votre preset d\'upload est bien en mode non signé (Unsigned).';
  }

  if (status === 404) {
    return `Ressource ou endpoint Cloudinary introuvable pour le compte "${CLOUD_NAME}".`;
  }

  if (serverMessage) {
    return `Erreur Cloudinary (${status}) : ${serverMessage}`;
  }

  return `Échec du téléversement vers Cloudinary (Code HTTP ${status}). Veuillez vérifier votre connexion.`;
}

/**
 * Validates a project archive, source bundle, or binary file.
 */
export function validateProjectFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Veuillez sélectionner un fichier de projet.' };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'Le fichier sélectionné est vide (0 octet).' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Ce fichier est trop volumineux (${formatFileSize(file.size)}). La taille maximale autorisée est de ${formatFileSize(MAX_FILE_SIZE)}.`,
    };
  }

  const nameLower = file.name.toLowerCase();
  const hasValidExt = ALLOWED_ARCHIVE_EXTENSIONS.some((ext) => nameLower.endsWith(ext));

  if (!hasValidExt) {
    return {
      valid: false,
      error: `Format de fichier non autorisé (${file.name}). Formats acceptés : .zip, .tar.gz, .rar, .7z, .apk, code source, etc.`,
    };
  }

  return { valid: true };
}

/**
 * Validates a project thumbnail image.
 */
export function validateThumbnailFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Veuillez sélectionner une image de miniature.' };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'L\'image sélectionnée est vide (0 octet).' };
  }

  if (file.size > MAX_THUMBNAIL_SIZE) {
    return {
      valid: false,
      error: `L'image dépasse la taille maximale autorisée (${formatFileSize(MAX_THUMBNAIL_SIZE)}).`,
    };
  }

  const nameLower = file.name.toLowerCase();
  const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.some((ext) => nameLower.endsWith(ext));

  if (!hasValidExt && !file.type.startsWith('image/')) {
    return {
      valid: false,
      error: `Format d'image non valide. Formats acceptés : PNG, JPG, JPEG, WEBP, GIF, SVG, AVIF.`,
    };
  }

  return { valid: true };
}

/**
 * Validates a user profile avatar image.
 */
export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Veuillez sélectionner une photo de profil.' };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'La photo sélectionnée est vide (0 octet).' };
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return {
      valid: false,
      error: `La photo dépasse la taille maximale autorisée (${formatFileSize(MAX_AVATAR_SIZE)}).`,
    };
  }

  const nameLower = file.name.toLowerCase();
  const hasValidExt = ALLOWED_IMAGE_EXTENSIONS.some((ext) => nameLower.endsWith(ext));

  if (!hasValidExt && !file.type.startsWith('image/')) {
    return {
      valid: false,
      error: `Format d'image non valide pour la photo de profil (PNG, JPG, WEBP).`,
    };
  }

  return { valid: true };
}

export interface UploadOptions {
  onProgress?: (progress: number) => void;
  resourceType?: 'auto' | 'image' | 'raw';
  folderName?: string;
  signal?: AbortSignal;
}

/**
 * Uploads a file (archive, code, binary, or image) directly to Cloudinary from browser via unsigned upload.
 * Strictly respects unsigned mode, provides real-time progress callbacks (0-100%),
 * supports AbortSignal cancellation, handles network timeouts and errors gracefully.
 */
export async function uploadToCloudinary(
  file: File,
  onProgressOrOptions?: ((progress: number) => void) | UploadOptions,
  resourceTypeArg: 'auto' | 'image' | 'raw' = 'auto',
  folderNameArg: string = 'orax_projects'
): Promise<CloudinaryUploadResult> {
  // Normalize arguments for flexible usage
  let onProgress: ((progress: number) => void) | undefined;
  let resourceType: 'auto' | 'image' | 'raw' = resourceTypeArg;
  let folderName: string = folderNameArg;
  let signal: AbortSignal | undefined;

  if (typeof onProgressOrOptions === 'function') {
    onProgress = onProgressOrOptions;
  } else if (onProgressOrOptions && typeof onProgressOrOptions === 'object') {
    onProgress = onProgressOrOptions.onProgress;
    resourceType = onProgressOrOptions.resourceType || resourceTypeArg;
    folderName = onProgressOrOptions.folderName || folderNameArg;
    signal = onProgressOrOptions.signal;
  }

  // 1. Check if already aborted before starting
  if (signal?.aborted) {
    throw new DOMException('Téléversement annulé par l\'utilisateur.', 'AbortError');
  }

  // 2. Real Cloudinary Unsigned Upload
  if (isCloudinaryConfigured()) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Listen for abort signal
      const onAbort = () => {
        xhr.abort();
        reject(new DOMException('Téléversement annulé par l\'utilisateur.', 'AbortError'));
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      // Determine correct Cloudinary resource endpoint:
      // - 'image' for visual media
      // - 'raw' for zip, archives, bin, source code, apks
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(file.name);
      const effectiveType = resourceType === 'auto' ? (isImage ? 'image' : 'raw') : resourceType;

      const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUD_NAME)}/${effectiveType}/upload`;
      const formData = new FormData();

      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      if (folderName) {
        formData.append('folder', folderName);
      }

      xhr.open('POST', url, true);
      xhr.timeout = 300000; // 5 minutes timeout

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (onProgress) onProgress(100);

            // Ensure HTTPS URL
            let fileUrl = response.secure_url || response.url;
            if (fileUrl && fileUrl.startsWith('http://')) {
              fileUrl = fileUrl.replace('http://', 'https://');
            }

            if (!fileUrl) {
              reject(new Error('Cloudinary a validé la réception mais n\'a pas retourné d\'URL accessible.'));
              return;
            }

            resolve({
              url: fileUrl,
              publicId: response.public_id || '',
              bytes: Number(response.bytes) || file.size,
              format: response.format || file.name.split('.').pop() || (isImage ? 'png' : 'zip'),
              originalFilename: response.original_filename || file.name,
            });
          } catch {
            reject(new Error('Réponse du serveur Cloudinary invalide.'));
          }
        } else {
          const errorMsg = translateCloudinaryError(xhr.status, xhr.responseText);
          reject(new Error(errorMsg));
        }
      };

      xhr.ontimeout = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(new Error('Délai d\'attente dépassé (5 min) lors de l\'envoi vers Cloudinary. Veuillez vérifier votre connexion internet.'));
      };

      xhr.onerror = () => {
        if (signal) signal.removeEventListener('abort', onAbort);
        if (!navigator.onLine) {
          reject(new Error('Vous êtes actuellement hors connexion. Impossible de joindre les serveurs Cloudinary.'));
        } else {
          reject(new Error('Erreur de communication réseau avec l\'API Cloudinary. Vérifiez la configuration CORS ou le nom de cloud.'));
        }
      };

      xhr.onabort = () => {
        reject(new DOMException('Téléversement annulé.', 'AbortError'));
      };

      xhr.send(formData);
    });
  }

  // 3. Reject if Cloudinary is not configured - Never use local mock blob URLs
  throw new Error(
    'Configuration Cloudinary absente : Les variables d\'environnement VITE_CLOUDINARY_CLOUD_NAME et VITE_CLOUDINARY_UPLOAD_PRESET doivent être configurées (ex. sur Netlify) pour téléverser de véritables fichiers partagés dans le cloud.'
  );
}

/**
 * Uploads an avatar image specifically to Cloudinary
 */
export async function uploadAvatarToCloudinary(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const validation = validateAvatarFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Photo de profil invalide.');
  }

  const result = await uploadToCloudinary(file, {
    onProgress,
    resourceType: 'image',
    folderName: 'orax_avatars',
  });
  return result.url;
}
