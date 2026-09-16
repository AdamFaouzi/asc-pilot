import { getEnv, requireEnv } from "@/lib/env";

import { ConsoleEmailProvider } from "./console";
import { ResendEmailProvider } from "./resend";
import type { EmailProvider } from "./types";

export type { EmailProvider, EmailWebhookEvent } from "./types";

/** Resolves the email sender from `EMAIL_PROVIDER`. */
export function getEmailProvider(): EmailProvider {
  const provider = getEnv().EMAIL_PROVIDER;

  switch (provider) {
    case "resend":
      return new ResendEmailProvider(
        requireEnv("RESEND_API_KEY", "the Resend email provider"),
        getEnv().RESEND_WEBHOOK_SECRET,
      );
    case "console":
      return new ConsoleEmailProvider();
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown email provider: ${String(exhaustive)}`);
    }
  }
}
