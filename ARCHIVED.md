# Archived — 2026-09-28

This repository is intentionally archived.

## Why

`colab-web` started as a small Colab / interactive-web experiment repository. It was later temporarily reused as a public GitHub Actions host for BaseModel WebKit and Lighthouse checks when BaseModel needed an external browser runner.

That workaround is no longer part of the architecture:

- BaseModel now owns its repository and browser acceptance in `mykcs/basemodel`;
- BaseModel Production is access-protected by Vercel Authentication rather than a public website;
- anonymous external browser/Lighthouse probes can land on the Vercel login surface and therefore are not trustworthy BaseModel product evidence;
- the borrowed BaseModel workflow and harness were removed from `colab-web`;
- all historical BaseModel workflow records in this repository were disabled;
- historical workflow runs and Git history are intentionally retained as audit evidence.

## Current status

`colab-web` has **CI mode `CI_NONE`** and has no active deployment, monitoring, or cross-repository CI responsibility.

Do not reactivate this repository as a borrowed CI runner for BaseModel or another project. If a project needs browser, deployment, or Production monitoring, keep that responsibility inside the owning project's repository/provider boundary unless a new, explicitly documented architecture decision says otherwise.

For current BaseModel CI, hosting, and release authority, use `mykcs/basemodel` rather than this archive.
