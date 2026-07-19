export const CURRENT_SOURCE_STEP = 'STEP059';

const ARTIFACT_SHA_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;

export function normalizeArtifactSha(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ARTIFACT_SHA_PATTERN.test(normalized) ? normalized : null;
}

export function getRuntimeArtifactSha() {
  for (const value of [
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.RAILWAY_GIT_COMMIT_SHA,
    process.env.RELEASE_ARTIFACT_SHA
  ]) {
    const normalized = normalizeArtifactSha(value);
    if (normalized) return normalized;
  }
  return null;
}
