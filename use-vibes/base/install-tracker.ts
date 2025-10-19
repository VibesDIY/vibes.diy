import { fireproof } from 'use-fireproof';
import {
  generateInstallId,
  constructSubdomain,
  parseSubdomain,
  getAppSlug,
} from './utils/appSlug.js';

// Interface for install documents stored in Fireproof
export interface Install {
  _id: string;
  type: 'instance';
  installId: string;
  appSlug: string;
  appTitle?: string;
  createdAt: string;
  lastVisited: string;
}

// Configuration options for install tracker
export interface VibesInstallTrackerOptions {
  /** App slug - auto-detected from hostname if not provided */
  appSlug?: string;
  /** Auto-redirect to latest install on page load (default: true) */
  autoRedirect?: boolean;
  /** Callback when database is ready and installs are loaded */
  onReady?: (installs: Install[]) => void;
  /** Custom navigation handler - default uses window.location.href */
  onNavigate?: (url: string) => void;
  /** App title for new installs - auto-detected from page if not provided */
  appTitle?: string;
}

// Return type for the install tracker
export interface VibesInstallTrackerResult {
  // Core navigation functions
  goToLatestInstall: () => Promise<void>;
  createNewInstall: () => Promise<void>;
  goToLatestOrCreate: () => Promise<void>;

  // Data access
  getInstalls: () => Promise<Install[]>;
  clearHistory: () => Promise<void>;
  trackVisit: () => Promise<void>;

  // State
  ready: boolean;
  loading: boolean;
  installs: Install[];
  appSlug: string;

  // Cleanup
  destroy: () => void;
}

/**
 * Initialize headless install tracking for a Vibes app
 * Handles database setup, visit tracking, and navigation between installs
 */
export async function initVibesInstalls(
  options: VibesInstallTrackerOptions = {}
): Promise<VibesInstallTrackerResult> {
  const {
    appSlug: providedAppSlug,
    autoRedirect = true,
    onReady,
    onNavigate,
    appTitle: providedAppTitle,
  } = options;

  // Auto-detect app slug from hostname if not provided
  const appSlug = providedAppSlug || getAppSlug();
  const dbName = `${appSlug}-instances`;

  // Initialize Fireproof database
  const database = fireproof(dbName);

  // State management
  let installs: Install[] = [];
  let ready = false;
  let loading = true;
  let destroyed = false;

  // Get app title from DOM if not provided
  const getAppTitle = (): string => {
    if (providedAppTitle) return providedAppTitle;
    const titleElement = document.querySelector('.catalog-title h1, h1, title');
    return titleElement?.textContent || 'Unknown App';
  };

  // Get domain parts for URL construction
  const getDomainInfo = () => {
    const hostname = window.location.hostname;
    const domain = hostname.split('.').slice(1).join('.');
    return { hostname, domain };
  };

  // Navigate to a URL (use custom handler or default)
  const navigate = (url: string) => {
    if (onNavigate) {
      onNavigate(url);
    } else {
      window.location.href = url;
    }
  };

  // Load all installs from database
  const loadInstalls = async (): Promise<Install[]> => {
    if (destroyed) return [];

    try {
      const result = await database.allDocs();
      let docs: unknown[] = [];

      // Handle Fireproof response format - use rows with value property
      if (result && result.rows && Array.isArray(result.rows)) {
        docs = result.rows.map((row) => row.value).filter(Boolean);
      }

      // Filter for instance documents and ensure type safety
      const filteredInstalls = docs
        .filter((doc): doc is Install => {
          return (
            doc !== null &&
            typeof doc === 'object' &&
            'type' in doc &&
            (doc as { type: string }).type === 'instance'
          );
        })
        .map((doc) => {
          const installDoc = doc as Install;
          return {
            _id: installDoc._id,
            type: 'instance' as const,
            installId: installDoc.installId,
            appSlug: installDoc.appSlug,
            appTitle: installDoc.appTitle,
            createdAt: installDoc.createdAt,
            lastVisited: installDoc.lastVisited,
          };
        });

      installs = filteredInstalls;
      return filteredInstalls;
    } catch (error) {
      console.error('Failed to load installs:', error);
      return [];
    }
  };

  // Save an install to the database
  const saveInstall = async (installId: string, appTitle: string): Promise<void> => {
    if (destroyed) return;

    try {
      const installDoc: Install = {
        _id: `instance-${installId}`,
        type: 'instance',
        installId,
        appSlug,
        appTitle,
        createdAt: new Date().toISOString(),
        lastVisited: new Date().toISOString(),
      };

      await database.put(installDoc);

      // Reload installs after saving
      await loadInstalls();
    } catch (error) {
      console.error('Failed to save install:', error);
    }
  };

  // Update last visited time for an existing install
  const updateLastVisited = async (install: Install): Promise<void> => {
    if (destroyed) return;

    try {
      const updatedInstall = {
        ...install,
        lastVisited: new Date().toISOString(),
      };

      await database.put(updatedInstall);

      // Reload installs after updating
      await loadInstalls();
    } catch (error) {
      console.error('Failed to update install:', error);
    }
  };

  // Get the most recently visited install
  const getLatestInstall = (): Install | null => {
    if (installs.length === 0) return null;

    return installs
      .slice() // Don't mutate original array
      .sort(
        (a, b) =>
          new Date(b.lastVisited || b.createdAt).getTime() -
          new Date(a.lastVisited || a.createdAt).getTime()
      )[0];
  };

  // Navigate to the latest install
  const goToLatestInstall = async (): Promise<void> => {
    const latest = getLatestInstall();
    if (!latest) {
      console.warn('No installs found, creating new one');
      await createNewInstall();
      return;
    }

    // Update last visited time
    await updateLastVisited(latest);

    // Navigate to install
    const { domain } = getDomainInfo();
    const subdomain = constructSubdomain(appSlug, latest.installId, domain);
    const url = `https://${subdomain}.${domain}`;

    navigate(url);
  };

  // Create a new install and navigate to it
  const createNewInstall = async (): Promise<void> => {
    const installId = generateInstallId();
    const appTitle = getAppTitle();

    // Save to database
    await saveInstall(installId, appTitle);

    // Navigate to new install
    const { domain } = getDomainInfo();
    const subdomain = constructSubdomain(appSlug, installId, domain);
    const url = `https://${subdomain}.${domain}`;

    navigate(url);
  };

  // Smart navigation: go to latest if exists, otherwise create new
  const goToLatestOrCreate = async (): Promise<void> => {
    const latest = getLatestInstall();
    if (latest) {
      await goToLatestInstall();
    } else {
      await createNewInstall();
    }
  };

  // Track a visit to the current page (if it's an instance)
  const trackVisit = async (): Promise<void> => {
    if (destroyed) return;

    try {
      const parsed = parseSubdomain(window.location.hostname);

      // Only track if this is an instance page
      if (!parsed.isInstance || !parsed.installId) {
        return;
      }

      const installDocId = `instance-${parsed.installId}`;

      try {
        // Try to get existing install
        const existingInstall = await database.get(installDocId);
        await updateLastVisited(existingInstall as Install);
      } catch (getError) {
        // Document doesn't exist, create it
        const appTitle = getAppTitle();
        await saveInstall(parsed.installId, appTitle);
      }
    } catch (error) {
      console.error('Failed to track visit:', error);
    }
  };

  // Clear all install history
  const clearHistory = async (): Promise<void> => {
    if (destroyed) return;

    try {
      const allInstalls = await loadInstalls();

      for (const install of allInstalls) {
        try {
          await database.del(install._id);
        } catch (delError) {
          console.warn('Failed to delete install:', install._id, delError);
        }
      }

      installs = [];
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  // Get current installs (async version for consistency)
  const getInstalls = async (): Promise<Install[]> => {
    if (!ready) {
      await loadInstalls();
    }
    return [...installs];
  };

  // Cleanup function
  const destroy = () => {
    destroyed = true;
    ready = false;
    loading = false;
    installs = [];
  };

  // Initialize the tracker
  const initialize = async () => {
    loading = true;

    try {
      // Load existing installs
      await loadInstalls();

      // Track current visit if on instance page
      await trackVisit();

      ready = true;
      loading = false;

      // Notify ready callback
      if (onReady) {
        onReady(installs);
      }

      // Auto-redirect if enabled and we're on a catalog page
      if (autoRedirect) {
        const parsed = parseSubdomain(window.location.hostname);
        if (!parsed.isInstance) {
          // We're on a catalog page, auto-navigate
          await goToLatestOrCreate();
        }
      }
    } catch (error) {
      console.error('Failed to initialize install tracker:', error);
      ready = false;
      loading = false;
    }
  };

  // Start initialization
  await initialize();

  // Return the control interface
  return {
    // Navigation
    goToLatestInstall,
    createNewInstall,
    goToLatestOrCreate,

    // Data access
    getInstalls,
    clearHistory,
    trackVisit,

    // State
    get ready() {
      return ready;
    },
    get loading() {
      return loading;
    },
    get installs() {
      return [...installs];
    },
    appSlug,

    // Cleanup
    destroy,
  };
}
