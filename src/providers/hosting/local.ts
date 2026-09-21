import { access, constants, cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DeployResult, DeployTarget } from "@/core/types";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

import type { HostingProvider } from "./types";

/**
 * Whether this process can write beside its own code.
 *
 * Checked rather than inferred from an errno: a serverless host reports the
 * refusal differently depending on the path and the runtime — Vercel answers
 * `mkdir /var/task/generated-sites` with ENOENT, not the EROFS you would
 * expect — and guessing the code wrongly turns a skippable write into a failed
 * customer promotion. Resolved once; the answer cannot change mid-process.
 */
let writable: Promise<boolean> | null = null;

function canWriteHere(): Promise<boolean> {
  writable ??= access(process.cwd(), constants.W_OK).then(
    () => true,
    () => false,
  );
  return writable;
}

/**
 * Writes generated sites to `generated-sites/<env>/<slug>/` and serves them
 * from the app itself. Good enough to review sites locally before committing
 * to a hosting vendor; `generated-sites/` is gitignored.
 *
 * The files are a local convenience, not the durable copy. `/s/<env>/<slug>`
 * reads the HTML from the database and only falls back to disk, because a
 * serverless filesystem does not survive between requests anyway.
 *
 * So a read-only filesystem is not a deployment failure. Throwing there took
 * down the whole promotion: `goLive` calls `deploy` before the transaction
 * that marks the site LIVE, so a business could pay, get a subscription row,
 * and never get their site. The write is skipped and reported instead.
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

    if (await canWriteHere()) {
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
    } else {
      logger.warn("hosting.local_no_filesystem", {
        slug: target.slug,
        environment: target.environment,
        detail: "read-only filesystem; the database copy is what gets served",
      });
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

    if (await canWriteHere()) {
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(source, destination, { recursive: true });
    }

    return {
      provider: this.key,
      deploymentId: `${target.environment}/${target.slug}`,
      url: this.urlFor(target),
    };
  }

  async remove(deploymentId: string): Promise<void> {
    // A cancellation must take the site down whether or not files exist.
    if (!(await canWriteHere())) return;
    await rm(path.join(this.root, deploymentId), { recursive: true, force: true });
  }
}
