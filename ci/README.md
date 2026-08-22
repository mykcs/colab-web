# BaseModel public production browser acceptance

This repository hosts a deliberately small **black-box** browser harness for the already-public BaseModel production site:

- target: `https://basemodel-preview.vercel.app`;
- WebKit: Playwright `1.62.1` / WebKit `26.5` on GitHub-hosted Ubuntu 24.04;
- performance: Lighthouse `13.4.1` lab measurements;
- schedule: daily plus manual dispatch.

The harness does **not** check out, copy, or require access to the private `mykcs/basemodel` repository. It visits only public production URLs.

## Evidence boundary

This workflow is durable **Production black-box** evidence. It is not an exact-head PR/Preview gate for the private BaseModel repository.

BaseModel still owns:

- deterministic source/build validation;
- exact-head Vercel Preview acceptance;
- Chromium UI tests tied to the candidate tree;
- merge race checks and Production release identity.

This external workflow adds an independent post-release WebKit and lab-performance surface without consuming private-repository GitHub-hosted Actions minutes or trying to run Playwright WebKit inside Vercel's Amazon Linux build environment.

## Current production checks

### WebKit

The scheduled WebKit run covers representative Chinese/English routes across:

- 390×844 mobile;
- 768×1024 tablet;
- 1440×1000 desktop;
- light and dark themes.

It also exercises the mobile menu, Families and paper quick views, Landscape visible hydration, desktop resources/search, and theme switching. The route matrix includes the WebShop training note because that surface has previously exposed theme/scoping regressions.

### Lighthouse

Each run records JSON for:

- home mobile;
- home desktop;
- OpenEvo results mobile;
- OpenEvo results desktop.

The workflow prints FCP, LCP, TBT, CLS, Speed Index and the Lighthouse performance score. It fails only on a clear lab regression:

- performance score < 90;
- LCP > 3000 ms;
- TBT > 300 ms;
- CLS > 0.1.

These thresholds are regression budgets, not claims about field Core Web Vitals. Vercel Speed Insights remains the field/RUM source once enough real-user data accumulates.

The workflow also verifies that `/_vercel/speed-insights/script.js` is reachable before Lighthouse runs, so a broken field-metrics collector is visible as a monitoring failure.

## Maintenance

- Keep browser/tool versions pinned and update them deliberately.
- Keep the route matrix representative rather than exhaustive.
- Wait for Astro island hydration signals before testing `client:idle` or `client:visible` interactions; SSR-visible markup alone does not mean event handlers are ready.
- Do not put BaseModel private source, credentials, protected Preview share URLs, or repository secrets here.
- Lighthouse JSON artifacts are retained for 14 days; lab numbers are useful for regression direction, not a substitute for field Core Web Vitals.
- If a budget proves noisy, diagnose the lab variance before relaxing it; do not turn a real regression into a warning just to keep the monitor green.
