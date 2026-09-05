export const WINDOWS_AGENT_ASSET = "NimbusAgent-Setup-x64.exe";
export const WINDOWS_AGENT_GITHUB_REPO = "Micka420-collab/nimbus";
export const WINDOWS_AGENT_LOCAL_PATH = `/nimbus-agent/${WINDOWS_AGENT_ASSET}`;

export function githubLatestDownloadUrl(repo = WINDOWS_AGENT_GITHUB_REPO) {
  return `https://github.com/${repo}/releases/latest/download/${WINDOWS_AGENT_ASSET}`;
}

export function githubLatestReleasePage(repo = WINDOWS_AGENT_GITHUB_REPO) {
  return `https://github.com/${repo}/releases/latest`;
}

/**
 * Prefer a gateway-served installer when the operator placed one next to
 * Control UI. Otherwise use the latest GitHub release asset.
 */
export function resolveWindowsAgentDownload(options = {}) {
  const localAvailable = options.localAvailable === true;
  const localUrl = options.localUrl ?? WINDOWS_AGENT_LOCAL_PATH;
  const githubUrl = options.githubUrl ?? githubLatestDownloadUrl(options.repo);
  if (localAvailable) {
    return { href: localUrl, source: "gateway" };
  }
  return { href: githubUrl, source: "github" };
}
