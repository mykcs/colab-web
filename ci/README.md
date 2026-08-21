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

## Maintenance

- Keep browser/tool versions pinned and update them deliberately.
- Keep the route matrix representative rather than exhaustive.
- Wait for Astro island hydration signals before testing `client:idle` or `client:visible` interactions; SSR-visible markup alone does not mean event handlers are ready.
- Do not put BaseModel private source, credentials, protected Preview share URLs, or repository secrets here.
- Lighthouse JSON artifacts are retained for 14 days; lab numbers are useful for regression direction, not a substitute for field Core Web Vitals.
