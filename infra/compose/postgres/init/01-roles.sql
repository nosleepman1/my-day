-- Developpement local uniquement : valeurs fictives (INFRASTRUCTURE.md 3.3, 9.1).
-- orbit_owner (POSTGRES_USER) possede le schema et execute les migrations.
-- orbit_app est le role applicatif, sans droit de DDL.
CREATE ROLE orbit_app LOGIN PASSWORD 'orbit_dev_only';
GRANT CONNECT ON DATABASE orbit TO orbit_app;
GRANT USAGE ON SCHEMA public TO orbit_app;
ALTER DEFAULT PRIVILEGES FOR ROLE orbit_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO orbit_app;
ALTER DEFAULT PRIVILEGES FOR ROLE orbit_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO orbit_app;
