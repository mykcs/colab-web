# colab-web

> **Archived 2026-09-28.** See [ARCHIVED.md](ARCHIVED.md) for the retirement reason and current ownership boundary.

Historical Colab / interactive-web experiments.

Original references:

- Gradio + Weights & Biases integration: https://www.gradio.app/guides/Gradio-and-Wandb-Integration
- JoJoGAN Colab example: https://colab.research.google.com/github/mchong6/JoJoGAN/blob/main/stylize.ipynb#scrollTo=_qNPut_ch3gr

## CI policy

**CI mode: `CI_NONE`.** This repository currently has no automatic hosted CI by design.

Do not use this repository as a borrowed CI runner, browser monitor, or deployment checker for unrelated projects. Each project owns its validation and monitoring inside its own repository/provider boundary.

A temporary cross-repository BaseModel browser harness previously lived here; it is retired. Git history and old workflow runs remain the audit trail for that experiment.

## Ownership migration — 2026-10-02

This repository no longer owns an active runtime, deployment, monitoring, or CI responsibility.

The temporary BaseModel WebKit/Lighthouse role was retired and absorbed by:
- `mykcs/basemodel` for current BaseModel browser/release authority;
- `mykcs/.agents` for the durable borrowed-CI lesson and retirement receipts.

This repository is retained only as historical Git/workflow evidence. It is being moved from the primary working account to `suiyue77/colab-web` and should remain archived. New work must not restart here.
