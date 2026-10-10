// One stable 20% sample per anonymous browser/day, shared by browser and server.
function sampledSession(session) {
  let hash = 2166136261;
  for (const char of session) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash % 5 === 0;
}
const RETRY_MS = 60000;
const MAX_RETRY_MS = 300000;
module.exports = { sampledSession, RETRY_MS, MAX_RETRY_MS };
