/**
 * Vocabulary normalization. Teams say "CTA", research notes say "big purple
 * button", the design system says "primary button". Each group maps to the
 * same canonical terms at query time.
 *
 * Grow this list from the eval failures ("in corpus but not retrieved").
 */
export const SYNONYM_GROUPS: string[][] = [
  ["primary button", "cta", "call to action", "main action", "big purple button", "high-emphasis button"],
  ["toast", "snackbar", "toast notification", "confirmation message"],
  ["notification", "alert", "banner"],
  ["modal", "dialog", "popup", "overlay"],
  ["text input", "text field", "input field", "textbox"],
  ["dropdown", "select", "picker", "combobox"],
  ["tag", "chip", "pill", "badge"],
  ["toggle", "switch"],
  ["padding", "spacing", "inset"],
  ["dismiss", "timeout", "auto-dismiss", "disappear", "close"],
  ["label", "copy", "button text", "wording"],
];

/** Component name aliases for structured lookup (get_component). */
export const COMPONENT_ALIASES: Record<string, string> = {
  cta: "button",
  "primary button": "button",
  snackbar: "toast",
  toast: "notification",
  alert: "notification",
  dialog: "modal",
  popup: "modal",
  "text field": "text-input",
  textfield: "text-input",
  input: "text-input",
  select: "dropdown",
  picker: "dropdown",
  chip: "tag",
  switch: "toggle",
};

/** Expand a query with synonyms of any phrase it contains. */
export function expandQuery(query: string): string {
  const q = query.toLowerCase();
  const extra = new Set<string>();
  for (const group of SYNONYM_GROUPS) {
    if (group.some((term) => q.includes(term))) group.forEach((t) => extra.add(t));
  }
  return extra.size ? `${query} ${[...extra].join(" ")}` : query;
}
