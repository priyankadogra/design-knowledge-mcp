---
name: design-knowledge-files
description: Baseline (skill-only) way to answer design-system questions by reading the corpus files directly, without the MCP server. Use when asked to answer a design question "with the skill baseline" or to compare against the MCP server.
---

# Design knowledge — skill-only baseline

This is the **before** version of the project: no index, no ranking, just
instructions and files. Use it to find where a skill alone breaks down, then
compare against the `design-knowledge` MCP server using the same questions in
`evals/questions.json`.

## Where knowledge lives

- `corpus/vendor/carbon/src/pages/components/<component>/{usage,style,code,accessibility}.mdx`
  — canonical component guidelines (design system team)
- `corpus/vendor/primer/contributor-docs/adrs/*.md` — architecture decision records
- `corpus/synthetic/<team>/*.md` — team docs; frontmatter holds `status`, `scope`, `appliesTo`

## How to answer

1. Grep for the component or topic across those folders. Read only the
   sections you need, not whole files.
2. Apply precedence:
   - `current` beats `proposed`, which beats `superseded` / `deprecated`
   - `canonical` beats `team-local`, unless the question is about that team's product
   - a later decision-log entry beats the guidance it says it supersedes
3. If sources disagree, say so and name both, with team, status, and date.
4. Cite the file path and section heading for every claim.

## Things to note while testing (for the write-up)

- How many tokens did reading the files cost?
- Did it find the right section, or read whole files?
- Did it notice team-local overrides and deprecated docs on its own?
