import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckSquare,
  Lightbulb,
  NotebookText,
  type LucideIcon,
} from 'lucide-react';

import type { UserModule } from '@orbit/contracts';

export type CaptureTypeKey = 'idea' | 'task' | 'note' | 'expense' | 'income';

/**
 * Registre des types de capture (PHASE-02 §3) : chaque module y branchera son formulaire ; tant que
 * `form` est absent, la feuille annonce la phase de livraison.
 */
export type CaptureType = Readonly<{
  key: CaptureTypeKey;
  icon: LucideIcon;
  module: UserModule;
  phase: number;
  /** Formulaire livré : capture réelle (idée, tâche, note depuis PHASE-04). */
  ready: boolean;
}>;

export const CAPTURE_TYPES: readonly CaptureType[] = [
  { key: 'idea', icon: Lightbulb, module: 'ideas', phase: 4, ready: true },
  { key: 'task', icon: CheckSquare, module: 'tasks', phase: 4, ready: true },
  { key: 'note', icon: NotebookText, module: 'notes', phase: 4, ready: true },
  { key: 'expense', icon: ArrowUpRight, module: 'finance', phase: 5, ready: true },
  { key: 'income', icon: ArrowDownLeft, module: 'finance', phase: 5, ready: true },
];

export function availableCaptureTypes(enabledModules: readonly UserModule[]): readonly CaptureType[] {
  return CAPTURE_TYPES.filter((type) => enabledModules.includes(type.module));
}

/** Le raccourci `N` ne s'active jamais pendant une saisie (DESIGN_SYSTEM.md §4.2). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const role = target.getAttribute('role');
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    role === 'textbox' ||
    role === 'combobox' ||
    role === 'searchbox'
  );
}
