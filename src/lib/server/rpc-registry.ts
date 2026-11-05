import { z } from "zod";
import { AVATAR_FRAMES, BANNER_STYLES, CREATOR_CATEGORIES, INTERESTS, LOCALE_CODES as LOCALES, REPORT_CATEGORIES } from "@/lib/opengates";

// Every Postgres function the browser may call, with its argument schema.
// Anything not listed here (bot_*, check_invite, ...) is server-only.

const id = z.uuid();
const ts = z.iso.datetime({ offset: true }).nullable().optional();
const text = (max: number) => z.string().max(max);
const mediaUrl = z.string().max(300).nullable().optional();
const mediaType = z.enum(["image", "video", "gif"]).nullable().optional();
const none = z.object({});
const offset = z.number().int().min(-840).max(840).optional();
const itemId = z.string().regex(/^[a-z]+\.[a-z0-9_]{1,40}$/);
const slot = z.enum(["ring", "banner", "nameplate", "badge", "layout", "milestone", "theme", "effect", "reaction", "chat", "sound", "feed", "dashboard", "insight"]);
const day = z.iso.date();

export const REACTIONS = ["heart", "skull", "fire", "clown", "cap", "crying", "salute", "w", "l"] as const;
export const AWARDS = ["menace", "war_crime", "touch_grass", "galaxy_brain", "skill_issue", "ratio"] as const;

export const RPC_SCHEMAS = {
  // reads
  get_me: none,
  get_feed: z.object({
    p_mode: z.enum(["latest", "trending", "user", "media", "tag", "search", "bookmarks"]).optional(),
    p_arg: text(100).nullable().optional(),
    p_before: ts,
    p_offset: z.number().int().min(0).max(2000).optional(),
    p_limit: z.number().int().min(1).max(50).optional(),
  }),
  get_post: z.object({ p_id: id }),
  get_comments: z.object({ p_post_id: id }),
  get_stories: none,
  get_channels: none,
  get_channel: z.object({ p_id: id }),
  get_messages: z.object({
    p_channel_id: id,
    p_before: ts,
    p_after: ts,
    p_limit: z.number().int().min(1).max(100).optional(),
  }),
  get_message: z.object({ p_id: id }),
  get_notifications: z.object({ p_before: ts, p_limit: z.number().int().min(1).max(100).optional() }),
  get_members: none,
  get_profile: z.object({ p_username: text(20) }),
  get_leaderboard: none,
  get_trending_tags: z.object({ p_limit: z.number().int().min(1).max(30).optional() }),
  search_profiles: z.object({ p_q: text(40) }),
  get_blocked: none,
  get_ai_history: z.object({ p_limit: z.number().int().min(1).max(100).optional() }),
  admin_overview: none,
  get_site: none,
  get_my_progress: z.object({ p_offset_minutes: offset }),
  get_profile_extras: z.object({ p_username: text(20) }),
  get_featured: none,
  get_level_board: none,
  admin_get_site: none,
  admin_stats: none,
  admin_audit: z.object({ p_limit: z.number().int().min(1).max(200).optional() }),
  admin_member_extras: none,

  // writes
  touch_presence: none,
  update_my_profile: z.object({
    p: z
      .object({
        display_name: text(40).optional(),
        avatar_url: z.string().max(300).nullable().optional(),
        bio: text(280).optional(),
        status: text(80).optional(),
        badge: text(8).optional(),
        roast_opt_in: z.boolean().optional(),
        roast_intensity: z.number().int().min(1).max(3).optional(),
        leaderboard_opt_in: z.boolean().optional(),
        ai_context_opt_in: z.boolean().optional(),
        notification_prefs: z.record(z.string(), z.boolean()).optional(),
        inside_jokes: z.array(text(40)).max(12).optional(),
      })
      .strict(),
  }),
  create_post: z.object({
    p_body: text(2000).optional(),
    p_media_url: mediaUrl,
    p_media_type: mediaType,
    p_link_url: z.url({ protocol: /^https?$/ }).max(500).nullable().optional(),
    p_poll_options: z.array(text(80)).min(2).max(6).nullable().optional(),
  }),
  delete_post: z.object({ p_id: id }),
  toggle_repost: z.object({ p_post_id: id, p_quote: text(2000).nullable().optional() }),
  toggle_reaction: z.object({ p_post_id: id, p_kind: z.enum(REACTIONS) }),
  vote_poll: z.object({ p_post_id: id, p_option_id: id }),
  toggle_bookmark: z.object({ p_post_id: id }),
  add_comment: z.object({ p_post_id: id, p_body: text(1000), p_parent_id: id.nullable().optional() }),
  delete_comment: z.object({ p_id: id }),
  toggle_comment_like: z.object({ p_comment_id: id }),
  give_award: z.object({ p_post_id: id, p_kind: z.enum(AWARDS) }),
  create_story: z.object({
    p_text: text(200).optional(),
    p_media_url: mediaUrl,
    p_media_type: mediaType,
    p_bg: z.enum(["lime", "pink", "purple", "blue", "fire", "void"]).optional(),
    p_channel_id: id.nullable().optional(),
  }),
  view_story: z.object({ p_story_id: id }),
  delete_story: z.object({ p_story_id: id }),
  create_channel: z.object({
    p_name: text(40),
    p_emoji: text(8).optional(),
    p_description: text(200).optional(),
    p_is_private: z.boolean().optional(),
    p_member_ids: z.array(id).max(200).optional(),
  }),
  start_dm: z.object({ p_user_id: id }),
  join_channel: z.object({ p_channel_id: id }),
  leave_channel: z.object({ p_channel_id: id }),
  add_channel_members: z.object({ p_channel_id: id, p_member_ids: z.array(id).max(200) }),
  mark_channel_read: z.object({ p_channel_id: id }),
  send_message: z.object({
    p_channel_id: id,
    p_body: text(2000).optional(),
    p_media_url: mediaUrl,
    p_media_type: mediaType,
    p_reply_to: id.nullable().optional(),
  }),
  delete_message: z.object({ p_id: id }),
  toggle_message_reaction: z.object({ p_message_id: id, p_emoji: z.string().min(1).max(16) }),
  mark_notifications_read: z.object({ p_ids: z.array(id).max(200).nullable().optional() }),
  toggle_block: z.object({ p_user_id: id }),
  create_report: z.object({
    p_target_type: z.enum(["post", "comment", "message", "user", "story"]),
    p_target_id: id,
    p_reason: text(500),
    p_category: z.enum(REPORT_CATEGORIES).optional(),
  }),
  clear_ai_history: none,
  daily_checkin: z.object({ p_offset_minutes: offset }),
  update_my_style: z.object({
    p: z
      .object({
        accent_hue: z.number().int().min(0).max(359).optional(),
        currently_kind: z.enum(["watching", "reading", "listening", "playing", ""]).optional(),
        currently_title: text(60).optional(),
      })
      .strict(),
  }),
  pin_post: z.object({ p_post_id: id.nullable() }),

  // admin (the functions re-check the caller's role)
  admin_create_invite: z.object({
    p_max_uses: z.number().int().min(1).max(500).optional(),
    p_expires_hours: z.number().int().min(0).max(2160).optional(),
    p_note: text(80).optional(),
  }),
  admin_revoke_invite: z.object({ p_code: text(40) }),
  admin_set_role: z.object({ p_user_id: id, p_role: z.enum(["admin", "moderator", "member"]) }),
  admin_set_banned: z.object({ p_user_id: id, p_banned: z.boolean() }),
  admin_set_verified: z.object({ p_user_id: id, p_verified: z.boolean() }),
  admin_resolve_report: z.object({ p_report_id: id, p_action: z.enum(["dismiss", "delete", "ban"]) }),
  admin_update_site: z.object({
    p: z
      .object({
        announcement: z.object({ text: text(280), tone: z.enum(["info", "event", "alert"]) }).nullable().optional(),
        lockdown: z.boolean().optional(),
        open_signup: z.boolean().optional(),
        slow_mode: z.number().int().min(0).max(3600).optional(),
        word_filter: z.array(text(30)).max(100).optional(),
        nightly_prompt: text(200).nullable().optional(),
      })
      .strict(),
  }),
  admin_broadcast: z.object({ p_body: z.string().min(1).max(280) }),
  admin_feature_post: z.object({ p_post_id: id, p_featured: z.boolean() }),
  admin_mute: z.object({ p_user_id: id, p_minutes: z.number().int().min(0).max(43200) }),
  admin_set_flair: z.object({ p_user_id: id, p_flair: text(24) }),
  admin_grant_xp: z.object({ p_user_id: id, p_amount: z.number().int().min(-5000).max(5000) }),
  admin_recalculate_xp: none,
  admin_support_inbox: z.object({ p_limit: z.number().int().min(1).max(300).optional() }),
  admin_close_support: z.object({ p_id: id, p_closed: z.boolean().optional() }),

  // Open Gates (migration 0007)
  open_gates_version: none,
  get_my_identity: none,
  get_welcome_state: none,
  mark_welcome_seen: z.object({ p_version: z.string().regex(/^[0-9]{1,4}(\.[0-9]{1,3})?$/) }),
  update_my_identity: z.object({
    p: z
      .object({
        locale: z.enum(LOCALES).nullable().optional(),
        interests: z.array(z.enum(INTERESTS)).max(8).optional(),
        ghost_mode: z.boolean().optional(),
        discoverable: z.boolean().optional(),
        banner_style: z.enum(BANNER_STYLES).optional(),
        avatar_frame: z.enum(AVATAR_FRAMES).optional(),
        showcase_badges: z.array(z.string().regex(/^[a-z_]{2,30}$/)).max(3).optional(),
      })
      .strict(),
  }),
  get_profile_identity: z.object({ p_username: text(20) }),
  get_discover: z.object({
    p_interest: z.enum(INTERESTS).nullable().optional(),
    p_locale: z.enum(LOCALES).nullable().optional(),
    p_creators_only: z.boolean().optional(),
    p_limit: z.number().int().min(1).max(50).optional(),
    p_offset: z.number().int().min(0).max(2000).optional(),
  }),
  get_my_collections: z.object({ p_post_id: id.nullable().optional() }),
  get_collection: z.object({ p_id: id, p_before: ts, p_limit: z.number().int().min(1).max(50).optional() }),
  save_collection: z.object({
    p_id: id.nullable().optional(),
    p_name: z.string().trim().min(1).max(40).optional(),
    p_description: text(200).optional(),
    p_emoji: text(8).optional(),
    p_visibility: z.enum(["private", "members"]).optional(),
  }),
  delete_collection: z.object({ p_id: id }),
  set_collection_item: z.object({ p_collection_id: id, p_post_id: id, p_in: z.boolean().optional() }),
  get_my_themes: none,
  save_theme: z.object({
    p_name: z.string().trim().min(1).max(30),
    p_accent_hue: z.number().int().min(0).max(359),
    p_theme: z.enum(["dark", "light", "system"]).optional(),
    p_ambience: z.enum(["off", "stars", "sakura", "rain", "fireflies"]).optional(),
  }),
  delete_theme: z.object({ p_id: id }),
  get_my_creator_application: none,
  apply_creator: z.object({
    p_category: z.enum(CREATOR_CATEGORIES),
    p_portfolio_url: z.url({ protocol: /^https?$/ }).max(300),
    p_statement: z.string().trim().min(20, "Tell us a little more (20+ characters).").max(600),
  }),
  withdraw_creator_application: none,
  admin_creator_queue: z.object({ p_status: z.enum(["pending", "approved", "rejected", "withdrawn", "revoked"]).optional() }),
  admin_review_creator: z.object({ p_application_id: id, p_approve: z.boolean(), p_note: text(300).optional() }),
  admin_revoke_creator: z.object({ p_user: id, p_note: text(300).optional() }),
  admin_grant_pro: z.object({ p_user: id, p_days: z.number().int().min(1).max(366), p_note: text(200).optional() }),
  admin_revoke_pro: z.object({ p_user: id }),
  admin_pro_members: none,
  admin_report_flags: none,
  admin_escalate_report: z.object({ p_report_id: id, p_escalated: z.boolean() }),

  // Pro Universe (migration 0009)
  pro_universe_version: none,
  get_my_pro: none,
  pro_equip: z.object({ p_slot: slot, p_item: itemId.nullable().optional() }),
  pro_equip_many: z.object({ p: z.partialRecord(slot, itemId) }),
  pro_reset_look: none,
  pro_wishlist_toggle: z.object({ p_item: itemId }),
  pro_save_settings: z.object({
    p: z
      .object({
        labs: z.array(itemId).max(20).optional(),
        sound_volume: z.number().int().min(0).max(100).optional(),
        sounds_on: z.boolean().optional(),
        show_timeline: z.boolean().optional(),
        effects_on: z.boolean().optional(),
        ring_motion: z.boolean().optional(),
        layout_order: z.array(z.string().regex(/^[a-z_]{2,20}$/)).max(10).optional(),
        dashboard_widgets: z.array(z.string().regex(/^[a-z_]{2,20}$/)).max(12).optional(),
        insight_widgets: z.array(z.string().regex(/^[a-z_]{2,20}$/)).max(12).optional(),
        muted_words: z.array(text(40)).max(50).optional(),
        hub_tags: z.array(text(30)).max(12).optional(),
        pinned_hubs: z.array(itemId).max(8).optional(),
        feed_custom: z
          .object({
            sort: z.enum(["latest", "top"]).optional(),
            media: z.enum(["any", "image", "video", "text"]).optional(),
            tags: z.array(text(30)).max(12).optional(),
            kinds: z.array(z.enum(["post", "poll", "repost", "news", "roast"])).max(5).optional(),
            days: z.number().int().min(1).max(90).nullable().optional(),
            muted: z.boolean().optional(),
          })
          .strict()
          .optional(),
      })
      .strict(),
  }),
  pro_get_drafts: none,
  pro_save_draft: z.object({
    p_id: id.nullable(),
    p: z
      .object({
        template: itemId.nullable().optional(),
        folder: text(40).optional(),
        kind: z.enum(["post", "poll"]).optional(),
        body: text(2000).optional(),
        media_url: mediaUrl,
        media_type: mediaType,
        link_url: text(500).nullable().optional(),
        poll_options: z.array(text(80)).max(6).nullable().optional(),
        plan: text(80).nullable().optional(),
      })
      .strict(),
  }),
  pro_delete_draft: z.object({ p_id: id }),
  pro_schedule_draft: z.object({ p_id: id, p_at: ts, p_timezone: text(64).nullable().optional() }),
  pro_record_profile_view: z.object({ p_username: text(20) }),
  get_creator_analytics: z.object({ p_from: day.nullable().optional(), p_to: day.nullable().optional() }),
  get_feed_preset: z.object({
    p_preset: itemId,
    p_offset: z.number().int().min(0).max(2000).optional(),
    p_limit: z.number().int().min(1).max(50).optional(),
    p_preview: z.boolean().optional(),
  }),
  get_hub: z.object({ p_hub: itemId, p_before: ts, p_limit: z.number().int().min(1).max(50).optional() }),
  pro_style_collection: z.object({
    p_id: id,
    p_template: z.union([itemId, z.literal("")]).nullable().optional(),
    p_sort: z.enum(["added_desc", "added_asc", "popular"]).nullable().optional(),
  }),
  get_collection_page: z.object({ p_id: id, p_offset: z.number().int().min(0).max(2000).optional(), p_limit: z.number().int().min(1).max(50).optional() }),

  // Night Watch (migration 0011)
  night_watch_version: none,
  get_watch: z.object({
    p_mode: z.enum(["for_you", "latest"]).optional(),
    p_offset: z.number().int().min(0).max(2000).optional(),
    p_limit: z.number().int().min(1).max(20).optional(),
  }),
  get_interest_feed: z.object({ p_before: ts, p_limit: z.number().int().min(1).max(50).optional() }),
  get_my_standing: none,
  submit_appeal: z.object({ p_event_id: id, p_body: text(1000) }),
  nw_dashboard: none,
  nw_queue: z.object({
    p_view: z.enum(["open", "held", "reports", "auto", "reviewed", "all"]).optional(),
    p_limit: z.number().int().min(1).max(200).optional(),
  }),
  nw_review: z.object({ p_event_id: id, p_decision: z.enum(["remove", "restore", "dismiss"]), p_strike: z.boolean().optional(), p_note: z.string().max(500).optional() }),
  nw_appeals: z.object({ p_status: z.enum(["open", "granted", "denied", "all"]).optional() }),
  nw_decide_appeal: z.object({ p_appeal_id: id, p_grant: z.boolean(), p_note: z.string().max(500).optional() }),
  nw_revoke_strike: z.object({ p_strike_id: id }),
  nw_mute: z.object({ p_user_id: id, p_minutes: z.number().int().min(0).max(43200) }),
  nw_member_file: z.object({ p_user_id: id }),
  nw_get_config: none,
  nw_set_config: z.object({ p: z.record(z.string(), z.unknown()) }),
  nw_test: z.object({ p_text: z.string().min(1).max(2000) }),

  // Pro and donations by Interac e-Transfer (migration 0016)
  etransfer_config: none,
  etransfer_start: z.object({ p_kind: z.enum(["pro", "donation"]), p_amount_cents: z.number().int().min(200).max(50000).nullable().optional() }),
  etransfer_mark_sent: z.object({ p_id: id, p_sender_name: text(80).optional() }),
  etransfer_cancel: z.object({ p_id: id }),
  etransfer_my_orders: none,
  etransfer_admin_orders: z.object({ p_since: ts }),
  etransfer_confirm: z.object({ p_ids: z.array(id).min(1).max(100), p_day: day.nullable().optional() }),
  etransfer_reject: z.object({ p_id: id, p_note: text(200).optional() }),
  etransfer_undo: z.object({ p_id: id }),
  etransfer_set_day: z.object({ p_day: day, p_total_cents: z.number().int().min(0).max(10_000_000), p_note: text(200).optional() }),
  etransfer_days: z.object({ p_limit: z.number().int().min(1).max(366).optional() }),
} as const;

export type RpcName = keyof typeof RPC_SCHEMAS;

export function isRpcName(name: string): name is RpcName {
  return Object.prototype.hasOwnProperty.call(RPC_SCHEMAS, name);
}

// Functions that only read. Everything else is paused while
// MAINTENANCE_READ_ONLY=true (database cutover window, see
// docs/database-migration.md).
export const READ_RPCS: ReadonlySet<RpcName> = new Set<RpcName>([
  "get_me", "get_feed", "get_post", "get_comments", "get_stories", "get_channels", "get_channel",
  "get_messages", "get_message", "get_notifications", "get_members", "get_profile", "get_leaderboard",
  "get_trending_tags", "search_profiles", "get_blocked", "get_ai_history", "admin_overview", "get_site",
  "get_my_progress", "get_profile_extras", "get_featured", "get_level_board", "admin_get_site",
  "admin_stats", "admin_audit", "admin_member_extras", "admin_support_inbox",
  "open_gates_version", "get_my_identity", "get_profile_identity", "get_discover", "get_my_collections",
  "get_collection", "get_my_themes", "get_my_creator_application", "admin_creator_queue", "admin_pro_members",
  "admin_report_flags", "get_welcome_state",
  "pro_universe_version", "pro_get_drafts", "get_creator_analytics", "get_feed_preset", "get_hub", "get_collection_page",
  "night_watch_version", "get_watch", "get_interest_feed", "get_my_standing", "nw_dashboard", "nw_queue", "nw_appeals",
  "nw_member_file", "nw_get_config", "nw_test",
  "etransfer_config", "etransfer_my_orders", "etransfer_admin_orders", "etransfer_days",
]);
