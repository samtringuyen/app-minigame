import { randomBytes } from 'node:crypto';

export function generatePuzzleSeed(): string {
  return randomBytes(16).toString('hex');
}
