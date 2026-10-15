-- PHASE-04 : correctifs issus de la revue database-reviewer (expansion seule, aucune donnée modifiée).

-- Une occurrence n'a pas de sens sans la tête de sa série : la suppression physique de la tête (purge,
-- suppression de compte) emporte ses occurrences. SET NULL violait ck_tasks__series (occurrence_date restait).
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_user_id_recurrence_series_id_fkey",
  ADD CONSTRAINT "tasks_user_id_recurrence_series_id_fkey" FOREIGN KEY ("user_id", "recurrence_series_id")
    REFERENCES "tasks"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==== MANUAL: index des vues de tâches ouvertes (TODAY, OVERDUE, THIS_WEEK, NO_DUE_DATE) ====
DROP INDEX "ix_tasks__user_status_due";
CREATE INDEX "ix_tasks__open_due" ON "tasks" ("user_id", "due_date")
  WHERE "deleted_at" IS NULL AND "status" NOT IN ('DONE', 'CANCELLED');

-- ==== MANUAL: index des FK composites (filtres de liste et ON DELETE SET NULL) ====
CREATE INDEX "ix_tasks__idea" ON "tasks" ("user_id", "idea_id") WHERE "idea_id" IS NOT NULL;
CREATE INDEX "ix_tasks__project_fk" ON "tasks" ("user_id", "project_id") WHERE "project_id" IS NOT NULL;

-- ==== MANUAL: fonction du déclencheur anti-cycle à chemin de recherche figé ====
ALTER FUNCTION public.orbit_task_dependencies_no_cycle() SET search_path = public, pg_temp;
