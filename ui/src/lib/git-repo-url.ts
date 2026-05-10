const HTTP_GIT_REPO_PROTOCOLS = new Set(["http:", "https:"]);

export function isHttpGitRepoUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    if (!HTTP_GIT_REPO_PROTOCOLS.has(parsed.protocol)) return false;
    if (!parsed.host) return false;
    return parsed.pathname.split("/").filter(Boolean).length > 0;
  } catch {
    return false;
  }
}
