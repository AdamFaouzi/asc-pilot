import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DeployResult, DeployTarget } from "@/core/types";
import { getEnv } from "@/lib/env";

import type { HostingProvider } from "./types";

/**
 * Writes generated sites to `generated-sites/<env>/<slug>/` and serves them
 * from the app itself. Good enough to review sites locally before committing
 * to a hosting vendor; `generated-sites/` is gitignored.
 */
export class LocalHostingProvider implements HostingProvider {
  readonly key = "local";

  private readonly root = path.join(process.cwd(), "generated-sites");

  private dirFor(target: DeployTarget): string {
    return path.join(this.root, target.environment, target.slug);
  }

  urlFor(target: DeployTarget): string {
    const base = getEnv().APP_URL.replace(/\/$/, "");
    return `${base}/s/${target.environment}/${target.slug}`;
  }

  async deploy(target: DeployTarget, files: Record<string, string>): Promise<DeployResult> {
    const dir = this.dirFor(target);
    await mkdir(dir, { recursive: true });

    for (const [relativePath, contents] of Object.entries(files)) {
      const destination = path.join(dir, relativePath);
      // Guard against a generated filename escaping the site directory.
      if (!destination.startsWith(dir + path.sep)) {
        throw new Error(`Refusing to write outside the site directory: ${relativePath}`);
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, contents, "utf8");
    }

    return {
      provider: this.key,
      deploymentId: `${target.environment}/${target.slug}`,
      url: this.urlFor(target),
    };
  }

  /**
   * Copies the existing preview build into the live directory. The business
   * bought the page they looked at, so promotion never rebuilds — it moves the
   * exact files that were reviewed.
   */
  async promote(deploymentId: string, target: DeployTarget): Promise<DeployResult> {
    const source = path.join(this.root, deploymentId);
    const destination = this.dirFor(target);

    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true });

    return {
      provider: this.key,
      deploymentId: `${target.environment}/${target.slug}`,
      url: this.urlFor(target),
    };
  }

  async remove(deploymentId: string): Promise<void> {
    await rm(path.join(this.root, deploymentId), { recursive: true, force: true });
  }
}
