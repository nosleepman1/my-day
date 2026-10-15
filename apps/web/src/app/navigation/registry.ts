import {
  Briefcase,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  HandCoins,
  House,
  KeyRound,
  Lightbulb,
  NotebookText,
  Plug,
  Server,
  Settings,
  ShieldCheck,
  Target,
  Wallet,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import type { UserModule } from '@orbit/contracts';

export type NavSection = 'home' | 'organisation' | 'money' | 'system' | 'dev';

export type NavKey =
  | 'home'
  | 'tasks'
  | 'ideas'
  | 'projects'
  | 'notes'
  | 'calendar'
  | 'goals'
  | 'finance'
  | 'debts'
  | 'pro'
  | 'automations'
  | 'integrations'
  | 'settings'
  | 'devInventory'
  | 'devVault'
  | 'admin';

/**
 * Entrée du registre de navigation (PHASE-02 §3) : chaque module s'y déclare une fois ; la barre du
 * bas, la barre latérale et le menu « Plus » en sont dérivés.
 */
export type NavEntry = Readonly<{
  key: NavKey;
  path: string;
  icon: LucideIcon;
  section: NavSection;
  /** Module désactivable (`enabled_modules`, ADR-024) ; absent = toujours visible. */
  module?: UserModule;
  /** Rôle requis : les entrées ADMIN ne dépendent que du rôle. */
  role?: 'ADMIN';
  /** Phase de livraison ; avant, la route affiche « Bientôt disponible ». */
  phase: number;
  /** Présent dans le menu « Plus » mobile (PRODUCT_SCOPE.md §5, dans cet ordre). */
  inMoreMenu: boolean;
}>;

export const CURRENT_PHASE = 5;

export const NAV_ENTRIES: readonly NavEntry[] = [
  { key: 'home', path: '/', icon: House, section: 'home', phase: 2, inMoreMenu: false },
  {
    key: 'tasks',
    path: '/tasks',
    icon: CheckSquare,
    section: 'organisation',
    module: 'tasks',
    phase: 4,
    inMoreMenu: false,
  },
  {
    key: 'ideas',
    path: '/ideas',
    icon: Lightbulb,
    section: 'organisation',
    module: 'ideas',
    phase: 4,
    inMoreMenu: true,
  },
  {
    key: 'projects',
    path: '/projects',
    icon: FolderKanban,
    section: 'organisation',
    module: 'projects',
    phase: 4,
    inMoreMenu: true,
  },
  {
    key: 'notes',
    path: '/notes',
    icon: NotebookText,
    section: 'organisation',
    module: 'notes',
    phase: 4,
    inMoreMenu: true,
  },
  {
    key: 'calendar',
    path: '/calendar',
    icon: CalendarDays,
    section: 'organisation',
    module: 'calendar',
    phase: 9,
    inMoreMenu: true,
  },
  {
    key: 'goals',
    path: '/goals',
    icon: Target,
    section: 'organisation',
    module: 'goals',
    phase: 11,
    inMoreMenu: true,
  },
  {
    key: 'finance',
    path: '/finance',
    icon: Wallet,
    section: 'money',
    module: 'finance',
    phase: 5,
    inMoreMenu: false,
  },
  {
    key: 'debts',
    path: '/finance/debts',
    icon: HandCoins,
    section: 'money',
    module: 'debts',
    phase: 6,
    inMoreMenu: false,
  },
  { key: 'pro', path: '/pro', icon: Briefcase, section: 'money', module: 'pro', phase: 10, inMoreMenu: true },
  {
    key: 'automations',
    path: '/automations',
    icon: Workflow,
    section: 'system',
    module: 'automations',
    phase: 15,
    inMoreMenu: true,
  },
  {
    key: 'integrations',
    path: '/integrations',
    icon: Plug,
    section: 'system',
    module: 'integrations',
    phase: 14,
    inMoreMenu: true,
  },
  { key: 'settings', path: '/settings', icon: Settings, section: 'system', phase: 2, inMoreMenu: true },
  {
    key: 'devInventory',
    path: '/dev',
    icon: Server,
    section: 'dev',
    role: 'ADMIN',
    phase: 12,
    inMoreMenu: true,
  },
  {
    key: 'devVault',
    path: '/dev/vault',
    icon: KeyRound,
    section: 'dev',
    role: 'ADMIN',
    phase: 13,
    inMoreMenu: true,
  },
  {
    key: 'admin',
    path: '/admin',
    icon: ShieldCheck,
    section: 'dev',
    role: 'ADMIN',
    phase: 17,
    inMoreMenu: true,
  },
];

export type NavContext = Readonly<{ role: 'USER' | 'ADMIN'; enabledModules: readonly UserModule[] }>;

export function isVisible(entry: NavEntry, context: NavContext): boolean {
  if (entry.role !== undefined && context.role !== entry.role) return false;
  return entry.module === undefined || context.enabledModules.includes(entry.module);
}

export function visibleEntries(context: NavContext): readonly NavEntry[] {
  return NAV_ENTRIES.filter((entry) => isVisible(entry, context));
}

function entry(key: NavKey): NavEntry {
  const found = NAV_ENTRIES.find((candidate) => candidate.key === key);
  if (found === undefined) throw new Error(`Unknown navigation entry: ${key}`);
  return found;
}

/** Accueil : premier emplacement de la barre du bas, toujours visible. */
export const HOME_ENTRY: NavEntry = entry('home');

/**
 * Emplacements 2 et 4 de la barre du bas (DESIGN_SYSTEM.md §4.1) : Finances devient Idées et Tâches
 * devient Notes quand le module est désactivé ; `null` si aucun remplaçant n'est actif.
 */
export function bottomNavSlots(context: NavContext): readonly [NavEntry | null, NavEntry | null] {
  const pick = (first: NavKey, fallback: NavKey): NavEntry | null => {
    if (isVisible(entry(first), context)) return entry(first);
    return isVisible(entry(fallback), context) ? entry(fallback) : null;
  };
  return [pick('finance', 'ideas'), pick('tasks', 'notes')];
}

export const SECTION_ORDER: readonly NavSection[] = ['home', 'organisation', 'money', 'system', 'dev'];
