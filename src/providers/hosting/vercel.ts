import type { DeployResult, DeployTarget } from "@/core/types";
import { getEnv } from "@/lib/env";

import type { HostingProvider } from "./types";

/**
 * Vercel adapter — one deployment per generated site, aliased to
 * `<slug>.<PREVIEW_DOMAIN>`. Phase 3 implements deploy; Phase 5 implements
 * promote (re-alias the existing deployment to the live domain).
 */
export class VercelHostingProvider implements HostingProvider {
  readonly key = "vercel";

  constructor(
    private readonly token: string,
    private readonly projectId?: string,
    private readonly teamId?: string,
  ) {}

  urlFor(target: DeployTarget): string {
    if (target.environment === "live" && target.customDomain) {
      return `https://${target.customDomain}`;
    }
    return `https://${target.slug}.${getEnv().PREVIEW_DOMAIN}`;
  }

  async deploy(_target: DeployTarget, _files: Record<string, string>): Promise<DeployResult> {
    throw new Error("VercelHostingProvider.deploy is not implemented yet (Phase 3).");
  }

  async promote(_deploymentId: string, _target: DeployTarget): Promise<DeployResult> {
    throw new Error("VercelHostingProvider.promote is not implemented yet (Phase 5).");
  }

  async remove(_deploymentId: string): Promise<void> {
    throw new Error("VercelHostingProvider.remove is not implemented yet (Phase 3).");
  }
}
