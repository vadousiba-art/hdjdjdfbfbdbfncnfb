# Moonrise: how a post spreads on YORU (v1)

Status: **built** (migration `0017_moonrise.sql`). It is **off until an admin turns it on** in
Watchtower → Controls. With it off, For You is the trending feed as before. It sits on top of the
Night Feed (`docs/FEED-ALGORITHM.md`), which decides what *you* see; Moonrise decides how far each
*post* travels.

## The idea in one line

**Every post gets a real audience of strangers who like that kind of thing. If they love it,
it goes to more people, in phases you can watch: 🌑 → 🌒 → 🌓 → 🌕 → 🔴.**

Followers don't decide how far a post goes. Money doesn't. Your friends don't. The strangers
who see it do.

## Why this is different

| Elsewhere | On YORU with Moonrise |
| --- | --- |
| Reach mostly follows follower count; new accounts start invisible | Every post, including a first post, gets a first audience |
| Your friends' likes push your post up | The test audience is **strangers only**: people you follow, chat or interact with are left out of it, so friends can't inflate it (they still see your post in their own feed) |
| Totals win: big accounts rack up more likes by default | A **rate** wins: the share of people who loved it, so 18 of 100 beats 300 of 10,000 |
| Paid boosts and verified badges buy reach | Nothing buys reach. Pro, staff roles, badges, levels and account age change nothing (tested) |
| The algorithm is a black box | You can see your post's phase, how many people it was shown to, and what it needs to reach the next one |
| Watch time and off-app tracking | Only things people do on purpose, plus which posts YORU showed to whom in a test (kept 7 days, see Privacy) |

## The phases

| Phase | Audience (distinct people the post is shown to) | Who they are | Moves up if |
| --- | --- | --- | --- |
| 🌑 **New Moon** | 20 | strangers in the post's fandom (below) | its score is in the top 40% of posts that finished New Moon this week |
| 🌒 **Crescent** | 100 | same, a fresh group | top 25% |
| 🌓 **Half Moon** | 500 | same, a fresh group | top 15% |
| 🌕 **Full Moon** | everyone in its fandom who hasn't seen it | the whole fandom | top 5% |
| 🔴 **Blood Moon** | everyone on YORU | trending across YORU | it's the top |

- **A post's fandom** is the interests among its hashtags (`#anime` → anime). If it has none,
  it's its author's interests. If the author has none either, it's anyone. Members who haven't
  picked any interests yet can be in any test.
- **A phase ends** when its audience has seen the post (80% for Full Moon), when nobody eligible
  is left, or after **12 hours** (24 for Full Moon) as long as at least 10 people saw it.
  Otherwise it waits for more people.
- **Each phase uses new people**: a person is shown a post as part of a test once, ever.
- **Somebody has to love it**: a post nobody loved never moves up.
- **Second Night:** a post that doesn't get past New Moon gets one more New Moon test, at least
  6 hours later and only between 9 pm and 5 am in the viewer's time, with new people. The
  better result counts.
- **Nobody left to ask** (everyone in its fandom already knows the author, common while YORU is
  small): the test simply ends. That never counts against the post.
- **While YORU is small**, most audiences are capped by the number of eligible people. Moonrise
  starts to matter as YORU grows; the rules stay the same.

## The score, exactly

For each person in a phase's test audience (never the author):

- they **loved it** if they reacted (any reaction except `L`), commented, reposted, bookmarked,
  gave it an award or voted in its poll;
- they **didn't** if they did none of those, or reacted `L`, or tapped "Not interested". A
  negative always cancels a positive from the same person.

Brand-new accounts (under 24 hours old) count as half a person, both when shown and when they
love it, so fresh fake accounts can't swing a test.

To stop tiny samples from winning, a phase is ranked by a **Bayesian average** of the love rate:
the rate as if 20 more people had seen the post and 10% of them had loved it.

`score = (people who loved it + 2) ÷ (people it was shown to + 20)`

So 2 of 2 scores 18% and never outranks 30 of 100 (27%); 18 of 100 (17%) beats 300 of 10,000
(3%). A post with no evidence sits at 10%.

> Correction to v0.1 of this doc: it ranked by the Wilson lower bound at 90%. The tests showed
> that lets 2 of 2 (55%) outrank 30 of 100 (25%), the exact thing it was meant to prevent. The
> Bayesian average above doesn't.

The "top 40% / 25% / 15% / 5%" bars are the scores at those percentiles among posts that finished
the same phase in the last 7 days, so they adjust themselves as YORU grows. Until a phase has 20
results in the window, it uses starter bars: **10%** to leave New Moon, **12%** Crescent, **15%**
Half Moon, **20%** Full Moon. Each run of the decision job fixes the bars before deciding
anything, so the order posts are decided in changes nothing. The audience sizes, the quotas,
Second Night and the number of Moonrise posts per page are settings in Watchtower → Controls.

## How For You uses it

A page of 15 is filled from three lanes, your interests, your circle (people you follow, chat or
interact with) and trending, in about a 6 : 4 : 3 split, plus **2 Moonrise slots** at the 3rd and
8th places: posts in a test that you can join, least-seen first. Slots the lanes can't fill go to
Moonrise too.

- While a post is being tested in New Moon, Crescent or Half Moon, **strangers only meet it
  through the Moonrise slots** (that's what makes each view count). Friends see it in their
  circle lane as usual.
- In Full Moon it's also in its fandom's interests lane.
- Once its climb is over it ranks by how far it got: Blood Moon ×2.5, Full Moon ×1.6, and a post
  that a test turned down at Half Moon ×0.85, Crescent ×0.6, New Moon ×0.35. A post whose test
  ran out of people is ×1.
- At most 2 posts per author on a page, and never two in a row where that can be avoided. Each
  page sends the ids already shown, so a scroll never repeats.

## What people see

- **The author** sees a moon chip on their own post (🌑 New Moon, etc.). Tapping it opens an
  animated track of the five phases with: shown to X of Y, how many loved it, the score and the
  bar it needs, and the history of each phase. When a post moves up they get a notification:
  "Your post just reached 🌕 Full Moon."
- **Everyone** sees a small glowing 🌕 Full Moon or 🔴 Blood Moon next to the time on posts that
  got there.
- **People in a test** see a line above the post: "🌑 New Moon · New post in #anime · You're
  early". The ··· menu has "Why am I seeing this?" and "Not interested".
- Nobody ever sees who did or didn't love a post.

## Fairness and anti-gaming (all tested)

1. **Strangers only.** The test audience leaves out anyone the author follows or is followed by,
   has reacted to, commented on or messaged in the last 30 days, in either direction.
2. **People, not clicks.** Eight reactions from one person are one person who loved it. The
   author's own actions count for nothing.
3. **Same reach.** Pro, staff roles, badges, levels and the author's account age change no
   decision (tested by changing them and comparing every result).
4. **Night Watch wins.** A post Night Watch holds stops moving; a removed post's Moonrise records
   are erased.
5. **Brand-new accounts count half.**
6. **Blocks both ways.** Someone you blocked, or who blocked you, is never in your post's
   audience.

## Notifications (shipped with Moonrise, on whether or not it's switched on)

- **Following.** Members can follow each other (profile → Follow). "New post" notifications go
  to your followers only (setting "Posts from people you follow"). The old "every time anyone
  posts" setting is gone.
- **Top posts.** When a post reaches Full Moon, members in its fandom who haven't seen it get one
  "top post" notification; Blood Moon tells everyone. Each member gets **at most one a day**
  (setting "Top posts").
- **30-second pushes.** A push goes out about 30 seconds after the notification, and only if it's
  still unread, so you aren't pinged about something you've just seen in the app. Opening a chat
  marks its message notifications read. The Android app's background check waits the same 30
  seconds.
- New settings: "Posts from people you follow", "New followers", "Top posts" and "Your posts'
  Moonrise", all on unless turned off.

## Privacy

Moonrise needs one new kind of record: **which posts YORU showed to which person in a test** (the
post, the person, the phase, the time). It's needed so each person counts once and each phase
uses new people. It's deleted after **7 days**, never shown to anyone (authors see counts only),
and used for nothing else. "Not interested" choices are kept until undone and only change your own
For You. There's still no watch time, no scroll tracking and nothing from outside YORU. The
Privacy Policy describes all of this.

## How it's built

- Migration `0017_moonrise.sql`: `follows`, `moon_settings`, `moon_posts` (where each post is),
  `moon_results` (each decided phase), `moon_shown` (who saw what in a test, 7 days),
  `not_interested`, `moon_top_notices`. All have row-level security on and no direct access; the
  app reaches them only through functions.
- `get_for_you` builds a page (one SQL function). It scores a bounded pool per page (the newest
  600 posts of the week, the 200 most-reacted, your circle's newest 300, the newest 300 in your
  interests, and every Full and Blood Moon post), so its cost doesn't grow with YORU's size.
- `moon_tick` decides phases. On Supabase, `pg_cron` runs it every minute; in demo mode the
  server runs it on a timer.
- The push sender waits in the background until queued pushes are due (at most 45 seconds per
  request, inside the 60-second function limit), sends them, and stops. Each queued push is
  claimed exactly once.

Measured with 10,000 posts in a week, on a local PostgreSQL 16 with statistics up to date: a For
You page takes **67–116 ms** (all open tests, or a realistic mix), and deciding 500 open tests
takes **0.6 s**. The embedded test database (Postgres compiled to WebAssembly) is several times
slower, and its test guards against the slow paths coming back.

## The tests (`tests/db/moonrise.test.ts`, all passing)

1. A post is never shown twice to the same person as part of a test, and no person is in two
   phases of the same post.
2. The author, their circle (both directions), blocked people and other fandoms are never in its
   test audience; members without interests can be.
3. 8 reactions from one person count as 1. The author's own count as 0. `L` and "Not interested"
   cancel. Comments, reposts, bookmarks, awards and poll votes count.
4. Changing Pro, role, verified, badge, level or account age changes no decision, and the same
   inputs give the same decisions.
5. 2 of 2 (and up to 4 of 4) never outranks 30 of 100; 18 of 100 beats 300 of 10,000.
6. Against a known week of 25 results the bar is the 60th percentile (0.154), and exactly the
   right posts move up.
7. A held post stops; a removed post's records are gone.
8. Every eligible post reaches its New Moon audience (or everyone eligible); after 12 hours it's
   decided on at least 10 people, or waits.
9. Second Night runs only at night, only with new people, and the better result counts; a post
   that misses it is done.
10. A test with nobody left to ask ends without counting against the post.
11. Reaching Full Moon notifies the author, badges the post and notifies the fandom at most once
    a day each.
12. `moon_shown` rows older than 7 days are gone after the job runs.
13. Moonrise posts land 3rd and 8th with a reason, a page never repeats, and only members can
    read For You; nobody can read the tables directly.
14. Follows, followers-only "new post" notifications, settings, and chat reads clearing message
    notifications; pushes wait 30 seconds and skip what was read (`tests/db/push.test.ts`).

## Rollout

1. Shipped with Moonrise **off**. Follows and the notification changes work right away.
2. Turn it on in Watchtower → Controls. That brings in the last 24 hours of posts.
3. Only **after** it's on, use the pitch below.

## The pitch (use only once it's on)

**One line:** On YORU, every post gets a moonrise.

**Short:** Every post on YORU, even your very first, is shown to real people who like that
kind of thing. If they love it, it goes to more people: New Moon, Crescent, Half Moon, Full
Moon. Followers don't decide. Money doesn't. Strangers do. And you can watch your post climb.

**Three proof points (all true once it's on):**
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
gives every post a fair shot. It can't promise how people will react. While YORU is small, say
"real people who like what you like", not a number: a first audience can be smaller than 20.

## Decisions (all made)

1. Second Night: **yes**.
2. Public 🌕 / 🔴 badges: **yes**.
3. New accounts count half for their first 24 hours: **yes**.
4. Audience sizes 20 / 100 / 500 / fandom / everyone and quotas 40 / 25 / 15 / 5%: **yes**, as
   settings.
5. "Not interested": **built**. Moonrise replaces the Night Feed's planned night boost and
   new-member boost.
