// Shapes returned by the Postgres RPCs (see supabase/migrations/0001_core.sql).

export type Role = "owner" | "admin" | "moderator" | "member";

export interface ProfileLite {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  badge: string;
  verified: boolean;
  is_bot: boolean;
  role: Role;
  status: string;
  online: boolean;
  // Added in migration 0003; optional so older cached data still type-checks.
  level?: number;
  accent_hue?: number;
  flair?: string;
  // Pro Universe (migration 0009): the public look, effective items only.
  look?: PublicLook | null;
}

export interface PublicLook {
  ring?: string;
  nameplate?: string;
  badge?: string;
}

export type CurrentlyKind = "watching" | "reading" | "listening" | "playing";

export interface Progress {
  xp: number;
  level: number;
  level_floor: number;
  next_level_at: number;
  streak: number;
  best_streak: number;
  checked_in_today?: boolean;
  accent_hue: number;
  flair: string;
  currently_kind: CurrentlyKind | null;
  currently_title: string | null;
  pinned_post_id?: string | null;
  muted_until?: string | null;
}

export interface ProfileExtras extends Progress {
  muted: boolean;
  pinned: Post | null;
}

export interface CheckinResult {
  already: boolean;
  streak: number;
  gained: number;
  xp: number;
  level: number;
  leveled_up?: boolean;
  // Night Pass streak shield used (Open Gates, migration 0007).
  shielded?: boolean;
}

export interface Announcement {
  id: string;
  text: string;
  tone: "info" | "event" | "alert";
  created_at: string;
}

export interface SiteState {
  announcement: Announcement | null;
  lockdown: boolean;
  slow_mode: number;
  nightly_prompt: string | null;
  open_signup?: boolean;
}

export interface SupportMessage {
  id: string;
  email: string | null;
  topic: "general" | "account" | "deletion" | "privacy" | "safety" | "bug";
  message: string;
  status: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  user: ProfileLite | null;
}

export interface AdminSite extends SiteState {
  word_filter: string[];
  updated: Record<string, { at: string; by: string | null }>;
}

export interface AdminStats {
  totals: Record<"members" | "posts" | "comments" | "messages" | "active_24h" | "active_7d" | "open_reports" | "muted" | "banned", number>;
  daily: { day: string; posts: number; comments: number; messages: number; joins: number }[];
  top_posters: { profile: ProfileLite; score: number }[];
  top_tags: { tag: string; count: number }[];
}

export interface AuditEntry {
  id: string;
  action: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  actor: ProfileLite | null;
  target: ProfileLite | null;
}

export interface MemberExtras {
  xp: number;
  level: number;
  streak: number;
  flair: string;
  muted_until: string | null;
}

export interface NotificationPrefs {
  likes: boolean;
  comments: boolean;
  mentions: boolean;
  reposts: boolean;
  messages: boolean;
  awards: boolean;
  friend_posts: boolean;
  // migration 0017 (on unless turned off)
  following_posts?: boolean;
  follows?: boolean;
  top_posts?: boolean;
  moonrise?: boolean;
}

export interface Me extends ProfileLite {
  bio: string;
  roast_opt_in: boolean;
  roast_intensity: 1 | 2 | 3;
  leaderboard_opt_in: boolean;
  ai_context_opt_in: boolean;
  notification_prefs: NotificationPrefs;
  inside_jokes: string[];
  chaos_points: number;
  created_at: string;
  unread_notifications: number;
  unread_messages: number;
}

export type ReactionKind = "heart" | "skull" | "fire" | "clown" | "cap" | "crying" | "salute" | "w" | "l";
export type AwardKind = "menace" | "war_crime" | "touch_grass" | "galaxy_brain" | "skill_issue" | "ratio";
export type MediaType = "image" | "video" | "gif";

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface PostCore {
  id: string;
  kind: "post" | "poll" | "roast" | "news" | "repost";
  body: string;
  media_url: string | null;
  media_type: MediaType | null;
  link_url: string | null;
  roast: string | null;
  roast_label: string | null;
  hashtags: string[];
  created_at: string;
  author: ProfileLite;
  target: ProfileLite | null;
  counts: { likes: number; comments: number; reposts: number };
  reactions: Partial<Record<ReactionKind, number>>;
  my_reactions: ReactionKind[];
  bookmarked: boolean;
  reposted: boolean;
  awards: Partial<Record<AwardKind, number>>;
  my_awards: AwardKind[];
  poll: { options: PollOption[]; total: number; my_vote: string | null } | null;
}

export interface Post extends PostCore {
  repost_of: PostCore | null;
  // Night Watch: "label" = behind a sensitive screen, "held" = under review.
  mod?: { state: "label" | "held"; label: string | null } | null;
  // Moonrise (docs/MOONRISE.md): the public badge (3 Full Moon, 4 Blood Moon),
  // and for the author only, where the post is in its climb.
  moon?: 3 | 4 | null;
  moon_mine?: MoonMine | null;
  // For You only: why this post is on the page, and which lane it came from.
  why?: string;
  lane?: "interests" | "circle" | "trending" | "moonrise";
}

export type MoonPhase = 0 | 1 | 2 | 3 | 4;
export interface MoonMine {
  phase: MoonPhase;
  state: "testing" | "waiting" | "done";
  round: 1 | 2;
  // a finished climb: a test said no, nobody was left to ask, or it reached the top
  ended: "failed" | "exhausted" | "top" | null;
}
export interface MoonStatus extends MoonMine {
  name: string;
  emoji: string;
  target: number;
  shown: number;
  loved: number;
  rate: number | null;
  score: number;
  bar: number | null;
  quota: number | null;
  resumes_at: string | null;
  history: { phase: MoonPhase; name: string; round: 1 | 2; shown: number; loved: number; score: number; bar: number; result: "up" | "stay" | "retry"; decided_at: string }[];
}
export interface FollowState {
  followers: number;
  following: number;
  i_follow: boolean;
  follows_me: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  parent_id: string | null;
  body: string;
  deleted: boolean;
  is_ai: boolean;
  created_at: string;
  author: ProfileLite;
  likes: number;
  liked: boolean;
}

export interface StoryItem {
  id: string;
  media_url: string | null;
  media_type: MediaType | null;
  text: string;
  bg: "lime" | "pink" | "purple" | "blue" | "fire" | "void";
  created_at: string;
  expires_at: string;
  author: ProfileLite;
  viewed: boolean;
  views: number | null;
}

export interface StoryGroup {
  key: string;
  label: string;
  channel_id: string | null;
  author: ProfileLite | null;
  online: boolean | null;
  latest: string;
  all_viewed: boolean;
  items: StoryItem[];
}

export interface Channel {
  id: string;
  name: string;
  emoji: string;
  description: string;
  kind: "group" | "dm";
  is_private: boolean;
  is_member: boolean;
  member_count: number;
  unread: number;
  last_message_at: string;
  dm_user: ProfileLite | null;
  last_message: { body: string; author: string; created_at: string } | null;
}

export interface ChannelDetail {
  id: string;
  name: string;
  emoji: string;
  description: string;
  kind: "group" | "dm";
  is_private: boolean;
  created_by: string | null;
  is_member: boolean;
  members: ProfileLite[];
}

export interface Message {
  id: string;
  channel_id: string;
  body: string;
  media_url: string | null;
  media_type: MediaType | null;
  deleted: boolean;
  is_ai: boolean;
  created_at: string;
  author: ProfileLite;
  reply_to: { id: string; body: string; author: string } | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
}

export interface AppNotification {
  id: string;
  kind: string;
  body: string;
  read: boolean;
  created_at: string;
  post_id: string | null;
  comment_id: string | null;
  channel_id: string | null;
  message_id: string | null;
  actor: ProfileLite | null;
}

export interface ProfileStats {
  posts: number;
  likes: number;
  reactions: number;
  comments: number;
  awards: number;
  roasted: number;
  best_post_likes: number;
  challenges: number;
  chaos_points: number;
}

export interface Profile extends ProfileLite {
  bio: string;
  created_at: string;
  inside_jokes: string[];
  roast_opt_in: boolean;
  banned: boolean;
  last_seen_at: string | null;
  stats: ProfileStats;
  badges: string[];
  is_me: boolean;
  blocked: boolean;
}

export interface LeaderEntry {
  profile: ProfileLite;
  score: number;
}

export interface Leaderboard {
  likes: LeaderEntry[];
  chaos: LeaderEntry[];
  awards: LeaderEntry[];
  roasted: LeaderEntry[];
  yappers: LeaderEntry[];
  opted_in: boolean;
}

export interface AdminOverview {
  invites: {
    code: string;
    note: string;
    max_uses: number;
    uses: number;
    expires_at: string | null;
    revoked: boolean;
    created_at: string;
    created_by: string | null;
  }[];
  members: (ProfileLite & { banned: boolean; created_at: string; last_seen_at: string | null; posts: number })[];
  reports: {
    id: string;
    target_type: "post" | "comment" | "message" | "user" | "story";
    target_id: string;
    reason: string;
    status: "open" | "resolved" | "dismissed";
    action: string | null;
    created_at: string;
    reporter: ProfileLite;
    target: { body: string; media_url?: string | null; deleted: boolean; post_id?: string; author: ProfileLite } | null;
  }[];
  my_role: Role;
}

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export type LiveEvent =
  | { type: "hello" }
  | { type: "message"; channel_id: string; id: string; op: string }
  | { type: "notification"; id: string; kind?: string; body?: string }
  | { type: "post"; id: string; author_id: string }
  | { type: "story"; id: string }
  | { type: "typing"; channel_id: string; user_id: string; name: string }
  // Too many changes at once (e.g. an admin broadcast): refetch instead.
  | { type: "resync" };
