import type { OutreachEmail } from "@/core/types";

/**
 * The outreach message.
 *
 * Constraints this copy has to satisfy, not all of them aesthetic:
 *   - It says plainly why they received it and what is being offered.
 *   - The subject describes the message. No fake "Re:", no invented urgency,
 *     no implied prior relationship.
 *   - Sender identity is real, and a postal address is included — required for
 *     commercial email under EU rules.
 *   - Ignoring it costs the recipient nothing, and that is stated.
 *   - Greek first, English below, matching the site itself.
 *
 * One message, one recipient, written from that business's own data. If this
 * copy ever stops being specific to the business, the whole premise is gone.
 */

export interface ComposeInput {
  businessName: string;
  previewUrl: string;
  toAddress: string;
  fromAddress: string;
  fromName: string;
  replyTo?: string;
  postalAddress: string;
  unsubscribeUrl: string;
  priceLabel: string;
  priceLabelEl: string;
}

export const TEMPLATE_ID = "preview-offer-v1";

export function composeOutreach(input: ComposeInput): OutreachEmail {
  const subject = `${input.businessName} — μια έτοιμη ιστοσελίδα / a website, ready to see`;

  const text = `Καλησπέρα,

Είδα ότι η ${input.businessName} δεν έχει ιστοσελίδα, οπότε έφτιαξα μία και μπορείτε να τη δείτε εδώ:

${input.previewUrl}

Είναι πραγματική και ολοκληρωμένη — όχι δείγμα. Αν σας αρέσει, τη βγάζω online για ${input.priceLabelEl}. Αν όχι, δεν χρειάζεται να κάνετε τίποτα και δεν θα ξαναλάβετε μήνυμα.

Τα στοιχεία σας τα βρήκα σε δημόσιους καταλόγους επιχειρήσεων.

${input.fromName}
${input.postalAddress}

Διαγραφή: ${input.unsubscribeUrl}

—

Hello,

I noticed ${input.businessName} doesn't have a website, so I built one. You can see it here:

${input.previewUrl}

It's a real, finished page — not a mock-up. If you like it, I'll put it online for ${input.priceLabel}. If not, you don't need to do anything, and you won't hear from me again.

I found your details in public business listings.

${input.fromName}
${input.postalAddress}

Unsubscribe: ${input.unsubscribeUrl}
`;

  const html = `<!doctype html>
<html lang="el"><body style="margin:0;padding:24px;font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;background:#ffffff;">
<div style="max-width:520px;margin:0 auto;">
<p>Καλησπέρα,</p>
<p>Είδα ότι η <strong>${escapeHtml(input.businessName)}</strong> δεν έχει ιστοσελίδα, οπότε έφτιαξα μία και μπορείτε να τη δείτε εδώ:</p>
<p><a href="${escapeHtml(input.previewUrl)}" style="color:#1B6E8C;">${escapeHtml(input.previewUrl)}</a></p>
<p>Είναι πραγματική και ολοκληρωμένη — όχι δείγμα. Αν σας αρέσει, τη βγάζω online για <strong>${escapeHtml(input.priceLabelEl)}</strong>. Αν όχι, δεν χρειάζεται να κάνετε τίποτα και δεν θα ξαναλάβετε μήνυμα.</p>
<p style="color:#666;font-size:13px;">Τα στοιχεία σας τα βρήκα σε δημόσιους καταλόγους επιχειρήσεων.</p>
<hr style="border:0;border-top:1px solid #e5e5e5;margin:24px 0;">
<p>Hello,</p>
<p>I noticed <strong>${escapeHtml(input.businessName)}</strong> doesn't have a website, so I built one. You can see it here:</p>
<p><a href="${escapeHtml(input.previewUrl)}" style="color:#1B6E8C;">${escapeHtml(input.previewUrl)}</a></p>
<p>It's a real, finished page — not a mock-up. If you like it, I'll put it online for <strong>${escapeHtml(input.priceLabel)}</strong>. If not, you don't need to do anything, and you won't hear from me again.</p>
<p style="color:#666;font-size:13px;">I found your details in public business listings.</p>
<hr style="border:0;border-top:1px solid #e5e5e5;margin:24px 0;">
<p style="color:#666;font-size:12px;">
${escapeHtml(input.fromName)}<br>${escapeHtml(input.postalAddress)}<br>
<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#666;">Διαγραφή / Unsubscribe</a>
</p>
</div></body></html>`;

  return {
    to: input.toAddress,
    from: `${input.fromName} <${input.fromAddress}>`,
    replyTo: input.replyTo,
    subject,
    text,
    html,
    unsubscribeUrl: input.unsubscribeUrl,
    headers: {
      "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}
