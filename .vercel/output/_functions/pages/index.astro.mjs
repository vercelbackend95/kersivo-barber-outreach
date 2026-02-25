import { e as createComponent, m as maybeRenderHead, g as addAttribute, r as renderTemplate, k as renderComponent, q as Fragment, w as renderScript, h as createAstro, u as unescapeHTML } from '../chunks/astro/server_DbsSVQQ7.mjs';
import 'piccolore';
import { $ as $$MainLayout } from '../chunks/MainLayout_DnE2OrBp.mjs';
/* empty css                                 */
import 'clsx';
import { p as prisma } from '../chunks/client_C4jvTHHS.mjs';
import { r as resolveShopId } from '../chunks/shopScope_BH7VvEiX.mjs';
import { f as formatGbp } from '../chunks/money_D2KUCpNK.mjs';
export { renderers } from '../renderers.mjs';

const $$Stats10 = createComponent(($$result, $$props, $$slots) => {
  const statsData = [
    {
      logo: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/company/fictional-company-logo-1.svg",
      avatar: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/avatar-1.webp",
      avatarFallback: "A",
      heading: "89%",
      text: "Stop spending on ads with zero conversions",
      href: "#"
    },
    {
      logo: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/company/fictional-company-logo-2.svg",
      avatar: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/avatar-2.webp",
      avatarFallback: "B",
      heading: "7 HRS",
      text: "Daily savings on ad management",
      href: "#"
    },
    {
      logo: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/company/fictional-company-logo-3.svg",
      avatar: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/avatar-3.webp",
      avatarFallback: "C",
      heading: "2,540%",
      text: "Growth in overall client ad investment",
      href: "#"
    }
  ];
  return renderTemplate`${maybeRenderHead()}<section class="stats10" aria-label="Campaign performance stats"> <div class="container stats10__container"> <div class="stats10__grid"> ${statsData.map(({ logo, avatar, avatarFallback, heading, text, href }, index) => renderTemplate`<a class="stats10__card-link"${addAttribute(href, "href")}${addAttribute(`Open case study ${index + 1}`, "aria-label")}> <article class="stats10__card"> <div class="stats10__brand-row"> <div class="stats10__avatar-wrap" aria-hidden="true"> <img class="stats10__avatar"${addAttribute(avatar, "src")} alt="" loading="lazy"> <span class="stats10__avatar-fallback">${avatarFallback}</span> </div> <img class="stats10__logo"${addAttribute(logo, "src")} alt="" loading="lazy"> </div> <p class="stats10__heading">${heading}</p> <p class="stats10__text">${text}</p> </article> </a>`)} </div> </div> </section>`;
}, "C:/dev/kersivo-barber-outreach/src/components/stats10.astro", void 0);

const $$Compare3 = createComponent(($$result, $$props, $$slots) => {
  const comparisonRows = [
    {
      feature: "Lead Qualification",
      icon: "\u{1F465}",
      kersivo: "Barber-focused lead scoring and intent filtering",
      competitor: "Generic contact forms with no fit scoring",
      kersivoPositive: true,
      competitorPositive: false
    },
    {
      feature: "Brand Customization",
      icon: "\u{1F3F7}\uFE0F",
      kersivo: "Full white-label scripts and outreach voice",
      competitor: "Basic template edits only",
      kersivoPositive: true,
      competitorPositive: true
    },
    {
      feature: "Automation & Integrations",
      icon: "\u2699\uFE0F",
      kersivo: "CRM-ready workflows and clear API handoff",
      competitor: "Limited or manual integrations",
      kersivoPositive: true,
      competitorPositive: false
    },
    {
      feature: "Performance Reporting",
      icon: "\u{1F4C8}",
      kersivo: "Revenue-focused reporting built for owners",
      competitor: "Clicks and vanity metrics",
      kersivoPositive: true,
      competitorPositive: false,
      badge: "New"
    },
    {
      feature: "Support",
      icon: "\u{1F3A7}",
      kersivo: "Dedicated support with strategic check-ins",
      competitor: "Ticket-based support only",
      kersivoPositive: true,
      competitorPositive: false
    }
  ];
  return renderTemplate`${maybeRenderHead()}<section class="compare3" aria-label="Comparison section"> <div class="container"> <div class="compare3__header"> <p class="compare3__eyebrow">Comparison</p> <h2>See How Kersivo Compares</h2> <p class="compare3__lead">
Discover why barbershop owners choose Kersivo over generic outreach services.
</p> </div> <div class="compare3__table-wrap"> <div class="compare3__table" role="table" aria-label="Kersivo vs alternatives"> <div class="compare3__cell compare3__cell--head"></div> <div class="compare3__cell compare3__cell--brand compare3__cell--highlight" role="columnheader"> <img src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/block-1.svg" alt="Kersivo logo" class="compare3__logo" loading="lazy"> <p class="compare3__brand-name">Kersivo</p> <p class="compare3__brand-copy">Built for barber outreach and booked appointments</p> </div> <div class="compare3__cell compare3__cell--brand" role="columnheader"> <img src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/block-2.svg" alt="Other agencies logo" class="compare3__logo" loading="lazy"> <p class="compare3__brand-name">Typical Agencies</p> <p class="compare3__brand-copy">Broad marketing support for many niches</p> </div> ${comparisonRows.map((row) => renderTemplate`${renderComponent($$result, "Fragment", Fragment, {}, { "default": ($$result2) => renderTemplate` <div class="compare3__cell compare3__cell--feature" role="rowheader"> <span class="compare3__feature-icon" aria-hidden="true">${row.icon}</span> <span>${row.feature}</span> ${row.badge && renderTemplate`<span class="compare3__badge">${row.badge}</span>`} </div> <div class="compare3__cell compare3__cell--highlight compare3__cell--value" role="cell"> <span${addAttribute(`compare3__status ${row.kersivoPositive ? "is-positive" : "is-negative"}`, "class")} aria-hidden="true"> ${row.kersivoPositive ? "\u2713" : "\u2014"} </span> <span>${row.kersivo}</span> </div> <div class="compare3__cell compare3__cell--value" role="cell"> <span${addAttribute(`compare3__status ${row.competitorPositive ? "is-positive" : "is-negative"}`, "class")} aria-hidden="true"> ${row.competitorPositive ? "\u2713" : "\u2014"} </span> <span>${row.competitor}</span> </div> ` })}`)} <div class="compare3__cell"></div> <div class="compare3__cell compare3__cell--highlight compare3__cell--cta"> <a class="btn btn--primary compare3__button" href="#">Book a Strategy Call</a> </div> <div class="compare3__cell"></div> </div> </div> </div> </section>`;
}, "C:/dev/kersivo-barber-outreach/src/components/compare3.astro", void 0);

const $$Timeline13 = createComponent(($$result, $$props, $$slots) => {
  const steps = [
    {
      number: "01",
      label: "Message",
      title: "Tell us what your barbershop needs",
      description: "Send one message with your goals and we map the fastest outreach setup for your shop.",
      status: "One message to start"
    },
    {
      number: "02",
      label: "Build",
      title: "We build your outreach system",
      description: "We prepare your scripts, pages, and automation flow so you can review everything before it goes live.",
      status: "Preview & approve"
    },
    {
      number: "03",
      label: "Launch",
      title: "Start getting booked appointments",
      description: "Once approved, your full barber outreach setup is published and ready to bring in new clients.",
      status: "Live on your domain"
    }
  ];
  return renderTemplate`${maybeRenderHead()}<section class="timeline13" aria-labelledby="timeline13-title" data-timeline13> <div class="container timeline13__container"> <div class="timeline13__intro"> <h2 id="timeline13-title">How it works</h2> <p>
A simple three-step rollout built for busy barbershop owners.
</p> </div> <div class="timeline13__surface surface"> <div class="timeline13__track" aria-hidden="true"> <span class="timeline13__line timeline13__line--base"></span> <span class="timeline13__line timeline13__line--active"></span> ${steps.map((step) => renderTemplate`<span class="timeline13__dot"${addAttribute(step.number, "data-step")}></span>`)} </div> <div class="timeline13__grid"> ${steps.map((step, index) => renderTemplate`<article class="timeline13__step"${addAttribute(index === 0 ? "first" : void 0, "data-timeline13-step")}> <div class="timeline13__chip"${addAttribute(`Step ${step.number}: ${step.label}`, "aria-label")}> <span>${step.number}</span> <span>${step.label}</span> </div> <h3>${step.title}</h3> <p>${step.description}</p> <small class="timeline13__status">${step.status}</small> </article>`)} </div> </div> </div> </section> ${renderScript($$result, "C:/dev/kersivo-barber-outreach/src/components/timeline13.astro?astro&type=script&index=0&lang.ts")}`;
}, "C:/dev/kersivo-barber-outreach/src/components/timeline13.astro", void 0);

const $$Astro$7 = createAstro();
const $$Feature43 = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$7, $$props, $$slots);
  Astro2.self = $$Feature43;
  const {
    title = "Fully Featured Outreach System for Modern Barbershops",
    features = [
      {
        heading: "Quality",
        description: "Built with attention to detail and proven outreach best practices. Every touchpoint is refined for reliability and consistent booking performance.",
        icon: "\u2197"
      },
      {
        heading: "Experience",
        description: "Crafted for real barbershop workflows. From first contact to booked appointment, every step is intuitive, clear, and easy to scale.",
        icon: "\u25A6"
      },
      {
        heading: "Support",
        description: "Get strategic guidance, practical documentation, and responsive human support so your team keeps momentum without guesswork.",
        icon: "\u25C9"
      },
      {
        heading: "Innovation",
        description: "Stay ahead with modern automation patterns and conversion-first messaging frameworks designed for the barber market.",
        icon: "\u2726"
      },
      {
        heading: "Results",
        description: "Use a system tested in real campaigns that prioritizes outcomes you care about: qualified leads, booked calls, and returning clients.",
        icon: "\u25A3"
      },
      {
        heading: "Efficiency",
        description: "Launch faster with lean execution and low-friction workflows that save time while improving campaign consistency.",
        icon: "\u2301"
      }
    ],
    buttonText = "See All Features",
    buttonUrl = "#"
  } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<section class="feature43" aria-labelledby="feature43-title"> <div class="container feature43__container"> ${title && renderTemplate`<div class="feature43__header"> <h2 id="feature43-title">${title}</h2> </div>`} <div class="feature43__grid"> ${features.map((feature) => renderTemplate`<article class="feature43__card"> <div class="feature43__icon-wrap" aria-hidden="true"> <span class="feature43__icon">${feature.icon}</span> </div> <h3>${feature.heading}</h3> <p>${feature.description}</p> </article>`)} </div> ${buttonUrl && renderTemplate`<div class="feature43__actions"> <a class="btn btn--secondary feature43__button"${addAttribute(buttonUrl, "href")}>${buttonText}</a> </div>`} </div> </section>`;
}, "C:/dev/kersivo-barber-outreach/src/components/feature43.astro", void 0);

const $$Astro$6 = createAstro();
const $$Feature228 = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$6, $$props, $$slots);
  Astro2.self = $$Feature228;
  const { className = "" } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<section${addAttribute(`feature228 ${className}`.trim(), "class")} aria-labelledby="feature228-title"> <div class="container"> <div class="feature228__layout"> <div class="feature228__content"> <h2 id="feature228-title">
Smart Outreach,
<br>
Smart Growth
</h2> <p class="feature228__lead">
Transform your barbershop pipeline with intelligent automation that adapts to your workflow
          and enhances daily lead conversion.
</p> <div class="feature228__grid"> <article class="feature228__item"> <span class="feature228__icon" aria-hidden="true">✦</span> <h3>Intelligent Messaging</h3> <p>
Control timing, channel, and follow-up logic with smart messaging that responds to each
              lead stage and improves consistency.
</p> </article> <article class="feature228__item"> <span class="feature228__icon" aria-hidden="true">◉</span> <h3>Advanced Security</h3> <p>
Monitor every conversation from one place with alerts, status visibility, and protection
              against dropped opportunities.
</p> </article> <article class="feature228__item"> <div class="feature228__badges" aria-hidden="true"> <span class="feature228__badge feature228__badge--accent"> <svg viewBox="0 0 384 512" class="feature228__brand-icon" role="presentation" focusable="false"> <path d="M318.7 268.7c-.2-44.2 36.1-65.4 37.8-66.5-20.6-30.1-52.7-34.2-64.1-34.7-27.3-2.8-53.2 16.1-67 16.1s-35-15.7-57.5-15.3c-29.6.4-56.9 17.2-72.1 43.7-30.7 53.2-7.8 132 22 175 14.6 21 32 44.5 54.9 43.7 22.1-.9 30.4-14.3 57.1-14.3s34.2 14.3 57.5 13.8c23.8-.4 38.8-21.5 53.3-42.6 16.8-24.5 23.7-48.2 24-49.4-.5-.2-45.9-17.6-46-69.5zM269.1 135.6c12.1-14.7 20.3-35.1 18.1-55.6-17.5.7-38.6 11.6-51.1 26.3-11.2 13-21 33.7-18.4 53.6 19.5 1.5 39.4-9.9 51.4-24.3z"></path> </svg> </span> <span class="feature228__badge"> <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="" class="feature228__brand-image" loading="lazy"> </span> </div> <h3>Ecosystem Integration</h3> <p>
Seamlessly connect with Apple and Google ecosystems for a unified campaign workflow
              across your key tools.
</p> </article> <article class="feature228__item"> <div class="feature228__badges" aria-hidden="true"> <span class="feature228__badge"> <img src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/x.svg" alt="" class="feature228__brand-image" loading="lazy"> </span> <span class="feature228__badge"> <img src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/facebook-icon.svg" alt="" class="feature228__brand-image" loading="lazy"> </span> </div> <h3>Social Connectivity</h3> <p>
Publish and distribute content across major social platforms including X and Facebook with
              one-click consistency.
</p> </article> </div> </div> <div class="feature228__media" aria-hidden="true"> <div class="feature228__media-column"> <img src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-2.svg" alt="" loading="lazy" class="feature228__img feature228__img--top"> <img src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-3.svg" alt="" loading="lazy" class="feature228__img feature228__img--bottom"> </div> <div class="feature228__phone-shell"> <div class="feature228__phone-body"> <div class="feature228__phone-speaker"></div> <div class="feature228__phone-screen-wrap"> <img src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-1.svg" alt="" loading="lazy" class="feature228__phone-screen"> </div> </div> </div> </div> </div> </div> </section>`;
}, "C:/dev/kersivo-barber-outreach/src/components/feature228.astro", void 0);

const $$Astro$5 = createAstro();
const $$Hero108 = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$5, $$props, $$slots);
  Astro2.self = $$Hero108;
  const {
    eyebrow = "Built for Serious Barbershop Owners",
    title = "Grow reliable monthly income from predictable outreach",
    highlightedWord = "income",
    description = "Launch a conversion-focused pipeline without wasting hours on random tactics. We help you get qualified leads and booked appointments every week.",
    bullets = [
      { text: "Average 9% lead-to-booking conversion improvement" },
      { text: "Clear reporting and campaign updates every week" },
      { text: "Human-crafted messaging tuned for barber clients" }
    ],
    ctaText = "Start Now",
    ctaUrl = "#",
    imageUrl = "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1280&q=80",
    imageAlt = "Barber preparing tools in a modern barbershop"
  } = Astro2.props;
  const highlightTitle = title.replace(highlightedWord, `<span class="hero108__highlight">${highlightedWord}</span>`);
  return renderTemplate`${maybeRenderHead()}<section class="hero108" aria-labelledby="hero108-title"> <div class="container hero108__layout"> <div class="hero108__content"> <p class="hero108__eyebrow">${eyebrow}</p> <h2 id="hero108-title">${unescapeHTML(highlightTitle)}</h2> <p class="hero108__description">${description}</p> <ul class="hero108__list" aria-label="Core benefits"> ${bullets.map((bullet) => renderTemplate`<li class="hero108__list-item"> <span class="hero108__check" aria-hidden="true"> <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M5 12.5L9.2 16.7L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter"></path> </svg> </span> <span>${bullet.text}</span> </li>`)} </ul> <a class="btn btn--primary hero108__cta"${addAttribute(ctaUrl, "href")}> <span>${ctaText}</span> <span class="hero108__arrow" aria-hidden="true">→</span> </a> </div> <div class="hero108__media"> <img${addAttribute(imageUrl, "src")}${addAttribute(imageAlt, "alt")} loading="lazy"> <div class="hero108__overlay" aria-hidden="true"></div> </div> </div> </section>`;
}, "C:/dev/kersivo-barber-outreach/src/components/hero108.astro", void 0);

const $$Astro$4 = createAstro();
const $$SettingsIntegrations3A = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$4, $$props, $$slots);
  Astro2.self = $$SettingsIntegrations3A;
  const {
    heading = "Connect your favorite tools",
    subHeading = "Save time using popular integrations to keep your barber outreach workflow synced.",
    integrations = [
      {
        image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/slack-icon.svg",
        title: "Slack",
        description: "Send instant lead alerts straight to your team channel.",
        isConnected: true,
        link: "#"
      },
      {
        image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/mainline/logos/drive.svg",
        title: "Google Drive",
        description: "Store scripts, reports, and client assets in one place.",
        isConnected: true,
        link: "#"
      },
      {
        image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/notion-icon.svg",
        title: "Notion",
        description: "Keep your outreach SOPs and campaign notes organized.",
        isConnected: true,
        link: "#",
        imageClass: "integrations3a__logo--invert"
      },
      {
        image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/mainline/logos/jira.svg",
        title: "Jira",
        description: "Track implementation tasks and monthly improvement sprints.",
        link: "#"
      },
      {
        image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/mainline/logos/asana.svg",
        title: "Asana",
        description: "Assign outreach tasks and follow-ups with clear ownership.",
        link: "#"
      },
      {
        image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/dropbox-icon.svg",
        title: "Dropbox",
        description: "Share haircut offer creatives and campaign files securely.",
        link: "#"
      },
      {
        image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/figma-icon.svg",
        title: "Figma",
        description: "Review and approve ad visuals before launch.",
        link: "#"
      },
      {
        image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/github-icon.svg",
        title: "GitHub",
        description: "Version control landing page and automation updates.",
        isConnected: true,
        link: "#",
        imageClass: "integrations3a__logo--invert"
      },
      {
        image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/ecommerce/payment-methods/stripe.svg",
        title: "Stripe",
        description: "Collect subscription payments with clean reporting.",
        link: "#"
      },
      {
        image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/mainline/logos/confluence.svg",
        title: "Confluence",
        description: "Build a shared playbook for outreach execution.",
        link: "#"
      },
      {
        image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/mainline/logos/monday.svg",
        title: "Monday",
        description: "Monitor campaign status and onboarding timelines.",
        link: "#"
      },
      {
        image: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/mainline/logos/excel.svg",
        title: "Excel",
        description: "Analyze conversion data and revenue trends quickly.",
        isConnected: true,
        link: "#"
      }
    ]
  } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<section class="integrations3a" aria-labelledby="integrations3a-title"> <div class="container integrations3a__container"> <div class="integrations3a__header"> <h2 id="integrations3a-title">${heading}</h2> <p>${subHeading}</p> </div> <ul class="integrations3a__grid"> ${integrations.map((integration, index) => renderTemplate`<li class="integrations3a__item"${addAttribute(`${integration.title}-${index}`, "key")}> <a class="integrations3a__card"${addAttribute(integration.link, "href")}> <div class="integrations3a__card-top"> <img${addAttribute(["integrations3a__logo", integration.imageClass], "class:list")}${addAttribute(integration.image, "src")}${addAttribute(integration.title, "alt")} loading="lazy"> ${integration.isConnected ? renderTemplate`<span class="integrations3a__badge">Connected</span>` : renderTemplate`<span class="integrations3a__arrow" aria-hidden="true">→</span>`} </div> <div class="integrations3a__card-copy"> <p class="integrations3a__name">${integration.title}</p> <p class="integrations3a__description">${integration.description}</p> </div> </a> </li>`)} </ul> </div> </section>`;
}, "C:/dev/kersivo-barber-outreach/src/components/settingsIntegrations3a.astro", void 0);

const $$ShopProductCards6 = createComponent(async ($$result, $$props, $$slots) => {
  const shopId = await resolveShopId();
  const products = await prisma.product.findMany({
    where: { shopId, active: true },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
    take: 3
  });
  return renderTemplate`${maybeRenderHead()}<section class="shop6" aria-labelledby="shop6-title"> <div class="container shop6__container"> <div class="shop6__header"> <p class="shop6__eyebrow">Shop</p> <h2 id="shop6-title">Barber Products Ready for Pickup</h2> <p>These featured products are synced with Admin → Shop → Products.</p> </div> <ul class="shop6__grid"> ${products.length === 0 ? renderTemplate`<li class="shop6__item"> <article class="shop6__card"> <div class="shop6__content"> <h3>No products yet</h3> <p class="muted">Add products in Admin to publish them on the landing page and /shop.</p> </div> </article> </li>` : products.map((product, index) => renderTemplate`<li class="shop6__item"${addAttribute(`${product.name}-${index}`, "key")}> <article class="shop6__card"> ${product.imageUrl ? renderTemplate`<img${addAttribute(product.imageUrl, "src")}${addAttribute(product.name, "alt")} loading="lazy" class="shop6__image">` : renderTemplate`<div class="shop6__image shop6__image--placeholder" aria-hidden="true"></div>`} <div class="shop6__content"> <p class="shop6__collection">Featured item</p> <h3>${product.name}</h3> <div class="shop6__footer"> <p class="shop6__price">${formatGbp(product.pricePence)}</p> <div class="shop6__actions"> <button class="btn btn--primary" type="button" data-add-to-cart${addAttribute(product.id, "data-product-id")}${addAttribute(product.name, "data-product-name")}${addAttribute(String(product.pricePence), "data-product-price-pence")}${addAttribute(product.imageUrl ?? "", "data-product-image-url")}>
Add to cart
</button> <a class="btn btn--ghost" href="/shop">View in shop</a> </div> </div> </div> </article> </li>`)} </ul> </div> </section>`;
}, "C:/dev/kersivo-barber-outreach/src/components/shopProductCards6.astro", void 0);

const $$Astro$3 = createAstro();
const $$Faq4 = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$3, $$props, $$slots);
  Astro2.self = $$Faq4;
  const {
    heading = "Common Questions & Answers",
    subHeading = "Find out all the essential details about our platform and how it can serve your needs.",
    supportHeading = "Still have questions?",
    supportText = "We're here to provide clarity and assist with any queries you may have.",
    supportLinkLabel = "Contact Support",
    supportLinkHref = "#",
    faqs = [
      {
        question: "What is a FAQ and why is it important?",
        answer: "FAQ stands for Frequently Asked Questions. It provides answers to common questions about a product or service. A clear FAQ helps visitors get instant information without contacting support."
      },
      {
        question: "Why should I use a FAQ on my website or app?",
        answer: "A FAQ gives users quick help 24/7. It improves the customer experience and reduces repetitive support questions so your team can focus on higher-impact conversations."
      },
      {
        question: "How do I effectively create a FAQ section?",
        answer: "Start by collecting the most frequent questions from prospects and clients. Then write concise, practical answers in plain language and update them as your offer evolves."
      },
      {
        question: "What are the benefits of having a well-maintained FAQ section?",
        answer: "It improves trust, shortens decision time, and lowers support load. A maintained FAQ keeps information accurate and helps users solve issues faster."
      },
      {
        question: "How should I organize my FAQ for optimal usability?",
        answer: "Group questions into clear categories and order them by priority. Keep each entry scannable with a short question title and a direct answer."
      },
      {
        question: "How often should I update my FAQ, and why is it necessary?",
        answer: "Review your FAQ regularly\u2014especially after changing pricing, onboarding, integrations, or workflows. Current content prevents confusion and keeps conversion friction low."
      }
    ]
  } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<section class="faq4" aria-labelledby="faq4-title"> <div class="container faq4__container"> <div class="faq4__header"> <p class="faq4__badge">FAQ</p> <h2 id="faq4-title">${heading}</h2> <p>${subHeading}</p> </div> <div class="faq4__list" role="list"> ${faqs.map((faq, index) => renderTemplate`<details class="faq4__item" name="faq4-group" role="listitem"> <summary> <span>${faq.question}</span> <span class="faq4__icon" aria-hidden="true">→</span> </summary> <p>${faq.answer}</p> </details>`)} </div> <hr class="faq4__separator"> <div class="faq4__footer"> <div> <h3>${supportHeading}</h3> <p>${supportText}</p> </div> <a${addAttribute(supportLinkHref, "href")} class="faq4__support-link"> ${supportLinkLabel} <span aria-hidden="true">→</span> </a> </div> </div> </section>`;
}, "C:/dev/kersivo-barber-outreach/src/components/faq4.astro", void 0);

const $$Astro$2 = createAstro();
const $$Cta10 = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$Cta10;
  const {
    heading = "Ready to Fill More Chairs Every Week?",
    description = "Book a short strategy call and get a clear outreach plan tailored to your barbershop, local market, and revenue targets.",
    buttons = {
      primary: {
        text: "Book a Strategy Call",
        url: "#"
      },
      secondary: {
        text: "See How It Works",
        url: "#"
      }
    },
    className = ""
  } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<section${addAttribute(`cta10 ${className}`.trim(), "class")} aria-labelledby="cta10-title"> <div class="container"> <div class="cta10__panel"> <div class="cta10__content"> <h3 id="cta10-title">${heading}</h3> <p>${description}</p> </div> <div class="cta10__actions"> ${buttons.secondary && renderTemplate`<a${addAttribute(buttons.secondary.url, "href")} class="btn btn--secondary"> ${buttons.secondary.text} </a>`} ${buttons.primary && renderTemplate`<a${addAttribute(buttons.primary.url, "href")} class="btn btn--primary"> ${buttons.primary.text} </a>`} </div> </div> </div> </section>`;
}, "C:/dev/kersivo-barber-outreach/src/components/cta10.astro", void 0);

const $$Astro$1 = createAstro();
const $$Contact16 = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Contact16;
  const { className = "" } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<section${addAttribute(`contact16 ${className}`.trim(), "class")} aria-labelledby="contact16-title"> <div class="container"> <h2 id="contact16-title" class="contact16__title">
Get in Touch
<sup>*</sup> </h2> <div class="contact16__layout"> <div class="contact16__info"> <p class="contact16__description">
Tell us about your barbershop goals and we will prepare a focused outreach plan built for
          your local market.
</p> <div class="contact16__links" aria-label="Contact links"> <a href="tel:+1020020023">Phone: +102 002 0023</a> <a href="mailto:hello@company.com">Email: hello@company.com</a> </div> </div> <form class="contact16__form" action="#" method="post"> <label> <span class="sr-only">Name</span> <input type="text" name="name" placeholder="Name*" required> </label> <label> <span class="sr-only">Email</span> <input type="email" name="email" placeholder="Email*" required> </label> <label> <span class="sr-only">Message</span> <input type="text" name="message" placeholder="Message (Tell us about your project)" required> </label> <button type="submit" class="btn btn--ghost contact16__submit">
↳ Get in Touch
</button> </form> </div> </div> </section>`;
}, "C:/dev/kersivo-barber-outreach/src/components/contact16.astro", void 0);

const $$Astro = createAstro();
const $$Footer50 = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Footer50;
  const {
    heading = "Start your free trial today",
    description = "The fit-for-purpose tool for planning and building modern software products.",
    ctaText = "Get started",
    ctaHref = "#",
    navigation = [
      { name: "Product", href: "#" },
      { name: "About Us", href: "/about" },
      { name: "Pricing", href: "/pricing" },
      { name: "FAQ", href: "/faq" },
      { name: "Contact", href: "/contact" }
    ],
    social = [
      { name: "Twitter", href: "#" },
      { name: "LinkedIn", href: "#" }
    ],
    legal = [{ name: "Privacy Policy", href: "/privacy" }],
    brandName = "mainline",
    className = ""
  } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<footer${addAttribute(`footer50 ${className}`.trim(), "class")} aria-label="Footer"> <div class="container footer50__intro"> <h2>${heading}</h2> <p>${description}</p> <div> <a class="btn btn--primary footer50__cta"${addAttribute(ctaHref, "href")}>${ctaText}</a> </div> </div> <nav class="container footer50__nav" aria-label="Footer navigation"> <ul class="footer50__menu"> ${navigation.map((item) => renderTemplate`<li> <a${addAttribute(item.href, "href")}>${item.name}</a> </li>`)} ${social.map((item) => renderTemplate`<li> <a${addAttribute(item.href, "href")} class="footer50__social-link"> ${item.name} <span aria-hidden="true" class="footer50__arrow">↗</span> </a> </li>`)} </ul> <ul class="footer50__legal"> ${legal.map((item) => renderTemplate`<li> <a${addAttribute(item.href, "href")}>${item.name}</a> </li>`)} </ul> </nav> <div class="footer50__brand"${addAttribute(brandName, "aria-label")}> <span>${brandName}</span> </div> </footer>`;
}, "C:/dev/kersivo-barber-outreach/src/components/footer50.astro", void 0);

const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "MainLayout", $$MainLayout, { "title": "Kersivo Barber Outreach" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="hero103"> <section class="hero103__section"> <div class="container hero103__layout"> <div class="hero103__content"> <p class="hero103__eyebrow">Kersivo Barber Outreach</p> <h1>Get More Clients for Your Barbershop</h1> <p class="hero103__lead">
We build a predictable lead generation system for barbers — fast onboarding, transparent
            pricing, and scalable growth that actually works.
</p> <div class="hero103__actions"> <a class="btn btn--primary" href="#">Book a Demo</a> <a class="btn btn--ghost hero103__guide" href="#">
Outreach Guide for Barbers
<span aria-hidden="true" class="hero103__arrow">→</span> </a> </div> </div> <div class="hero103__media" aria-hidden="true"> <div class="hero103__image hero103__image--main"> <img src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-1.svg" alt="" loading="lazy"> </div> <div class="hero103__image hero103__image--top-left"> <img src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-2.svg" alt="" loading="lazy"> </div> <div class="hero103__image hero103__image--bottom-left"> <img src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-3.svg" alt="" loading="lazy"> </div> <div class="hero103__image hero103__image--right"> <img src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-4.svg" alt="" loading="lazy"> </div> </div> </div> </section> ${renderComponent($$result2, "Stats10", $$Stats10, {})} ${renderComponent($$result2, "Compare3", $$Compare3, {})} ${renderComponent($$result2, "Feature43", $$Feature43, {})} ${renderComponent($$result2, "Feature228", $$Feature228, {})} ${renderComponent($$result2, "Timeline13", $$Timeline13, {})} ${renderComponent($$result2, "Hero108", $$Hero108, {})} ${renderComponent($$result2, "SettingsIntegrations3a", $$SettingsIntegrations3A, {})} ${renderComponent($$result2, "ShopProductCards6", $$ShopProductCards6, {})} ${renderComponent($$result2, "Faq4", $$Faq4, {})} ${renderComponent($$result2, "Cta10", $$Cta10, {})} ${renderComponent($$result2, "Contact16", $$Contact16, {})} ${renderComponent($$result2, "Footer50", $$Footer50, { "heading": "Ready to Fill Your Chairs?", "description": "Book a quick strategy call and we will map a predictable outreach plan for your barbershop in under 20 minutes.", "ctaText": "Book a Strategy Call", "ctaHref": "#", "brandName": "Kersivo", "navigation": [
    { name: "Services", href: "#" },
    { name: "Case Studies", href: "#" },
    { name: "Pricing", href: "#" },
    { name: "FAQ", href: "#" },
    { name: "Contact", href: "#" }
  ], "social": [
    { name: "Instagram", href: "#" },
    { name: "Facebook", href: "#" }
  ], "legal": [
    { name: "Privacy Policy", href: "#" },
    { name: "Terms", href: "#" }
  ] })} </main> ` })}`;
}, "C:/dev/kersivo-barber-outreach/src/pages/index.astro", void 0);

const $$file = "C:/dev/kersivo-barber-outreach/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
