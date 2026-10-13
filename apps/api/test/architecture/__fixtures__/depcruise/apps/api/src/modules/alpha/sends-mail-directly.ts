// Violation volontaire : un module importe nodemailer au lieu d'injecter le port MAIL.
import { createTransport } from 'nodemailer';

export const transport = createTransport({});
