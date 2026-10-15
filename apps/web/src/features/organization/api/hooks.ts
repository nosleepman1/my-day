import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { organizationKeys } from '@/lib/query-keys';

import { organizationApi, type ListParams, type Resource } from './organization.api';

/** Liste paginée par curseur (API.md §7) : « Charger plus » ajoute la page suivante. */
export function useOrganizationList<R extends Resource>(resource: R, params: ListParams, enabled = true) {
  return useInfiniteQuery({
    queryKey: organizationKeys.list(resource, params),
    queryFn: ({ pageParam, signal }) =>
      organizationApi.list(resource, { ...params, cursor: pageParam ?? undefined }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.meta.nextCursor,
    enabled,
  });
}

/** Rows de toutes les pages chargées. */
export function rowsOf<T>(pages: readonly Readonly<{ data: readonly T[] }>[] | undefined): T[] {
  return (pages ?? []).flatMap((page) => page.data);
}

export const useIdea = (id: string) =>
  useQuery({
    queryKey: organizationKeys.item('ideas', id),
    queryFn: ({ signal }) => organizationApi.idea(id, signal),
  });

export const useSimilarIdeas = (id: string) =>
  useQuery({
    queryKey: organizationKeys.detail('ideas', id, 'similar'),
    queryFn: ({ signal }) => organizationApi.similarIdeas(id, signal),
  });

export const useProject = (id: string) =>
  useQuery({
    queryKey: organizationKeys.item('projects', id),
    queryFn: ({ signal }) => organizationApi.project(id, signal),
  });

export const useProjectSummary = (id: string) =>
  useQuery({
    queryKey: organizationKeys.detail('projects', id, 'summary'),
    queryFn: ({ signal }) => organizationApi.projectSummary(id, signal),
  });

export const useTask = (id: string) =>
  useQuery({
    queryKey: organizationKeys.item('tasks', id),
    queryFn: ({ signal }) => organizationApi.task(id, signal),
  });

export const useTaskHistory = (id: string) =>
  useQuery({
    queryKey: organizationKeys.detail('tasks', id, 'history'),
    queryFn: ({ signal }) => organizationApi.taskHistory(id, signal),
  });

export const useNote = (id: string) =>
  useQuery({
    queryKey: organizationKeys.item('notes', id),
    queryFn: ({ signal }) => organizationApi.note(id, signal),
  });

export const useTags = () =>
  useQuery({ queryKey: organizationKeys.tags(), queryFn: ({ signal }) => organizationApi.tags(signal) });

/**
 * Écriture M03 : toute réussite invalide les données d'organisation (listes, détails, tags), car une
 * même action touche souvent plusieurs ressources (conversion, complétion récurrente, fusion de tags).
 */
export function useOrganizationMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  options: Readonly<{ successMessage?: string }> = {},
): UseMutationResult<TResult, Error, TArgs> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Le message part ici, avant l'invalidation : un formulaire indexé par `version` est remonté par le
    // rechargement, et TanStack n'appelle plus alors les callbacks passés à `mutate`.
    onSuccess: () => {
      if (options.successMessage !== undefined) toast.success(options.successMessage);
      return queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });
}
