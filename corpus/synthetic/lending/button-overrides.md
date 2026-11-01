---
title: Lending app — button overrides
team: Lending
scope: team-local
status: current
docType: guideline
component: button
updated: 2026-03-12
appliesTo: Lending mobile app only
---

# Lending app — button overrides

The Lending mobile app extends the canonical button guidance. These overrides
apply **only** to the Lending app. Everywhere else, follow the design system.

## Internal padding

Lending uses **12px** horizontal internal padding on primary buttons in the loan
calculator, because the calculator keypad leaves very little horizontal room.
The design system default is 16px; do not copy this override into other apps.

## Toast duration

Loan approval toasts stay on screen for **10 seconds** instead of the standard
duration. Research showed applicants re-read approval amounts before the toast
disappeared (see the onboarding research synthesis).

## Button labels

Lending keeps sentence case and the verb + noun formula, for example
"Review offer" and "Sign agreement".
