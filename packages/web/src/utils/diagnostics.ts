import { useAuthStore } from '../stores/authStore';
import { useSpaceStore } from '../stores/spaceStore';
import { getHomeWsConnected } from '../hooks/useWebSocket';
import { getResolvedApiBase, getResolvedWsUrl } from '../config/backend';
import { isElectron } from '../platform/platform';

export interface NuvioDiagnosticSnapshot {
  client: 'desktop' | 'web';
  timestamp: string;
  userId: string | null;
  username: string | null;
  displayName: string | null;
  backendBase: string;
  wsUrl: string;
  wsConnected: boolean;
  spacesCount: {
    total: number;
    private: number;
    public: number;
  };
  spaces: Array<{
    id: string;
    name: string;
    visibility: 'public' | 'private' | 'request';
    origin: string;
    ownerId: string;
    isOwner: boolean;
  }>;
}

/**
 * Safe diagnostic inspection utility.
 * Can be called from browser DevTools console via `__nuvioDiag()` or `__nuvioSyncInfo()`.
 * Does NOT expose tokens, passwords, or secrets.
 */
export function getDiagnostics(): NuvioDiagnosticSnapshot {
  const auth = useAuthStore.getState();
  const spaces = useSpaceStore.getState().spaces;
  const privateCount = spaces.filter((s) => s.visibility !== 'public').length;
  const publicCount = spaces.filter((s) => s.visibility === 'public').length;

  return {
    client: isElectron() ? 'desktop' : 'web',
    timestamp: new Date().toISOString(),
    userId: auth.user?.id ?? null,
    username: auth.user?.username ?? null,
    displayName: auth.user?.displayName ?? null,
    backendBase: getResolvedApiBase(),
    wsUrl: getResolvedWsUrl(),
    wsConnected: getHomeWsConnected(),
    spacesCount: {
      total: spaces.length,
      private: privateCount,
      public: publicCount,
    },
    spaces: spaces.map((s) => ({
      id: s.id,
      name: s.name,
      visibility: (s.visibility ?? 'private') as 'public' | 'private' | 'request',
      origin: s._instanceOrigin || 'official',
      ownerId: s.ownerId,
      isOwner: s.ownerId === auth.user?.id,
    })),
  };
}

export function registerDiagnostics(): void {
  if (typeof window !== 'undefined') {
    (window as any).__nuvioDiag = getDiagnostics;
    (window as any).__nuvioSyncInfo = () => {
      const diag = getDiagnostics();
      console.log('=== Nuvio Client Sync Diagnostics ===');
      console.log(`Client: ${diag.client} | User: ${diag.username} (${diag.userId})`);
      console.log(`Backend: ${diag.backendBase} | WS Connected: ${diag.wsConnected}`);
      console.log(`Spaces: ${diag.spacesCount.total} total (${diag.spacesCount.private} private, ${diag.spacesCount.public} public)`);
      console.table(diag.spaces);
      return diag;
    };
  }
}
