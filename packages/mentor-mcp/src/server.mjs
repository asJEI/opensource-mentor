import { MentorClient } from './client.mjs';
import { ProfileStore } from './profile.mjs';
import { createToolServer } from './tools.mjs';

export function createServer(client = new MentorClient()) {
  return createToolServer(client, new ProfileStore(client));
}
