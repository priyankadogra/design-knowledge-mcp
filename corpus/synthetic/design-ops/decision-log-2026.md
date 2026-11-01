---
title: Design decision log — 2026
team: Design Ops
scope: canonical
status: current
docType: decision
component: notification, button
updated: 2026-07-15
---

# Design decision log — 2026

## 2026-04: Persistent toasts for financial confirmations

**Decision:** Toasts that confirm money movement or credit decisions must not
auto-dismiss. They include a close button and persist until dismissed.
**Why:** Onboarding research (Finding 2) showed people miss approval amounts.
**Supersedes:** The Lending 10-second toast override, for financial
confirmations only. Routine toasts keep the design system default.

## 2026-06: One primary button per screen

**Decision:** Product screens show at most one primary (high-emphasis) button.
**Why:** Onboarding research (Finding 1) and existing design system guidance.
