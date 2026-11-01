/** Normalized status across every source. Drives precedence and filtering. */
export type Status = "current" | "proposed" | "superseded" | "deprecated" | "unknown";

/** canonical = applies everywhere; team-local = one team's override or copy. */
export type Scope = "canonical" | "team-local";

export type DocType = "guideline" | "decision" | "research" | "spec";

export interface DocMeta {
  /** Stable id, e.g. "carbon/components/button/usage". */
  id: string;
  title: string;
  source: string; // "carbon" | "primer" | "synthetic"
  team: string;
  scope: Scope;
  status: Status;
  docType: DocType;
  components: string[];
  updated?: string;
  appliesTo?: string;
  supersededBy?: string;
  path: string;
}

export interface Doc extends DocMeta {
  /** Cleaned markdown body (MDX/JSX noise removed). */
  body: string;
}

export interface Chunk {
  /** `${docId}#${slug}` */
  id: string;
  docId: string;
  /** Heading breadcrumb, e.g. ["Button", "Usage", "Button sizes"]. */
  headingPath: string[];
  text: string;
  /**
   * Contextual header prepended before indexing (contextual retrieval):
   * where the chunk came from and how authoritative it is.
   */
  contextHeader: string;
  tokens: number;
  meta: DocMeta;
}
