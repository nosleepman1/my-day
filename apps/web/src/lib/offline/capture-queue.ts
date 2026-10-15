/**
 * File hors ligne des captures (ADR-016, PHASE-04 T15). Une capture faite sans réseau est conservée en
 * IndexedDB avec son UUIDv7 client, puis rejouée dans l'ordre au retour du réseau ; l'API renvoie
 * l'élément existant si l'identifiant a déjà été reçu, donc un rejeu ne crée jamais de doublon.
 * Aucune écriture financière n'emprunte cette file.
 */

export type CaptureKind = 'idea' | 'task' | 'note';

export type PendingCapture = Readonly<{
  id: string;
  /**
   * Compte auteur : sur un appareil partagé, une capture n'est jamais rejouée ni affichée sous la
   * session d'un autre compte (elle serait créée chez lui).
   */
  ownerId: string;
  kind: CaptureKind;
  body: Readonly<Record<string, unknown>>;
  createdAt: string;
  /** Dernière erreur de rejeu définitive (4xx) : la capture reste affichée pour correction. */
  error: string | null;
}>;

/** Stockage de la file : IndexedDB dans le navigateur, mémoire dans les tests. */
export type CaptureStore = Readonly<{
  all(): Promise<PendingCapture[]>;
  put(capture: PendingCapture): Promise<void>;
  remove(id: string): Promise<void>;
}>;

const DB_NAME = 'orbit-offline';
const STORE = 'captures';
const DB_VERSION = 1;

function promised<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => {
      resolve(request.result);
    });
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('IndexedDB request failed'));
    });
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  const request = factory.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    request.result.createObjectStore(STORE, { keyPath: 'id' });
  };
  return promised(request);
}

export function createIndexedDbStore(factory: IDBFactory): CaptureStore {
  let database: Promise<IDBDatabase> | null = null;
  const store = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
    // Un échec d'ouverture n'est pas mis en cache : la prochaine opération réessaie.
    database ??= openDatabase(factory).catch((error: unknown) => {
      database = null;
      throw error;
    });
    return (await database).transaction(STORE, mode).objectStore(STORE);
  };
  return {
    all: async () => (await promised((await store('readonly')).getAll())) as PendingCapture[],
    put: async (capture) => {
      await promised((await store('readwrite')).put(capture));
    },
    remove: async (id) => {
      await promised((await store('readwrite')).delete(id));
    },
  };
}

export function createMemoryStore(): CaptureStore {
  const items = new Map<string, PendingCapture>();
  return {
    all: () => Promise.resolve([...items.values()]),
    put: (capture) => {
      items.set(capture.id, capture);
      return Promise.resolve();
    },
    remove: (id) => {
      items.delete(id);
      return Promise.resolve();
    },
  };
}

/** Résultat de l'envoi d'une capture : `retry` (réseau, 5xx) arrête le rejeu sans rien perdre. */
export type SendOutcome = Readonly<
  { status: 'sent' } | { status: 'retry' } | { status: 'failed'; error: string }
>;

const listeners = new Set<() => void>();

/** Notifie les composants abonnés (badge du nombre d'éléments en attente). */
export function onQueueChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function createCaptureQueue(store: CaptureStore) {
  let replaying: Promise<number> | null = null;

  /** Captures en attente, dans l'ordre de capture ; celles d'un seul compte si `ownerId` est donné. */
  const pending = async (ownerId?: string): Promise<PendingCapture[]> =>
    (await store.all())
      .filter((capture) => ownerId === undefined || capture.ownerId === ownerId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  /** Rejoue les captures du compte connecté ; renvoie le nombre envoyé. Un seul rejeu à la fois. */
  const replayOnce = async (
    send: (capture: PendingCapture) => Promise<SendOutcome>,
    ownerId: string,
  ): Promise<number> => {
    let sent = 0;
    // Une capture déjà refusée (4xx) attend une correction ou un abandon : elle n'est pas réémise.
    const replayable = (await pending(ownerId)).filter((capture) => capture.error === null);
    for (const capture of replayable) {
      const outcome = await send(capture);
      if (outcome.status === 'retry') break;
      if (outcome.status === 'sent') {
        await store.remove(capture.id);
        sent += 1;
      } else {
        await store.put({ ...capture, error: outcome.error });
      }
      notify();
    }
    return sent;
  };

  return {
    pending,
    async enqueue(capture: Omit<PendingCapture, 'error'>): Promise<void> {
      await store.put({ ...capture, error: null });
      notify();
    },
    async discard(id: string): Promise<void> {
      await store.remove(id);
      notify();
    },
    /** Vide la file (déconnexion) : rien ne reste lisible ni rejouable sur un appareil partagé. */
    async clear(): Promise<void> {
      await Promise.all((await store.all()).map((capture) => store.remove(capture.id)));
      notify();
    },
    replay(send: (capture: PendingCapture) => Promise<SendOutcome>, ownerId: string): Promise<number> {
      replaying ??= replayOnce(send, ownerId).finally(() => {
        replaying = null;
      });
      return replaying;
    },
  };
}

export type CaptureQueue = ReturnType<typeof createCaptureQueue>;

/** File de l'application : IndexedDB si disponible (navigation privée de certains navigateurs : mémoire). */
export const captureQueue: CaptureQueue = createCaptureQueue(
  typeof indexedDB === 'undefined' ? createMemoryStore() : createIndexedDbStore(indexedDB),
);
