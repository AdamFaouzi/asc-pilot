import type { Locale, Localized, OpeningHour, SiteContent } from "@/core/types";

import { renderEmblem, renderWatermark } from "./emblem";
import { escapeHtml } from "./html";
import { amenityLabel, DAYS, UI } from "./i18n";
import type { Palette, Template } from "./templates";
import { HERO_SIZE, monogramText, SECTION_SPACE, type Variation } from "./variation";

/**
 * Renders a SiteContent into one self-contained HTML file.
 *
 * Both languages are written into the document and switched with CSS, so:
 *   - the page is fully readable with JavaScript disabled,
 *   - the Greek version is what search engines and social previews see,
 *   - and no translation service is called when a visitor loads the page.
 *
 * The toggle only flips a class on <html>. That is the entire mechanism.
 */

export { escapeHtml } from "./html";

/**
 * Emits a string in both languages. Only the active one is visible; the other
 * is hidden by CSS, not removed, so switching needs no re-render.
 */
function bilingual(value: Localized | undefined, tag = "span"): string {
  if (!value) return "";
  return (
    `<${tag} data-lang="el">${escapeHtml(value.el)}</${tag}>` +
    `<${tag} data-lang="en">${escapeHtml(value.en)}</${tag}>`
  );
}

function formatHours(hours: OpeningHour[] | undefined): string {
  if (!hours?.length) return "";

  const byDay = new Map<number, OpeningHour[]>();
  for (const hour of hours) {
    byDay.set(hour.day, [...(byDay.get(hour.day) ?? []), hour]);
  }

  const rows = [1, 2, 3, 4, 5, 6, 0]
    .map((day) => {
      const entries = byDay.get(day);
      const times = entries?.map((entry) => `${entry.open} – ${entry.close}`).join(", ");

      const label =
        `<span data-lang="el">${escapeHtml(DAYS.el[day] ?? "")}</span>` +
        `<span data-lang="en">${escapeHtml(DAYS.en[day] ?? "")}</span>`;

      const value = times
        ? `<span>${escapeHtml(times)}</span>`
        : `<span class="muted">${bilingual(UI.closed)}</span>`;

      return `<div class="hours-row"><dt>${label}</dt><dd>${value}</dd></div>`;
    })
    .join("");

  return `<dl class="hours">${rows}</dl>`;
}

/** Inline SVG so the page has no external asset dependencies. */
const ICONS = {
  phone: `<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M222 158.4l-45.5-20.4a14 14 0 00-13.4 1.2l-23.1 15.4a86.3 86.3 0 01-38.6-38.4l15.5-23.4a14 14 0 001.1-13.3L97.6 34a14 14 0 00-14.5-8.2A54.2 54.2 0 0036 79.6C36 158.5 97.5 220 176.4 220a54.2 54.2 0 0053.8-47.1 14 14 0 00-8.2-14.5z"/></svg>`,
  mail: `<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M224 48H32a8 8 0 00-8 8v136a16 16 0 0016 16h176a16 16 0 0016-16V56a8 8 0 00-8-8zm-96 85.1L53.9 64h148.2zM40 76.2l53.2 48.9L40 179.6zm64.9 59.9l17.7 16.2a8 8 0 0010.8 0l17.7-16.2 51.8 55.9H53.1zM216 179.6l-53.2-54.5L216 76.2z"/></svg>`,
  pin: `<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M128 16a88.1 88.1 0 00-88 88c0 75.3 80 132.2 83.4 134.6a8 8 0 009.2 0C136 236.2 216 179.3 216 104a88.1 88.1 0 00-88-88zm0 56a32 32 0 11-32 32 32 32 0 0132-32z"/></svg>`,
  facebook: `<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M128 24a104 104 0 1096 143.4V160h-24a8 8 0 010-16h24v-24a36 36 0 0136-36h16a8 8 0 010 16h-16a20 20 0 00-20 20v24h28a8 8 0 010 16h-28v63.6A104 104 0 00128 24z"/></svg>`,
  instagram: `<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M176 24H80a56 56 0 00-56 56v96a56 56 0 0056 56h96a56 56 0 0056-56V80a56 56 0 00-56-56zm-48 148a44 44 0 1144-44 44 44 0 01-44 44zm52-92a12 12 0 1112-12 12 12 0 01-12 12z"/></svg>`,
};

function contactBlock(content: SiteContent, locale: Locale): string {
  const contact = content.contact;
  if (!contact) return "";

  const items: string[] = [];

  if (contact.phone) {
    items.push(
      `<a class="contact-item" href="tel:${escapeHtml(contact.phone.replace(/\s/g, ""))}">
         <span class="icon">${ICONS.phone}</span>
         <span class="contact-body">
           <span class="contact-label">${bilingual(UI.callUs)}</span>
           <span class="contact-value">${escapeHtml(contact.phone)}</span>
         </span>
       </a>`,
    );
  }

  if (contact.email) {
    items.push(
      `<a class="contact-item" href="mailto:${escapeHtml(contact.email)}">
         <span class="icon">${ICONS.mail}</span>
         <span class="contact-body">
           <span class="contact-label">${bilingual(UI.emailUs)}</span>
           <span class="contact-value">${escapeHtml(contact.email)}</span>
         </span>
       </a>`,
    );
  }

  if (contact.address) {
    const query = encodeURIComponent(contact.mapQuery ?? contact.address.el);
    items.push(
      `<a class="contact-item" href="https://www.openstreetmap.org/search?query=${query}" target="_blank" rel="noopener noreferrer">
         <span class="icon">${ICONS.pin}</span>
         <span class="contact-body">
           <span class="contact-label">${bilingual(UI.findUs)}</span>
           <span class="contact-value">${bilingual(contact.address)}</span>
         </span>
       </a>`,
    );
  }

  const socials = [
    contact.facebook ? `<a href="${escapeHtml(contact.facebook)}" target="_blank" rel="noopener noreferrer" aria-label="Facebook">${ICONS.facebook}</a>` : "",
    contact.instagram ? `<a href="${escapeHtml(contact.instagram)}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${ICONS.instagram}</a>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <section id="contact" class="section reveal">
      <h2 class="section-title">${bilingual(UI.contact)}</h2>
      <div class="contact-grid">${items.join("")}</div>
      ${mapBlock(content, locale)}
      ${socials ? `<div class="socials"><span class="contact-label">${bilingual(UI.followUs)}</span><div class="social-links">${socials}</div></div>` : ""}
    </section>`;
}

/**
 * OpenStreetMap embed at the business's real coordinates. No API key, no
 * billing, and — unlike everything else on the page — it is different for every
 * single business, which does more for "this was made for us" than any amount
 * of palette shuffling.
 */
function mapBlock(content: SiteContent, locale: Locale): string {
  const point = content.contact?.location;
  if (!point) return "";

  const { latitude, longitude } = point;
  const box = [longitude - 0.004, latitude - 0.002, longitude + 0.004, latitude + 0.002]
    .map((value) => value.toFixed(5))
    .join(",");

  const src =
    `https://www.openstreetmap.org/export/embed.html?bbox=${box}` +
    `&layer=mapnik&marker=${latitude.toFixed(5)},${longitude.toFixed(5)}`;

  const title = locale === "el" ? "Χάρτης" : "Map";

  return `<div class="map"><iframe src="${escapeHtml(src)}" title="${title}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`;
}

/**
 * Photographs of the business.
 *
 * These are the single biggest thing missing: a local business page with no
 * pictures reads as a placeholder however good the copy is. Sources that carry
 * them (Google Places) require attribution, so each photo keeps whatever
 * attribution string came with it.
 *
 * Stock imagery is deliberately not an option — a photo of someone else's
 * dining room on this business's page is a claim their customers would act on.
 */
function galleryBlock(content: SiteContent): string {
  const photos = (content.gallery ?? []).filter((photo) => photo.url);
  if (photos.length === 0) return "";

  const items = photos
    .slice(0, 6)
    .map(
      (photo) => `<figure class="shot">
        <img src="${escapeHtml(photo.url!)}" alt="${escapeHtml(content.businessName)}" loading="lazy" />
        ${photo.attribution ? `<figcaption>${escapeHtml(photo.attribution)}</figcaption>` : ""}
      </figure>`,
    )
    .join("");

  return `<section id="gallery" class="gallery-strip reveal"><div class="shots">${items}</div></section>`;
}

/** Quotes from real reviews. Never written, only quoted. */
function testimonialsBlock(content: SiteContent): string {
  const quotes = (content.testimonials ?? []).filter((entry) => entry.quote);
  if (quotes.length === 0) return "";

  const items = quotes
    .slice(0, 3)
    .map(
      (entry) => `<blockquote class="quote">
        <p>${bilingual(entry.quote)}</p>
        ${entry.author ? `<cite>${escapeHtml(entry.author)}</cite>` : ""}
      </blockquote>`,
    )
    .join("");

  return `<section id="reviews" class="section wrap reveal">
    <h2 class="section-title">${bilingual(UI.whatPeopleSay)}</h2>
    <div class="quotes">${items}</div>
  </section>`;
}

/**
 * Facts someone recorded about the place. Only keys with a known label are
 * shown, so an unrecognised tag is dropped rather than printed raw.
 */
function amenitiesBlock(content: SiteContent): string {
  const items = (content.amenities ?? [])
    .map((key) => amenityLabel(key))
    .filter((label): label is NonNullable<typeof label> => Boolean(label));

  if (items.length === 0) return "";

  return `<section id="good-to-know" class="section wrap reveal">
    <h2 class="section-title">${bilingual(UI.goodToKnow)}</h2>
    <ul class="facts">${items.map((label) => `<li>${bilingual(label)}</li>`).join("")}</ul>
  </section>`;
}

function stylesheet(template: Template, v: Variation): string {
  const p: Palette = template.palette;
  const hero = HERO_SIZE[v.typeScale];
  const space = SECTION_SPACE[v.rhythm];

  return `
:root {
  --bg: ${p.bg};
  --surface: ${p.surface};
  --border: ${p.border};
  --text: ${p.text};
  --muted: ${p.muted};
  --accent: ${v.accent};
  --accent-text: ${v.accentText};
  --section-space: ${space}px;
  --radius: ${template.radius}px;
  --ease: cubic-bezier(0.32, 0.72, 0, 1);
  color-scheme: ${p.scheme};
}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Manrope, ui-sans-serif, system-ui, sans-serif;
  font-size: 16px;
  line-height: 24px;
  text-wrap: pretty;
}

/* Language switching: both languages ship in the document, CSS picks one. */
[data-lang="en"] { display: none; }
html.lang-en [data-lang="el"] { display: none; }
html.lang-en [data-lang="en"] { display: inline; }
html.lang-en dt [data-lang="en"], html.lang-en dd [data-lang="en"] { display: inline; }

a { color: inherit; }
img { max-width: 100%; }

.skip {
  position: absolute; left: -9999px; top: 8px;
  background: var(--accent); color: var(--accent-text);
  padding: 8px 12px; border-radius: var(--radius); z-index: 10;
}
.skip:focus { left: 16px; }

:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

.wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }

/* Nav: floating pill, detached from the top. */
.nav {
  position: sticky; top: 0; z-index: 5;
  display: flex; justify-content: center;
  padding-top: 24px; padding-bottom: 8px;
  pointer-events: none;
}
.nav-inner {
  pointer-events: auto;
  display: flex; align-items: center; gap: 16px;
  width: max-content; max-width: calc(100% - 48px);
  padding: 8px 8px 8px 16px;
  border: 1px solid var(--border); border-radius: 999px;
  background: color-mix(in srgb, var(--bg) 80%, transparent);
  backdrop-filter: blur(16px);
}
.nav-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lang-toggle {
  font: inherit; font-size: 14px; font-weight: 600;
  padding: 8px 12px; border: 0; border-radius: 999px;
  background: var(--accent); color: var(--accent-text);
  cursor: pointer;
  transition: transform 700ms var(--ease), opacity 700ms var(--ease);
}
.lang-toggle:hover { opacity: 0.9; }
.lang-toggle:active { transform: scale(0.98); }

/* Hero */
.hero { padding: calc(var(--section-space) + 32px) 0 var(--section-space); text-align: ${v.heroLayout === "centered" ? "center" : "left"}; }
.hero-inner { max-width: 680px; ${v.heroLayout === "centered" ? "margin: 0 auto;" : ""} }
.hero-split { display: grid; gap: 32px; align-items: end; }
@media (min-width: 900px) {
  .hero-split { grid-template-columns: 1.35fr 1fr; gap: 48px; }
  .hero-split .hero-inner { max-width: none; }
}
.hero-card {
  padding: 24px; border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--surface);
}
.hero-card dt { font-size: 12px; line-height: 16px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.hero-card dd { margin: 4px 0 16px; font-size: 16px; line-height: 24px; overflow-wrap: anywhere; }
.hero-card dd:last-child { margin-bottom: 0; }

/*
 * The mark. A real logo when the business has one; otherwise the category
 * glyph paired with their initials — specific enough that two barbers on the
 * same street don't ship the same badge.
 */
.emblem { display: inline-flex; align-items: center; margin-bottom: 24px; color: var(--accent); }
.emblem-glyph { display: inline-flex; }
.emblem-initials { font-weight: 600; letter-spacing: 0.06em; }

.emblem-circle, .emblem-square {
  flex-direction: column; gap: 2px;
  width: 68px; height: 68px;
  border: 1px solid var(--accent);
}
.emblem-circle { border-radius: 999px; }
.emblem-square { border-radius: var(--radius); }
.emblem-circle .emblem-initials, .emblem-square .emblem-initials { font-size: 12px; }

.emblem-rule { gap: 12px; font-size: 14px; letter-spacing: 0.2em; }
.emblem-rule::after { content: ""; width: 40px; height: 1px; background: var(--accent); }

.emblem-logo img {
  max-height: 76px; max-width: 240px; width: auto; height: auto;
  object-fit: contain; border-radius: var(--radius);
}
/* The generated emblem waits behind a hotlinked logo, in case it never loads. */
.emblem-fallback { display: none; margin-bottom: 0; }
.emblem-logo.logo-failed img { display: none; }
.emblem-logo.logo-failed .emblem-fallback { display: inline-flex; }

/* Category as atmosphere: a large, faint glyph behind the hero. */
.hero { position: relative; overflow: hidden; }
.watermark {
  position: absolute; right: -110px; bottom: -130px;
  color: var(--accent); opacity: 0.06; pointer-events: none; line-height: 0;
}
@media (max-width: 767px) { .watermark { right: -190px; bottom: -170px; opacity: 0.045; } }
.eyebrow {
  font-size: 12px; line-height: 16px; font-weight: 600;
  letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted);
  margin: 0 0 16px;
}
.hero h1 {
  margin: 0; font-size: ${hero.mobile}px; line-height: 1; font-weight: 600;
  text-wrap: balance;
  background: linear-gradient(90deg, ${p.headingFrom}, ${p.headingTo});
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.hero p.sub { margin: 24px 0 0; font-size: 18px; line-height: 28px; color: var(--muted); text-wrap: balance; }
.cta-row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; ${template.heroAlign === "center" ? "justify-content: center;" : ""} }
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: var(--radius);
  font-size: 16px; font-weight: 600; text-decoration: none;
  transition: transform 700ms var(--ease), opacity 700ms var(--ease);
}
.btn svg { width: 20px; height: 20px; fill: currentColor; }
.btn-primary { background: var(--accent); color: var(--accent-text); }
.btn-secondary { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
.btn:hover { opacity: 0.9; }
.btn:active { transform: translateY(1px); }

/* Sections */
.section { padding: var(--section-space) 0; }
.section-title {
  margin: 0 0 32px; font-size: 12px; line-height: 16px; font-weight: 600;
  letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted);
  ${v.ruledSections ? "padding-bottom: 12px; border-bottom: 1px solid var(--border);" : ""}
}
.prose { max-width: 680px; margin: 0; font-size: 18px; line-height: 28px; }

/* The large-type statement — its own moment, not stacked under the hero. */
.statement { padding: calc(var(--section-space) + 16px) 0; }
.statement p {
  margin: 0; max-width: 680px;
  font-size: 36px; line-height: 40px; font-weight: 600; text-wrap: balance;
}
.statement .word {
  color: color-mix(in srgb, var(--text) 30%, transparent);
  transition: color 700ms var(--ease);
}
.statement .word.on { color: var(--text); }

.cards { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.card {
  padding: 24px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
}
.card h3 { margin: 0 0 8px; font-size: 18px; line-height: 28px; font-weight: 600; }
.card p { margin: 0; color: var(--muted); font-size: 16px; line-height: 24px; }

.hours { margin: 0; max-width: 480px; }
.hours-row {
  display: flex; justify-content: space-between; gap: 16px;
  padding: 12px 0; border-bottom: 1px solid var(--border);
}
.hours dt { color: var(--muted); }
.hours dd { margin: 0; font-variant-numeric: tabular-nums; }
.muted { color: var(--muted); }

.contact-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.contact-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 24px; text-decoration: none;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  transition: transform 700ms var(--ease), border-color 700ms var(--ease);
}
.contact-item:hover { border-color: var(--accent); transform: translateY(-2px); }
.contact-item:active { transform: translateY(0); }
.icon { flex: none; width: 24px; height: 24px; color: var(--accent); }
.icon svg { width: 100%; height: 100%; fill: currentColor; }
.contact-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.contact-label { font-size: 12px; line-height: 16px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.contact-value { font-size: 16px; line-height: 24px; overflow-wrap: anywhere; }

.socials { margin-top: 32px; display: flex; flex-direction: column; gap: 8px; }
.social-links { display: flex; gap: 8px; }
.social-links a {
  display: inline-flex; width: 40px; height: 40px; align-items: center; justify-content: center;
  border: 1px solid var(--border); border-radius: var(--radius); color: var(--muted);
  transition: color 700ms var(--ease), border-color 700ms var(--ease);
}
.social-links a:hover { color: var(--accent); border-color: var(--accent); }
.social-links svg { width: 20px; height: 20px; fill: currentColor; }

footer { padding: 48px 0 64px; border-top: 1px solid var(--border); color: var(--muted); font-size: 14px; line-height: 20px; }
footer p { margin: 0 0 8px; }

/* Photographs. Full-bleed, because pictures are what a visitor came for. */
.gallery-strip { padding: var(--section-space) 0; }
.shots {
  display: grid; gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  max-width: 1080px; margin: 0 auto; padding: 0 24px;
}
.shots .shot:first-child { grid-column: span 2; }
@media (max-width: 600px) { .shots .shot:first-child { grid-column: span 1; } }
.shot { margin: 0; position: relative; overflow: hidden; border-radius: var(--radius); background: var(--surface); }
.shot img { display: block; width: 100%; height: 100%; min-height: 200px; object-fit: cover; }
.shot figcaption {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 6px 8px; font-size: 12px; line-height: 16px;
  color: #fff; background: linear-gradient(transparent, rgba(0,0,0,0.6));
}

/* Recorded facts about the place. */
.facts {
  display: grid; gap: 12px; margin: 0; padding: 0; list-style: none;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.facts li {
  padding: 12px 16px; font-size: 16px; line-height: 24px;
  border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface);
}

/* Quoted reviews. */
.quotes { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.quote {
  margin: 0; padding: 24px;
  border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface);
}
.quote p { margin: 0; font-size: 18px; line-height: 28px; }
.quote cite { display: block; margin-top: 12px; font-size: 14px; font-style: normal; color: var(--muted); }

/* Preview-only offer banner. Never rendered on a live site. */
.offer {
  position: sticky; bottom: 0; z-index: 4;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(16px);
}
.offer-inner {
  max-width: 1080px; margin: 0 auto; padding: 16px 24px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
}
.offer-copy { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 220px; }
.offer-copy strong { font-size: 16px; line-height: 24px; font-weight: 600; }
.offer-copy span { font-size: 14px; line-height: 20px; color: var(--muted); }
.offer-btn {
  font: inherit; font-size: 16px; font-weight: 600;
  padding: 8px 12px; border: 0; border-radius: var(--radius);
  background: var(--accent); color: var(--accent-text); cursor: pointer;
  transition: transform 700ms var(--ease), opacity 700ms var(--ease);
}
.offer-btn:hover { opacity: 0.9; }
.offer-btn:active { transform: translateY(1px); }
.offer-btn[disabled] { opacity: 0.5; cursor: default; }
.offer-error { margin: 0; padding: 0 24px 16px; font-size: 14px; color: #B4342B; }

/* Scroll reveal */
.reveal { opacity: 0; transform: translateY(64px); filter: blur(12px); transition: opacity 800ms var(--ease), transform 800ms var(--ease), filter 800ms var(--ease); }
.reveal.shown { opacity: 1; transform: translateY(0); filter: blur(0); }
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; filter: none; transition: none; }
  .statement .word { color: var(--text); transition: none; }
  html { scroll-behavior: auto; }
}

/* Map of the business's actual location — factual, and different on every page. */
.map {
  margin-top: 24px; border: 1px solid var(--border); border-radius: var(--radius);
  overflow: hidden; line-height: 0; background: var(--surface);
}
.map iframe { width: 100%; height: 280px; border: 0; filter: ${p.scheme === "dark" ? "invert(0.9) hue-rotate(180deg)" : "none"}; }

@media (min-width: 768px) {
  .hero h1 { font-size: ${hero.desktop}px; }
  .statement p { font-size: 48px; line-height: 1; }
}`;
}

const SCRIPT = `
(function () {
  var root = document.documentElement;
  var KEY = 'asc-lang';

  function apply(lang) {
    root.classList.toggle('lang-en', lang === 'en');
    root.setAttribute('lang', lang);
    var button = document.querySelector('.lang-toggle');
    if (button) button.setAttribute('aria-label', lang === 'en' ? 'Αλλαγή σε Ελληνικά' : 'Switch to English');
  }

  try {
    var saved = localStorage.getItem(KEY);
    // Default to Greek; only honour an explicit previous choice.
    if (saved === 'en' || saved === 'el') apply(saved);
  } catch (e) {}

  var toggle = document.querySelector('.lang-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.classList.contains('lang-en') ? 'el' : 'en';
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
    });
  }

  // "Make it live" — hands off to Stripe Checkout.
  var offer = document.querySelector('.offer-btn');
  if (offer) {
    offer.addEventListener('click', function () {
      var error = document.querySelector('.offer-error');
      offer.disabled = true;
      if (error) error.hidden = true;

      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: offer.getAttribute('data-slug') })
      })
        .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
        .then(function (res) {
          if (res.ok && res.body.url) { window.location.href = res.body.url; return; }
          throw new Error(res.body.error || 'Could not start checkout');
        })
        .catch(function (e) {
          offer.disabled = false;
          if (error) { error.textContent = e.message; error.hidden = false; }
        });
    });
  }

  // Scroll reveals. IntersectionObserver, never a scroll listener.
  if ('IntersectionObserver' in window) {
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('shown');
          revealer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { revealer.observe(el); });

    // Statement words light up one at a time, in reading order.
    var words = document.querySelectorAll('.statement .word');
    var wordObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var index = Number(el.getAttribute('data-i') || 0);
        setTimeout(function () { el.classList.add('on'); }, index * 60);
        wordObserver.unobserve(el);
      });
    }, { rootMargin: '0px 0px -25% 0px' });
    words.forEach(function (el) { wordObserver.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('shown'); });
    document.querySelectorAll('.statement .word').forEach(function (el) { el.classList.add('on'); });
  }
})();`;

/** Wraps each word so it can be lit individually as the section scrolls in. */
function statementWords(value: string): string {
  return value
    .split(/\s+/)
    .map((word, index) => `<span class="word" data-i="${index}">${escapeHtml(word)}</span>`)
    .join(" ");
}

function statementBlock(content: SiteContent): string {
  if (!content.statement) return "";

  return `
    <section class="statement wrap">
      <p>
        <span data-lang="el">${statementWords(content.statement.el)}</span>
        <span data-lang="en">${statementWords(content.statement.en)}</span>
      </p>
    </section>`;
}

export interface RenderOptions {
  content: SiteContent;
  template: Template;
  /** Business category, for the glyph and watermark. */
  category?: string;
  variation: Variation;
  /** Slug, so the preview banner can start checkout for this site. */
  slug?: string;
  /** Price label shown on the preview banner, resolved from Stripe. */
  priceLabel?: { el: string; en: string };
  /** Absolute URL the page will be served at, for meta tags. */
  url?: string;
  /** Shown as a banner on preview builds so it is never mistaken for live. */
  preview?: boolean;
  /** Attribution required by the places data licence. */
  attribution?: string;
}

export function renderSite({ content, template, category, variation, slug, priceLabel, url, preview, attribution }: RenderOptions): string {
  const locale: Locale = content.defaultLocale ?? "el";
  const name = escapeHtml(content.businessName);

  const description = content.tagline?.[locale] ?? content.hero.subheading?.[locale] ?? "";

  const services = content.services?.length
    ? `<section id="services" class="section wrap reveal">
         <h2 class="section-title">${bilingual(UI.services)}</h2>
         <div class="cards">
           ${content.services
             .map(
               (service) => `<div class="card">
                  <h3>${bilingual(service.name)}</h3>
                  ${service.description ? `<p>${bilingual(service.description)}</p>` : ""}
                </div>`,
             )
             .join("")}
         </div>
       </section>`
    : "";

  const about = content.about
    ? `<section id="about" class="section wrap reveal">
         <h2 class="section-title">${bilingual(UI.about)}</h2>
         <p class="prose">${bilingual(content.about, "span")}</p>
       </section>`
    : "";

  const amenities = amenitiesBlock(content);
  const gallery = galleryBlock(content);
  const testimonials = testimonialsBlock(content);

  const hours = content.hours?.length
    ? `<section id="hours" class="section wrap reveal">
         <h2 class="section-title">${bilingual(UI.hours)}</h2>
         ${formatHours(content.hours)}
       </section>`
    : "";

  const primaryCta = content.contact?.phone
    ? `<a class="btn btn-primary" href="tel:${escapeHtml(content.contact.phone.replace(/\s/g, ""))}">
         ${ICONS.phone}${bilingual(content.hero.ctaLabel ?? UI.callUs)}
       </a>`
    : content.contact?.email
      ? `<a class="btn btn-primary" href="mailto:${escapeHtml(content.contact.email)}">
           ${ICONS.mail}${bilingual(content.hero.ctaLabel ?? UI.emailUs)}
         </a>`
      : "";

  const secondaryCta = content.contact?.address
    ? `<a class="btn btn-secondary" href="#contact">${ICONS.pin}${bilingual(UI.directions)}</a>`
    : "";

  const emblem = renderEmblem({
    businessName: content.businessName,
    initials: monogramText(content.businessName),
    category,
    style: variation.monogram,
    logoUrl: content.logoUrl,
  });

  const heroBody = `
      ${emblem}
      ${content.tagline ? `<p class="eyebrow">${bilingual(content.tagline)}</p>` : ""}
      <h1>${bilingual(content.hero.heading)}</h1>
      ${content.hero.subheading ? `<p class="sub">${bilingual(content.hero.subheading)}</p>` : ""}
      <div class="cta-row">${primaryCta}${secondaryCta}</div>`;

  // The split hero lifts the practical details beside the name, which changes
  // the shape of the page rather than just its colour.
  const heroCard =
    variation.heroLayout === "split" && (content.contact?.phone || content.contact?.address)
      ? `<dl class="hero-card">
           ${content.contact?.phone ? `<dt>${bilingual(UI.callUs)}</dt><dd>${escapeHtml(content.contact.phone)}</dd>` : ""}
           ${content.contact?.address ? `<dt>${bilingual(UI.findUs)}</dt><dd>${bilingual(content.contact.address)}</dd>` : ""}
         </dl>`
      : "";

  const watermark = renderWatermark(category, content.businessName);

  const hero = heroCard
    ? `<header class="hero wrap">${watermark}<div class="hero-split"><div class="hero-inner">${heroBody}</div>${heroCard}</div></header>`
    : `<header class="hero wrap">${watermark}<div class="hero-inner">${heroBody}</div></header>`;

  /*
   * The offer, shown only on preview builds. It sits at the bottom rather than
   * over the page because the page is the pitch — the owner should see their
   * site first and the price second. It is removed entirely once the site is
   * live, so a paying customer never sees a sales banner on their own website.
   */
  const banner =
    preview && slug
      ? `<div class="offer" id="offer">
           <div class="offer-inner">
             <div class="offer-copy">
               <strong data-lang="el">Σας αρέσει; Ας τη βγάλουμε online.</strong>
               <strong data-lang="en">Like it? Let's put it online.</strong>
               <span data-lang="el">Δική σας ιστοσελίδα για ${escapeHtml(priceLabel?.el ?? "")}. Ακύρωση όποτε θέλετε.</span>
               <span data-lang="en">Your own website for ${escapeHtml(priceLabel?.en ?? "")}. Cancel any time.</span>
             </div>
             <button class="offer-btn" type="button" data-slug="${escapeHtml(slug)}">
               <span data-lang="el">Ενεργοποίηση</span><span data-lang="en">Make it live</span>
             </button>
           </div>
           <p class="offer-error" hidden></p>
         </div>`
      : "";

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}${description ? ` — ${escapeHtml(description)}` : ""}</title>
<meta name="description" content="${escapeHtml(description)}">
${preview ? '<meta name="robots" content="noindex, nofollow">' : ""}
<meta property="og:type" content="website">
<meta property="og:title" content="${name}">
<meta property="og:description" content="${escapeHtml(description)}">
${url ? `<meta property="og:url" content="${escapeHtml(url)}">` : ""}
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${template.palette.accent}"/><text x="16" y="22" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="${template.palette.accentText}">${content.businessName.trim().charAt(0)}</text></svg>`,
  )}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600&display=swap&subset=greek,latin" rel="stylesheet">
<style>${stylesheet(template, variation)}</style>
</head>
<body>
<a class="skip" href="#main">
  <span data-lang="el">Μετάβαση στο περιεχόμενο</span><span data-lang="en">Skip to content</span>
</a>

<nav class="nav" aria-label="${locale === "el" ? "Κύρια πλοήγηση" : "Main navigation"}">
  <div class="nav-inner">
    <span class="nav-name">${name}</span>
    <button class="lang-toggle" type="button" aria-label="Switch to English">
      <span data-lang="el">English</span><span data-lang="en">Ελληνικά</span>
    </button>
  </div>
</nav>

<main id="main">
  ${hero}

  ${statementBlock(content)}
  ${gallery}
  ${about}
  ${services}
  ${amenities}
  ${hours}
  ${testimonials}
  <div class="wrap">${contactBlock(content, locale)}</div>
</main>

${banner}
<footer class="wrap">
  <p>© ${new Date().getFullYear()} ${name}</p>
  ${attribution ? `<p>${escapeHtml(attribution)}</p>` : ""}
</footer>

<script>${SCRIPT}</script>
</body>
</html>`;
}
