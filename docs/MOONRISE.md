# Moonrise: how a post spreads on YORU (design, v0.1)

Status: **proposal. Nothing here is built yet.** It sits on top of the Night Feed
(`docs/FEED-ALGORITHM.md`), which decides what *you* see; Moonrise decides how far each *post*
travels. Decisions marked **DECIDE** need a yes/no before building.

## The idea in one line

**Every post gets a real audience of strangers who like that kind of thing. If they love it,
it goes to more people, in phases you can watch: 🌑 → 🌒 → 🌓 → 🌕 → 🔴.**

Followers don't decide how far a post goes. Money doesn't. Your friends don't. The strangers
who see it do.

## Why this is different

| Elsewhere | On YORU with Moonrise |
| --- | --- |
| Reach mostly follows follower count; new accounts start invisible | Every post, including a first post, gets a first audience |
| Your friends' likes push your post up | The test audience is **strangers only**: people you chat or interact with are left out of it, so friends can't inflate it (they still see your post in their own feed) |
| Totals win: big accounts rack up more likes by default | A **rate** wins: the share of people who loved it, so 18 of 100 beats 300 of 10,000 |
| Paid boosts and verified badges buy reach | Nothing buys reach. Pro, staff badges and levels change nothing (tested) |
| The algorithm is a black box | You can see your post's phase, how many people it was shown to, and what it needs to reach the next one |
| Watch time and off-app tracking | Only things people do on purpose, plus which posts YORU showed to whom (kept 7 days, see Privacy) |

## The phases

| Phase | Audience (distinct people the post is shown to) | Who they are | Moves up if |
| --- | --- | --- | --- |
| 🌑 **New Moon** | 20 | strangers who picked an interest matching the post's hashtags (or anyone, if it has none) | its love rate is in the top 40% of posts that finished New Moon this week |
| 🌒 **Crescent** | 100 | same, a fresh group | top 25% |
| 🌓 **Half Moon** | 500 | same, a fresh group | top 15% |
| 🌕 **Full Moon** | everyone who follows those interests | the whole fandom | top 5% |
| 🔴 **Blood Moon** | everyone on YORU, every fandom | trending across YORU | the top of the top |

- A phase ends when its audience has seen the post, or after **12 hours**. It's then decided on
  whoever saw it, as long as that's at least 10 people. Otherwise it waits for the next night.
- Each phase uses **new** people, so a post is never judged twice by the same person.
- **Second Night (DECIDE):** a post that doesn't get past New Moon gets one more New Moon test
  the next night, between 9 pm and 5 am in the audience's time, with a fresh group. The better
  result counts. Bad timing alone shouldn't sink a good post.
- **While YORU is small,** the audiences are capped at the number of eligible people. With 30
  members, a New Moon already reaches most of them. Moonrise starts to matter as YORU grows; the
  rules stay the same.

## The love rate, exactly

For each person in a phase's test audience (never the author):

- they **loved it** if they reacted (any reaction except `L`), commented, reposted, bookmarked,
  gave it an award or voted in its poll;
- they **didn't** if they did none of those, or reacted `L`, or tapped "Not interested" (the
  Night Feed's ··· option). A negative always cancels a positive from the same person.

`love rate = people who loved it ÷ people it was shown to`

To stop tiny samples from winning (2 of 2 is not better than 30 of 100), phases are ranked by
the **Wilson lower bound** of the love rate at 90% confidence. It's a standard
small-sample-safe estimate: the lowest rate we're 90% sure the post really has.

The "top 40% / 25% / 15% / 5%" bars are measured against the posts that finished the same
phase in the last 7 days, so they adjust themselves as YORU grows. Until a phase has at least
20 finished posts in the window, it uses starter bars: a lower bound of **10%** to leave New
Moon, **12%** Crescent, **15%** Half Moon, **20%** Full Moon. All four bars and the audience
sizes are settings in Watchtower → Controls.

## What people see

- **The author** sees, on their own post: the phase, how many people it's been shown to, its
  love rate, and the bar for the next phase. For example: "🌒 Crescent · shown to 64 of 100 ·
  21% loved it · top 25% moves to 🌓". When a post moves up, they get a notification: "Your post
  just reached 🌕 Full Moon."
- **Everyone else (DECIDE):** a small 🌕 or 🔴 on posts that reached Full Moon or Blood Moon, and
  the Night Feed's "Why am I seeing this" says "🌑 New Moon: new post in #anime, one of your
  interests".
- Nobody ever sees who did or didn't love a post.

## Fairness and anti-gaming (all tested before it ships)

1. **Strangers only.** The test audience leaves out anyone the author has chatted with,
   reacted to or commented on in the last 30 days, and anyone who has done that to the
   author. Friends can't inflate a test.
2. **People, not clicks.** Nine reactions from one person are one person who loved it. The
   author's own actions count for nothing.
3. **Same reach.** Pro, staff, badges, levels and account age change no number in Moonrise.
   Tested by swapping those fields and comparing every result.
4. **Night Watch wins.** A post that Night Watch holds or removes stops moving, and a removed
   post's phase is erased.
5. **Brand-new accounts** (under 24 hours old, **DECIDE**) can be in test audiences, but count
   half: cheap new accounts can't swing a test.
6. **Blocks both ways.** Someone you blocked, or who blocked you, is never in your post's
   audience.

## Privacy

Moonrise needs one new kind of record: **which posts YORU showed to which person** (the post,
the person, the phase, the time). It's needed so each person counts once and each phase uses
new people. It's:

- kept **7 days**, then deleted automatically;
- never shown to anyone, not even the author (they see counts only);
- never used for anything but Moonrise.

There's still no watch time, no scroll tracking and nothing from outside YORU. The Privacy
Policy gets a line describing this before it ships.

## How it's built (when we build it)

- Migration: `post_phase` (one row per post per phase: shown, loved, started, decided,
  result) and `post_shown` (post, viewer, phase, time; 7-day retention with `pg_cron`), both
  with row-level security and no direct access, like the e-Transfer tables.
- The Night Feed's **Fresh lane becomes the Moonrise lane.** On each page it fills its slots
  with posts in an open test where the viewer is an eligible stranger, and records them in
  `post_shown`.
- A `pg_cron` job every 10 minutes closes finished phases, ranks them and moves posts up.
- Everything runs in SQL on the existing tables, tested in the embedded test database like
  everything else.

## "No mistakes": the tests it must pass

1. A post is never shown twice to the same person as part of a test, and no person is in two
   phases of the same post.
2. The author, their circle (both directions) and blocked people are never in its test
   audience.
3. 9 reactions from one person count as 1. The author's own count as 0. `L` and "Not
   interested" cancel.
4. Swapping Pro, role, badges, level or account age changes no phase decision.
5. 2 of 2 never outranks 30 of 100 (Wilson lower bound).
6. With quotas of 40/25/15/5%, the right number of posts move up from a known set of results.
7. A held or removed post stops; a removed post's phase rows are gone.
8. Every eligible new post reaches its New Moon audience (or everyone eligible) within 12
   hours, or waits for the next night.
9. `post_shown` rows older than 7 days are gone after the cleanup job.
10. Same inputs, same decisions (deterministic), and a page with the Moonrise lane still
    builds in under 150 ms with 10,000 posts.

## Rollout

1. Build behind a switch in Watchtower → Controls, **off** by default.
2. Turn it on for your own posts first, then everyone.
3. Only **after** it's live, use the pitch below.

## The pitch (use only once it's live)

**One line:** On YORU, every post gets a moonrise.

**Short:** Every post on YORU, even your very first, is shown to real people who like that
kind of thing. If they love it, it goes to more people: New Moon, Crescent, Half Moon, Full
Moon. Followers don't decide. Money doesn't. Strangers do. And you can watch your post climb.

**Three proof points (all true once it ships):**
1. Every post gets a first audience. No followers needed.
2. It's judged by strangers, not your friends, and by the share of people who loved it, not
   totals. Small accounts compete on the same terms as big ones.
3. Nobody can buy reach. Not even with Pro.

**15-second reel, in the series voice:**
- "On every other app, your first post goes to nobody." (beat)
- "On YORU, it goes to twenty strangers who like what you like."
- "If they love it? A hundred. Then five hundred. Then everyone."
- "You can literally watch it climb." (show the 🌑🌒🌓🌕 phase on a real post)
- "Comment NIGHT and I'll send you the link."

**Words to avoid:** "guaranteed viral", "everyone goes viral", "beat the algorithm". Moonrise
gives every post a fair shot. It can't promise how people will react.

## Decisions needed

1. **Second Night** (one more New Moon test the next night): recommended **yes**. Bad timing
   shouldn't sink a good post.
2. **Public moon badges** (🌕 / 🔴 on posts that got there): recommended **yes**. It's social
   proof and a reason to share; only the top phases show, so it's not a scoreboard on every post.
3. **New accounts count half** in tests for their first 24 hours: recommended **yes**. It's
   the cheapest defence against fake-account boosting.
4. **Audience sizes** 20 / 100 / 500 / fandom / everyone, and quotas 40 / 25 / 15 / 5%:
   recommended as a starting point. They're settings, so they can change without a deploy.
5. From the Night Feed doc, still open: "Not interested" (**needed** for Moonrise, since it's
   a negative signal), and the night boost and new-member boost, which **Moonrise replaces**
   (Second Night and the guaranteed first audience do their job better).
