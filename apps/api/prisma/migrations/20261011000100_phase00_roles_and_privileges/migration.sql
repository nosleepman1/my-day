-- PHASE-00 : roles et privileges (SECURITY.md, INFRASTRUCTURE.md 9.1).
-- orbit_owner (role qui execute les migrations) possede le schema.
-- orbit_app est le role applicatif, sans DDL. Son LOGIN et son mot de passe sont poses par le
-- provisionnement de chaque environnement (init Docker en local, Testcontainers en test, VPS en PHASE-03).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orbit_app') THEN
    CREATE ROLE orbit_app NOLOGIN;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO orbit_app', current_database());
END
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO orbit_app;

-- Toute table creee par le role de migration sera lisible et modifiable par orbit_app (DML seulement).
-- Les tables en ajout seul (audit_logs) retireront UPDATE et DELETE dans leur propre migration (PHASE-01).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO orbit_app;

ALTER ROLE orbit_app SET statement_timeout = '15s';
