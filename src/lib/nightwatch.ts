// Night Watch: shared names for the app (docs/night-watch.md).

// The YORU official account (migration 0011). Sends moderation notices.
export const OFFICIAL_ID = "00000000-0000-4000-8000-0000000000f1";

export const NW_CATEGORIES = ["minors", "hate", "threats", "sexual", "scam", "private_info", "harassment", "violence", "self_harm", "spam"] as const;
export type NwCategory = (typeof NW_CATEGORIES)[number];

export const NW_LABEL: Record<string, string> = {
  minors: "Child safety",
  hate: "Hate speech",
  threats: "Threats & violence",
  sexual: "Sexual content",
  scam: "Scams",
  private_info: "Private information",
  harassment: "Harassment",
  violence: "Graphic content",
  self_harm: "Self-harm",
  spam: "Spam",
  repeat_media: "Removed media",
  other: "Other",
};

export const NW_ACTIONS = ["allow", "label", "flag", "hold", "remove"] as const;
export const NW_ACTION_LABEL: Record<string, string> = {
  allow: "Allow",
  label: "Screen (blur)",
  flag: "Flag for a person",
  hold: "Hold for review",
  remove: "Remove + strike",
};

export const VERDICT_LABEL: Record<string, string> = {
  allow: "Allowed",
  label: "Screened",
  flag: "Flagged",
  hold: "Held",
  remove: "Removed",
  block: "Blocked",
};

export type NwEvent = {
  id: string;
  created_at: string;
  target_type: "post" | "comment" | "story" | "message" | "user";
  target_id: string | null;
  source: "rules" | "ai" | "reports" | "media" | "staff";
  verdict: keyof typeof VERDICT_LABEL;
  category: string;
  label: string;
  severe: boolean;
  confidence: number | null;
  reason: string;
  excerpt: string;
  media_url: string | null;
  media_type: string | null;
  status: "open" | "auto" | "upheld" | "overturned" | "dismissed";
  removed: boolean;
  test_mode: boolean;
  report_count: number;
  note: string;
  reviewed_at: string | null;
  reviewer: { display_name: string; username: string } | null;
  author: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    role: string;
    created_at: string;
    muted_until: string | null;
    banned: boolean;
    strikes: number;
  } | null;
  reports: { reason: string; category: string; created_at: string }[] | null;
  appeal: { id: string; status: string; body: string } | null;
};
