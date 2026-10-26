import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Astro runs from site/; scripts run from the repo root. Either way, resolve the repo root.
const cwd = process.cwd();
export const REPO_ROOT = existsSync(resolve(cwd, 'content')) ? cwd : resolve(cwd, '..');
export const SAMPLES_DIR = resolve(REPO_ROOT, 'samples', 'concepts');
