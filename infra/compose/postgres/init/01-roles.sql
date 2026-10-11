-- Developpement local uniquement : valeurs fictives (INFRASTRUCTURE.md 3.3, 9.1).
-- Les privileges de orbit_app sont poses par les migrations ; ici, seulement le droit de connexion local.
CREATE ROLE orbit_app LOGIN PASSWORD 'orbit_dev_only';
