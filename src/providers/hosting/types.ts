import type { DeployResult, DeployTarget } from "@/core/types";

/**
 * Where generated sites are served from.
 *
 * `promote` exists as its own operation because converting a preview to a live
 * site must not require regenerating it: the business paid for the site they
 * saw, so the same build is what goes live.
 */
export interface HostingProvider {
  readonly key: string;

  deploy(target: DeployTarget, files: Record<string, string>): Promise<DeployResult>;

  promote(deploymentId: string, target: DeployTarget): Promise<DeployResult>;

  remove(deploymentId: string): Promise<void>;

  /** The URL a given slug will be served at, without deploying anything. */
  urlFor(target: DeployTarget): string;
}
