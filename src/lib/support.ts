// Contact form topics (mirrors the check constraint on public.support_messages).
export const SUPPORT_TOPICS = ["general", "account", "deletion", "privacy", "safety", "bug"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const TOPIC_LABELS: Record<SupportTopic, string> = {
  general: "General question",
  account: "Account or login help",
  deletion: "Delete my account or data",
  privacy: "Privacy request",
  safety: "Report abuse or a safety issue",
  bug: "Bug or problem",
};

// Optional public support address (set SUPPORT_EMAIL on the server).
export const supportEmail = () => process.env.SUPPORT_EMAIL?.trim() || null;

// Date shown on the privacy policy and terms.
export const LEGAL_UPDATED = "November 6, 2026";
