-- PHASE-04 : organisation (DATA_MODEL.md M03). SQL genere par Prisma, puis objets manuels.

-- CreateEnum
CREATE TYPE "priority_level" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "capture_source" AS ENUM ('MANUAL', 'QUICK_CAPTURE', 'EMAIL', 'WHATSAPP', 'VOICE', 'IMPORT', 'AI', 'AUTOMATION', 'RECURRENCE');

-- CreateEnum
CREATE TYPE "idea_status" AS ENUM ('INBOX', 'TO_REVIEW', 'EVALUATED', 'SELECTED', 'IN_PROGRESS', 'REALIZED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "project_type" AS ENUM ('FREELANCE', 'PERSONAL_PRODUCT', 'LEARNING', 'INTERNAL');

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "note_kind" AS ENUM ('NOTE', 'MEETING', 'REFERENCE', 'CHECKLIST', 'LOG');

-- CreateEnum
CREATE TYPE "content_format" AS ENUM ('MARKDOWN', 'PLAIN');

-- CreateTable
CREATE TABLE "ideas" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "idea_status" NOT NULL DEFAULT 'INBOX',
    "priority" "priority_level",
    "domain" VARCHAR(60),
    "potential_score" SMALLINT,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "capture_source" NOT NULL DEFAULT 'MANUAL',
    "source_ref" VARCHAR(255),
    "client_capture_id" UUID,
    "converted_project_id" UUID,
    "decision_note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" CITEXT NOT NULL,
    "description" TEXT,
    "type" "project_type" NOT NULL DEFAULT 'PERSONAL_PRODUCT',
    "status" "project_status" NOT NULL DEFAULT 'PLANNED',
    "priority" "priority_level",
    "starts_on" DATE,
    "target_on" DATE,
    "completed_on" DATE,
    "color" VARCHAR(7),
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "status" "task_status" NOT NULL DEFAULT 'TODO',
    "priority" "priority_level",
    "project_id" UUID,
    "idea_id" UUID,
    "parent_task_id" UUID,
    "starts_on" DATE,
    "due_date" DATE,
    "due_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "estimated_minutes" INTEGER,
    "actual_minutes" INTEGER,
    "recurrence_rule" VARCHAR(500),
    "recurrence_anchor_on" DATE,
    "recurrence_local_time" TIME(6),
    "recurrence_timezone" VARCHAR(64),
    "next_occurrence_at" TIMESTAMPTZ(6),
    "recurrence_series_id" UUID,
    "occurrence_date" DATE,
    "source" "capture_source" NOT NULL DEFAULT 'MANUAL',
    "source_ref" VARCHAR(255),
    "client_capture_id" UUID,
    "kanban_rank" VARCHAR(64),
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "user_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "depends_on_task_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("user_id","task_id","depends_on_task_id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "color" VARCHAR(7),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idea_tags" (
    "user_id" UUID NOT NULL,
    "idea_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_tags_pkey" PRIMARY KEY ("user_id","idea_id","tag_id")
);

-- CreateTable
CREATE TABLE "task_tags" (
    "user_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_tags_pkey" PRIMARY KEY ("user_id","task_id","tag_id")
);

-- CreateTable
CREATE TABLE "project_tags" (
    "user_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_tags_pkey" PRIMARY KEY ("user_id","project_id","tag_id")
);

-- CreateTable
CREATE TABLE "note_tags" (
    "user_id" UUID NOT NULL,
    "note_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_tags_pkey" PRIMARY KEY ("user_id","note_id","tag_id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200),
    "content" TEXT NOT NULL DEFAULT '',
    "content_format" "content_format" NOT NULL DEFAULT 'MARKDOWN',
    "kind" "note_kind" NOT NULL DEFAULT 'NOTE',
    "source" "capture_source" NOT NULL DEFAULT 'MANUAL',
    "source_ref" VARCHAR(255),
    "client_capture_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "pinned_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_links" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "note_id" UUID NOT NULL,
    "idea_id" UUID,
    "project_id" UUID,
    "task_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ideas_user_id_id_key" ON "ideas"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_user_id_id_key" ON "projects"("user_id", "id");

-- CreateIndex
CREATE INDEX "ix_tasks__user_status_due" ON "tasks"("user_id", "status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_user_id_id_key" ON "tasks"("user_id", "id");

-- CreateIndex
CREATE INDEX "ix_task_dependencies__depends_on" ON "task_dependencies"("user_id", "depends_on_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_user_id_id_key" ON "tags"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_user_id_name_key" ON "tags"("user_id", "name");

-- CreateIndex
CREATE INDEX "ix_idea_tags__tag" ON "idea_tags"("user_id", "tag_id");

-- CreateIndex
CREATE INDEX "ix_task_tags__tag" ON "task_tags"("user_id", "tag_id");

-- CreateIndex
CREATE INDEX "ix_project_tags__tag" ON "project_tags"("user_id", "tag_id");

-- CreateIndex
CREATE INDEX "ix_note_tags__tag" ON "note_tags"("user_id", "tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "notes_user_id_id_key" ON "notes"("user_id", "id");

-- CreateIndex
CREATE INDEX "ix_note_links__note" ON "note_links"("user_id", "note_id");

-- CreateIndex
CREATE UNIQUE INDEX "note_links_user_id_id_key" ON "note_links"("user_id", "id");

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_user_id_converted_project_id_fkey" FOREIGN KEY ("user_id", "converted_project_id") REFERENCES "projects"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_project_id_fkey" FOREIGN KEY ("user_id", "project_id") REFERENCES "projects"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_idea_id_fkey" FOREIGN KEY ("user_id", "idea_id") REFERENCES "ideas"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_parent_task_id_fkey" FOREIGN KEY ("user_id", "parent_task_id") REFERENCES "tasks"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_recurrence_series_id_fkey" FOREIGN KEY ("user_id", "recurrence_series_id") REFERENCES "tasks"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_user_id_task_id_fkey" FOREIGN KEY ("user_id", "task_id") REFERENCES "tasks"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_user_id_depends_on_task_id_fkey" FOREIGN KEY ("user_id", "depends_on_task_id") REFERENCES "tasks"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_tags" ADD CONSTRAINT "idea_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_tags" ADD CONSTRAINT "idea_tags_user_id_idea_id_fkey" FOREIGN KEY ("user_id", "idea_id") REFERENCES "ideas"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idea_tags" ADD CONSTRAINT "idea_tags_user_id_tag_id_fkey" FOREIGN KEY ("user_id", "tag_id") REFERENCES "tags"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_user_id_task_id_fkey" FOREIGN KEY ("user_id", "task_id") REFERENCES "tasks"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_user_id_tag_id_fkey" FOREIGN KEY ("user_id", "tag_id") REFERENCES "tags"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_user_id_project_id_fkey" FOREIGN KEY ("user_id", "project_id") REFERENCES "projects"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_user_id_tag_id_fkey" FOREIGN KEY ("user_id", "tag_id") REFERENCES "tags"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_user_id_note_id_fkey" FOREIGN KEY ("user_id", "note_id") REFERENCES "notes"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_user_id_tag_id_fkey" FOREIGN KEY ("user_id", "tag_id") REFERENCES "tags"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_user_id_note_id_fkey" FOREIGN KEY ("user_id", "note_id") REFERENCES "notes"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_user_id_idea_id_fkey" FOREIGN KEY ("user_id", "idea_id") REFERENCES "ideas"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_user_id_project_id_fkey" FOREIGN KEY ("user_id", "project_id") REFERENCES "projects"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_user_id_task_id_fkey" FOREIGN KEY ("user_id", "task_id") REFERENCES "tasks"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- =============================================================================
-- MANUAL (DATA_MODEL.md §2.2) : objets que Prisma n'exprime pas. Registre : prisma/manual-objects.md
-- =============================================================================

-- ==== MANUAL: recherche (ADR-017) ====
CREATE OR REPLACE FUNCTION public.f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

-- ==== MANUAL: FK composites ON DELETE SET NULL (colonne) (DATA_MODEL.md §1.4) ====
ALTER TABLE "ideas" DROP CONSTRAINT "ideas_user_id_converted_project_id_fkey",
  ADD CONSTRAINT "ideas_user_id_converted_project_id_fkey" FOREIGN KEY ("user_id", "converted_project_id")
    REFERENCES "projects"("user_id", "id") ON DELETE SET NULL ("converted_project_id") ON UPDATE CASCADE;
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_user_id_project_id_fkey",
  ADD CONSTRAINT "tasks_user_id_project_id_fkey" FOREIGN KEY ("user_id", "project_id")
    REFERENCES "projects"("user_id", "id") ON DELETE SET NULL ("project_id") ON UPDATE CASCADE;
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_user_id_idea_id_fkey",
  ADD CONSTRAINT "tasks_user_id_idea_id_fkey" FOREIGN KEY ("user_id", "idea_id")
    REFERENCES "ideas"("user_id", "id") ON DELETE SET NULL ("idea_id") ON UPDATE CASCADE;
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_user_id_recurrence_series_id_fkey",
  ADD CONSTRAINT "tasks_user_id_recurrence_series_id_fkey" FOREIGN KEY ("user_id", "recurrence_series_id")
    REFERENCES "tasks"("user_id", "id") ON DELETE SET NULL ("recurrence_series_id") ON UPDATE CASCADE;

-- ==== MANUAL: ideas ====
ALTER TABLE "ideas"
  ADD CONSTRAINT "ck_ideas__potential_score" CHECK ("potential_score" BETWEEN 1 AND 10),
  ADD CONSTRAINT "ck_ideas__description_len" CHECK (char_length("description") <= 20000),
  ADD CONSTRAINT "ck_ideas__title_not_blank" CHECK (btrim("title") <> ''),
  ADD CONSTRAINT "ck_ideas__version" CHECK ("version" >= 1);
CREATE UNIQUE INDEX "ux_ideas__client_capture" ON "ideas" ("user_id", "client_capture_id") WHERE "client_capture_id" IS NOT NULL;
CREATE INDEX "ix_ideas__user_captured" ON "ideas" ("user_id", "captured_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX "ix_ideas__user_status" ON "ideas" ("user_id", "status", "captured_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX "ix_ideas__title_trgm" ON "ideas" USING gin (public.f_unaccent(lower("title")) gin_trgm_ops);
CREATE INDEX "ix_ideas__converted_project" ON "ideas" ("user_id", "converted_project_id") WHERE "converted_project_id" IS NOT NULL;

-- ==== MANUAL: projects ====
ALTER TABLE "projects"
  ADD CONSTRAINT "ck_projects__slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") <= 80),
  ADD CONSTRAINT "ck_projects__dates" CHECK ("target_on" IS NULL OR "starts_on" IS NULL OR "target_on" >= "starts_on"),
  ADD CONSTRAINT "ck_projects__completed" CHECK (("status" = 'COMPLETED') = ("completed_on" IS NOT NULL)),
  ADD CONSTRAINT "ck_projects__color" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT "ck_projects__version" CHECK ("version" >= 1);
CREATE UNIQUE INDEX "ux_projects__slug" ON "projects" ("user_id", "slug") WHERE "deleted_at" IS NULL;
CREATE INDEX "ix_projects__user_status" ON "projects" ("user_id", "status") WHERE "deleted_at" IS NULL AND "archived_at" IS NULL;

-- ==== MANUAL: tasks ====
ALTER TABLE "tasks"
  ADD CONSTRAINT "ck_tasks__done" CHECK (("status" = 'DONE') = ("completed_at" IS NOT NULL)),
  ADD CONSTRAINT "ck_tasks__due" CHECK ("due_at" IS NULL OR "due_date" IS NOT NULL),
  ADD CONSTRAINT "ck_tasks__not_own_parent" CHECK ("parent_task_id" IS NULL OR "parent_task_id" <> "id"),
  ADD CONSTRAINT "ck_tasks__series" CHECK (("recurrence_series_id" IS NULL) = ("occurrence_date" IS NULL)
    AND ("recurrence_rule" IS NULL OR "recurrence_series_id" IS NULL)),
  ADD CONSTRAINT "ck_tasks__minutes" CHECK (coalesce("estimated_minutes", 0) >= 0 AND coalesce("actual_minutes", 0) >= 0),
  ADD CONSTRAINT "ck_tasks__recurrence_complete" CHECK (("recurrence_rule" IS NULL) = ("recurrence_anchor_on" IS NULL)
    AND ("recurrence_rule" IS NULL OR "recurrence_timezone" IS NOT NULL)),
  ADD CONSTRAINT "ck_tasks__recurrence_syntax" CHECK ("recurrence_rule" IS NULL
    OR "recurrence_rule" ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$'),
  ADD CONSTRAINT "ck_tasks__description_len" CHECK (char_length("description") <= 20000),
  ADD CONSTRAINT "ck_tasks__title_not_blank" CHECK (btrim("title") <> ''),
  ADD CONSTRAINT "ck_tasks__version" CHECK ("version" >= 1);
CREATE UNIQUE INDEX "ux_tasks__client_capture" ON "tasks" ("user_id", "client_capture_id") WHERE "client_capture_id" IS NOT NULL;
CREATE UNIQUE INDEX "ux_tasks__series_occurrence" ON "tasks" ("user_id", "recurrence_series_id", "occurrence_date") WHERE "recurrence_series_id" IS NOT NULL;
CREATE INDEX "ix_tasks__project" ON "tasks" ("user_id", "project_id", "status") WHERE "project_id" IS NOT NULL AND "deleted_at" IS NULL;
CREATE INDEX "ix_tasks__parent" ON "tasks" ("user_id", "parent_task_id") WHERE "parent_task_id" IS NOT NULL;
CREATE INDEX "ix_tasks__next_occurrence" ON "tasks" ("next_occurrence_at") WHERE "recurrence_rule" IS NOT NULL AND "deleted_at" IS NULL;

-- ==== MANUAL: task_dependencies (absence de cycle garantie par la base) ====
ALTER TABLE "task_dependencies"
  ADD CONSTRAINT "ck_task_dependencies__not_self" CHECK ("task_id" <> "depends_on_task_id");

CREATE FUNCTION orbit_task_dependencies_no_cycle() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  -- Un seul ajout de dépendance à la fois par utilisateur : deux ajouts concurrents ne peuvent pas
  -- former ensemble un cycle que chacun, seul, ne formait pas.
  PERFORM pg_advisory_xact_lock(hashtextextended('task_deps:' || NEW.user_id::text, 0));
  -- « task_id dépend de depends_on_task_id » crée un cycle si depends_on_task_id dépend déjà,
  -- directement ou non, de task_id.
  IF EXISTS (
    WITH RECURSIVE reach(id) AS (
      SELECT d.depends_on_task_id FROM task_dependencies d
       WHERE d.user_id = NEW.user_id AND d.task_id = NEW.depends_on_task_id
      UNION
      SELECT d.depends_on_task_id FROM task_dependencies d
        JOIN reach r ON d.task_id = r.id
       WHERE d.user_id = NEW.user_id
    )
    SELECT 1 FROM reach WHERE id = NEW.task_id
  ) OR NEW.depends_on_task_id = NEW.task_id THEN
    RAISE EXCEPTION 'task dependency cycle' USING ERRCODE = '23514', CONSTRAINT = 'trg_task_dependencies__no_cycle';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "trg_task_dependencies__no_cycle"
  BEFORE INSERT OR UPDATE ON "task_dependencies"
  FOR EACH ROW EXECUTE FUNCTION orbit_task_dependencies_no_cycle();

-- ==== MANUAL: tags ====
ALTER TABLE "tags"
  ADD CONSTRAINT "ck_tags__name_len" CHECK (char_length(btrim("name")) BETWEEN 1 AND 40),
  ADD CONSTRAINT "ck_tags__color" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');

-- ==== MANUAL: notes ====
ALTER TABLE "notes"
  ADD CONSTRAINT "ck_notes__content_len" CHECK (char_length("content") <= 200000),
  ADD CONSTRAINT "ck_notes__version" CHECK ("version" >= 1);
CREATE UNIQUE INDEX "ux_notes__client_capture" ON "notes" ("user_id", "client_capture_id") WHERE "client_capture_id" IS NOT NULL;
CREATE INDEX "ix_notes__user_updated" ON "notes" ("user_id", "updated_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX "ix_notes__pinned" ON "notes" ("user_id", "pinned_at" DESC) WHERE "pinned_at" IS NOT NULL AND "deleted_at" IS NULL;

-- ==== MANUAL: note_links (ADR-018) ====
ALTER TABLE "note_links"
  ADD CONSTRAINT "ck_note_links__one_target" CHECK (num_nonnulls("idea_id", "project_id", "task_id") = 1);
CREATE UNIQUE INDEX "ux_note_links__idea" ON "note_links" ("user_id", "idea_id", "note_id") WHERE "idea_id" IS NOT NULL;
CREATE UNIQUE INDEX "ux_note_links__project" ON "note_links" ("user_id", "project_id", "note_id") WHERE "project_id" IS NOT NULL;
CREATE UNIQUE INDEX "ux_note_links__task" ON "note_links" ("user_id", "task_id", "note_id") WHERE "task_id" IS NOT NULL;
