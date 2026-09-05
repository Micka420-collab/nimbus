import { describe, expect, it } from "vitest";
import {
  NIMBUS_WINDOWS_AGENT_ASSET,
  nimbusWindowsAgentGithubDownloadUrl,
  resolveNimbusWindowsAgentDownload,
} from "./nimbus-windows-agent.ts";

describe("nimbus Windows Agent download", () => {
  it("prefers a gateway-served installer when the operator placed one", () => {
    expect(resolveNimbusWindowsAgentDownload({ localAvailable: true })).toEqual({
      href: `/nimbus-agent/${NIMBUS_WINDOWS_AGENT_ASSET}`,
      source: "gateway",
    });
  });

  it("falls back to the latest GitHub release asset", () => {
    const resolved = resolveNimbusWindowsAgentDownload();
    expect(resolved.source).toBe("github");
    expect(resolved.href).toBe(nimbusWindowsAgentGithubDownloadUrl());
    expect(resolved.href.endsWith(NIMBUS_WINDOWS_AGENT_ASSET)).toBe(true);
  });
});
