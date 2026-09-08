export type ObservationChangeKind =
  | "brand_appeared"
  | "brand_disappeared"
  | "candidate_entered"
  | "candidate_left"
  | "recommendation_gained"
  | "recommendation_lost"
  | "official_citation_added"
  | "official_citation_removed"
  | "competitor_appeared_without_target"
  | "competitor_no_longer_replaces_target";

export interface ObservationChange {
  id: string;
  kind: ObservationChangeKind;
  projectId: string;
  baselineId: string;
  currentRunId: string;
  previousRunId: string;
  currentObservationIds: string[];
  previousObservationIds: string[];
  promptIds: string[];
  models: string[];
  entityNames: string[];
  citationUrls: string[];
}

export interface EvidenceBackedChangeSet {
  comparable: boolean;
  reasonKey: string;
  currentRunId?: string | undefined;
  previousRunId?: string | undefined;
  changes: ObservationChange[];
}
