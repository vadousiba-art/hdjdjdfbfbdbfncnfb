# Night Watch and Watchtower

Night Watch is YORU's automated moderation. Watchtower (`/admin`) is the team's console for it. Account Standing (`/standing`) is what members see.

## How a post is checked

1. **Rules (always on, in the database).** `nw_guard` runs before every member post, comment and story is saved (migration 0011). It can't be skipped, even by calling the API directly. Text is normalised first (case, l33t spelling such as `f4gg0t`, punctuation between letters, stretched letters), then:
   - **Child safety:** explicit terms, or sexual terms next to an age signal. Refused, with a severe strike and a 30-day mute, and the case goes to the urgent queue.
   - **Word lists** for hate speech, threats, scams, sexual content, harassment and self-harm. Each category has a rules action that admins can change.
   - **Private information:** phone numbers and email addresses are held for review.
   - **Spam floods:** too many mentions or links, posting the same thing twice within 10 minutes, or more than 6 posts in 5 minutes. These are refused without a strike.
   - **New accounts:** links posted in an account's first 24 hours are held for review. Appealing one lifts it automatically.
2. **Media fingerprints.** When a file is removed, its SHA-256 hash is stored, and the same file is refused on later uploads.
3. **AI review (when `ANTHROPIC_API_KEY` is set).** The server sends the text, and any image, to the model before saving (`src/lib/server/moderation.ts`). The model is `MODERATION_MODEL`, or `ANTHROPIC_MODEL` if that isn't set (default `claude-opus-5-5`, at low effort with structured JSON output).
   - It picks the most serious category and a confidence.
   - At or above the category's threshold, the category's AI action applies.
   - Close calls (within 0.2 below the threshold) are held for a person.
   - If the model declines to assess something, it's held for a person.
   - If the AI is slow or down, the post goes up, and a sweep checks it within a few minutes or on the next daily cron.
   - Content that skipped the check (scheduled posts, quotes, direct API writes) is picked up by the same sweep (`nw_unchecked`, `/api/cron/moderate`).

The possible outcomes are:

- **Block**: not posted.
- **Remove**: taken down after posting.
- **Hold**: only the author and moderators can see it.
- **Label**: shown behind a sensitive-content screen.
- **Flag**: stays up, and a person checks it.
- **Allow.**

## Strikes

| Active strikes | Result |
|---|---|
| 1 | Warning |
| 2 | 24-hour mute |
| 3 | 7-day mute |
| 4+ | 30-day mute and a "ban recommended" flag |

- Strikes expire after 90 days. The ladder and the expiry can be edited in Watchtower → Rules.
- Owners and admins are exempt. Spam-flood refusals and self-harm flags never strike.
- **Bans are never automatic.** Watchtower lists "ban recommended" accounts, and an admin decides.

## Notices, standing and appeals

- The official account `@YORU` (id `00000000-0000-4000-8000-0000000000f1`, a bot profile that can't log in) sends a DM for every strike, decision and appeal result. The channel is one-way.
- People whose posts sound like a crisis get a private check-in with free helplines (988 in Canada and the US, findahelpline.com elsewhere). It's sent at most once a day, and there's no strike.
- Account Standing shows the member's standing level, active strikes and every decision, and lets them appeal each decision once within 30 days.
- Appeals are triaged automatically:
  - Rules-only holds of new-account links are lifted right away.
  - When the AI is on, it gives a second opinion. It can only *grant* an appeal (at 85% or more, never for child safety). Everything else waits for a person in Watchtower → Appeals.

## Reports

When a member reports something (`create_report`), the server checks the reported content with the rules and, if it's on, the AI. Reported DMs are checked; unreported DMs never are. Then `nw_report_verdict`:

- **removes** clear-cut breaks, strikes the author and tells the reporters;
- **holds** unclear posts, comments and stories;
- **dismisses** reports the AI is at least 90% sure are fine (if "Close clear-cut reports automatically" is on);
- **always sends to a person:** reports about someone at risk, reports with 3 or more reporters, possible pile-ons (several accounts under 7 days old reporting at once), and reports about staff.

## Watchtower

| Tab | What it does |
|---|---|
| Night Watch | Status (AI on or off, test mode), what's waiting, automatic vs. human decisions per day, decisions by rule, ban-recommended accounts. Every number is counted from `mod_events`. |
| Queue | Cases, urgent first. Shows the excerpt, media, the reason, confidence, reports, the author's strikes and account age. Remove with a strike, remove only, restore, or dismiss. Keys: J/K to move, R, Shift+R, A, D. Child-safety cases come with a reminder to report to Cybertip.ca or NCMEC. |
| Appeals | The member's explanation, the AI note, and grant or deny with a message to the member. |
| Members | Search, then a member file: counts, strikes (revoke), history, mute (1 h, 24 h, 7 d), ban (admins), make or remove a moderator (admins). |
| Rules | Test bench (rules and AI verdict for any text, nothing saved), on/off switches, test mode, per-category AI action, threshold and rules action, spam limits, the strike ladder, and the word lists. Admins edit; moderators read. |

Roles:

- **Moderators** can use the five Night Watch tabs and mute for up to 7 days.
- **Admins** also get the site tabs (stats, controls, invites, legacy reports, creators, Pro, support, audit log), can ban, and can add moderators.
- **Only the owner** makes admins.

## Data and privacy

- **Tables:** `mod_events`, `mod_strikes`, `mod_appeals` and `mod_media_hashes`. RLS is on, there are no direct grants, and all access goes through functions.
- **Retention:** closed events are deleted after a year, and strikes a year after they expire (`nw_purge`, daily cron).
- **Removed content** is soft-deleted, so it can be restored after an appeal or kept as evidence.
- The Privacy Policy, Terms (section 5) and Trust Center describe all of this.

## Setup

- Migration `supabase/migrations/0011_night_watch.sql` is additive and safe to re-run.
- Set `ANTHROPIC_API_KEY` on the server to turn on AI review, and optionally `MODERATION_MODEL` (for example `claude-haiku-5-5` for lower cost).
- Without a key, Night Watch runs on rules only, and Watchtower says so.
- `/api/cron/moderate` (daily, `CRON_SECRET`) runs the sweep and the purge.

## Tests

- `tests/db/night-watch.test.ts` (26 database tests):
  - the rules can't be skipped, and spelling tricks are caught;
  - known false positives (Niger, conspicuous, skill, therapist) are allowed;
  - held content stays private;
  - the strike ladder and notices work, and the notice channel is one-way;
  - appeals, report triage, pile-on detection and reported DMs;
  - moderator limits and clamped settings;
  - Watch and Interests feeds.
- `tests/e2e/flows.spec.ts`: refusal with a reason, appeal from Account Standing, the official notice, and a moderator restoring a held post from the Watchtower queue.
