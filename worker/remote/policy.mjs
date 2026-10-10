export const PUBLIC_TOOLS = new Set(['search_repositories', 'get_repository', 'get_repository_context', 'get_issue_context', 'list_issues']);
export const PROFILE_TOOLS = new Set(['get_user_profile', 'save_user_profile', 'connect_account', 'account_connection_status', 'disconnect_account']);
export const GENERATION_TOOLS = new Set(['analyze_repository', 'recommend_issues', 'explain_issue', 'generate_learning_plan', 'mentor_chat', 'generate_pr_draft', 'review_pull_request']);
export class RemoteError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export async function hash(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function identity(request, env) {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return null;
  if (!/^Bearer [A-Za-z0-9_-]{32,256}$/.test(authorization)) throw new RemoteError(401, 'Invalid remote access credential');
  let entries;
  try { entries = JSON.parse(env.REMOTE_ACCESS_TOKENS || '{}'); }
  catch { throw new RemoteError(503, 'Remote authentication is not configured correctly'); }
  const ids = new Set();
  for (const [key, entry] of Object.entries(entries)) {
    if (!/^[a-f0-9]{64}$/.test(key) || !entry || !/^[A-Za-z0-9_-]{1,80}$/.test(entry.id) || !Array.isArray(entry.scopes) || entry.scopes.some(s => !['profile', 'agent', 'byok'].includes(s)) || ids.has(entry.id)) throw new RemoteError(503, 'Remote authentication is not configured correctly');
    ids.add(entry.id);
  }
  const entry = entries[await hash(authorization.slice(7))];
  if (!entry) throw new RemoteError(401, 'Invalid remote access credential');
  return { id: entry.id, scopes: entry.scopes };
}
export function authorizeTool(name, args, user, request) {
  if (PUBLIC_TOOLS.has(name)) return false;
  if (!PROFILE_TOOLS.has(name) && !GENERATION_TOOLS.has(name)) return false; // SDK reports unknown tools.
  if (!user) throw new RemoteError(401, 'This tool requires a personal Remote MCP credential');
  if (PROFILE_TOOLS.has(name)) {
    if (!user.scopes.includes('profile')) throw new RemoteError(403, 'Profile permission required');
    return false;
  }
  const source = args?.modelSource || 'website';
  if (source === 'agent') {
    if (!user.scopes.includes('agent')) throw new RemoteError(403, 'Agent generation permission required');
    return false;
  }
  if (!user.scopes.includes('byok')) throw new RemoteError(403, 'Website generation requires BYOK permission');
  if (name === 'review_pull_request') throw new RemoteError(403, 'Remote website PR review is not supported yet; explicitly choose modelSource: agent');
  if (!request.headers.get('X-AI-Key')) throw new RemoteError(403, 'Provide your own API key in X-AI-Key; platform AI is disabled for Remote MCP');
  if (request.headers.has('X-AI-Base-Url')) throw new RemoteError(400, 'Custom model URLs are disabled for Remote MCP');
  if (!['openai', 'deepseek'].includes(request.headers.get('X-AI-Provider') || 'openai')) throw new RemoteError(400, 'Remote BYOK supports openai and deepseek only');
  return true;
}
