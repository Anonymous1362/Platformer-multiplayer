// Fetches the third-party CC0 packs listed in tools/assets-fetch/packs.json, pinned to a commit,
// into assets_src/third_party/<id>/ (gitignored), with a sparse, blob-less git checkout so only the
// listed folders download. Prints a provenance line per pack for assets_src/LICENSES.csv.
// Usage: npm run assets:fetch [-- <pack-id> ...]
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface Pack {
  readonly id: string;
  readonly title: string;
  readonly license: string;
  readonly repo: string;
  readonly commit: string;
  readonly path: string;
}

const ROOT = join(import.meta.dirname, '..', '..');
const OUT = join(ROOT, 'assets_src', 'third_party');
const list = JSON.parse(readFileSync(join(import.meta.dirname, 'packs.json'), 'utf8')) as { packs: Pack[] };
const wanted = new Set(process.argv.slice(2));
const packs = list.packs.filter((p) => wanted.size === 0 || wanted.has(p.id));

const git = (cwd: string, ...args: string[]): void => {
  execFileSync('git', args, {
    cwd,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' },
  });
};

const byRepo = new Map<string, Pack[]>();
for (const p of packs)
  byRepo.set(`${p.repo}@${p.commit}`, [...(byRepo.get(`${p.repo}@${p.commit}`) ?? []), p]);

for (const [key, group] of byRepo) {
  const [repo = '', commit = ''] = key.split('@');
  const work = mkdtempSync(join(tmpdir(), 'cd-assets-'));
  try {
    git(work, 'init', '-q');
    git(work, 'remote', 'add', 'origin', repo);
    git(work, 'sparse-checkout', 'set', '--no-cone', ...group.map((p) => p.path));
    git(work, 'fetch', '-q', '--depth', '1', '--filter=blob:none', 'origin', commit);
    git(work, 'checkout', '-q', 'FETCH_HEAD');
    for (const p of group) {
      const from = join(work, p.path);
      if (!existsSync(from)) throw new Error(`${p.id}: ${p.path} not found at ${commit}`);
      const to = join(OUT, p.id);
      rmSync(to, { recursive: true, force: true });
      mkdirSync(to, { recursive: true });
      cpSync(from, to, { recursive: true });
      console.log(`✓ ${p.id}: ${p.title} (${p.license}) from ${repo}@${commit.slice(0, 7)}/${p.path}`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
