/** Download contract for the Nimbus Windows Agent installer. */

export const NIMBUS_WINDOWS_AGENT_ASSET = "NimbusAgent-Setup-x64.exe";
export const NIMBUS_WINDOWS_AGENT_REPO = "Micka420-collab/nimbus";
export const NIMBUS_WINDOWS_AGENT_LOCAL_PATH = `/nimbus-agent/${NIMBUS_WINDOWS_AGENT_ASSET}`;

export function nimbusWindowsAgentGithubDownloadUrl(repo = NIMBUS_WINDOWS_AGENT_REPO): string {
  return `https://github.com/${repo}/releases/latest/download/${NIMBUS_WINDOWS_AGENT_ASSET}`;
}

export function nimbusWindowsAgentGithubReleasesUrl(repo = NIMBUS_WINDOWS_AGENT_REPO): string {
  return `https://github.com/${repo}/releases/latest`;
}

export function nimbusWindowsAgentDocsUrl(repo = NIMBUS_WINDOWS_AGENT_REPO): string {
  return `https://github.com/${repo}/blob/main/nimbus/windows-agent/README.md`;
}

export function resolveNimbusWindowsAgentDownload(options?: { localAvailable?: boolean }): {
  href: string;
  source: "gateway" | "github";
} {
  if (options?.localAvailable === true) {
    return { href: NIMBUS_WINDOWS_AGENT_LOCAL_PATH, source: "gateway" };
  }
  return { href: nimbusWindowsAgentGithubDownloadUrl(), source: "github" };
}
