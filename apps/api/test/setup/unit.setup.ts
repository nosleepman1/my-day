import 'reflect-metadata';

// Les tests ne dépendent jamais du fuseau de la machine (TESTING.md §15, ADR-023).
process.env['TZ'] = 'UTC';
