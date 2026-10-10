import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';

import { ProfileSession } from './profileSession.mjs';

export class ProfileStore extends ProfileSession {
  constructor(client) {
    super(client);
    this.path = join(client.env.OSM_STATE_DIR || join(homedir(), '.opensource-mentor'), createHash('sha256').update(client.base.origin).digest('hex').slice(0, 16) + '.json');
    this.queue = Promise.resolve();
  }
  async read() {
    try { return JSON.parse(await readFile(this.path, 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return {}; throw new Error('Cannot read Mentor state; check local file permissions.'); }
  }
  async write(state) {
    const operation = this.queue.then(async () => {
      await mkdir(join(this.path, '..'), { recursive: true, mode: 0o700 });
      const temp = this.path + '.' + randomBytes(8).toString('hex') + '.tmp';
      await writeFile(temp, JSON.stringify(state), { mode: 0o600 });
      await rename(temp, this.path);
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
