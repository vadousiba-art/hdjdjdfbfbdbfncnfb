# The Night Feed: YORU's For You algorithm (design, v0.1)

Status: **proposal**. Nothing here is built yet. The decisions marked **DECIDE** need a yes/no
before building.

**See also `docs/MOONRISE.md`** (2026-11-06): how far each post travels, in phases judged by
strangers. It turns this doc's Fresh lane into the Moonrise lane, needs "Not interested", and
replaces the night boost and the new-member boost below.

## What it replaces, and why

Today "For You" (`get_feed('trending')` in `0001_core.sql`) is one global list, the same for
everyone: `(reactions + 2·comments + 3·reposts + 2·awards + 1) / (age_hours + 2)^1.2` over the
last 14 days. Its problems:

1. **Not personal.** Your interests and the people you talk to change nothing.
2. **Easy to inflate.** `reactions` has one row per (post, user, kind), and there are 9 kinds, so
   one person can count 9 times. Authors' own reactions and comments count too.
3. **Pages shift.** It pages by offset while scores keep changing, so posts repeat or get skipped
   between scrolls (the client hides repeats, but skipped posts are never seen).
4. **New posts start at zero.** A brand-new member's first post competes with posts that already
   have reactions, so it can sink without anyone seeing it.

## The promises it must keep (from YORU itself)

| Promise | What it means for the algorithm |
| --- | --- |
| Same reach for everyone | Pro, role, badges, level and follower-style counts never change a post's rank. Tested. |
| No tracking | Only uses things people do on purpose: reactions, comments, reposts, awards, bookmarks, poll votes, the interests they picked, who they chat with. No watch time, no scroll tracking, nothing from outside YORU. |
| You're in control | Blocks, Night Watch decisions and "Not interested" always win over any score. |
| For every fandom, everyone | Interests steer the feed but never wall it off: some of every page comes from outside your interests. |
| Explainable | Every post can say why it's there ("#anime, one of your interests", "from Lucas, who you talk to", "trending tonight", "new post"). |

## How a page is built

Every request for a page of 15 posts runs four steps, all inside one SQL function,
`get_for_you`, on the existing tables.

### 1. Candidates (last 7 days)

Not deleted, not a plain repost, not from a blocked or banned author (both directions, as
`is_hidden_author` does today), not removed by Night Watch, not marked "Not interested", and not
already shown in this scroll session (the client sends the ids it has shown, see step 4). They
come from four lanes:

| Lane | What's in it |
| --- | --- |
| **Interests** | posts whose hashtags match your interests, or whose author picked the same interests |
| **Circle** | posts from people you reacted to, commented on, or chatted with in the last 30 days |
| **Trending** | the best-scoring posts from everyone |
| **Fresh** | everything posted in the last 6 hours, newest first |

### 2. Score

`score = quality × relevance × freshness × fairness`

- **Quality**, counting people, not rows, and never the author:
  `E = 1·(people who reacted) + 2·(people who commented) + 3·(people who reposted) + 2·awards + 1.5·bookmarks`,
  then `quality = log2(2 + E)`. The log keeps one viral post from swallowing the whole feed.
  An `L` reaction counts half (it's a vote against); every other reaction, clown and cap
  included, counts fully.
- **Relevance:** `1 + 1.5·(matches an interest) + 1.2·(circle closeness, 0 to 1)`. Closeness
  is how much you've interacted with the author recently, capped at 1.
- **Freshness:** `1 / (age_hours + 2)^1.4`, so a day-old post needs about 4× the engagement of
  a new one to keep its place.
- **Fairness:** `×1.3` for members in their first 14 days (their posts need a first audience).
  **DECIDE: night boost** `×1.15` for posts made between 9 pm and 5 am in the viewer's time (the
  app already sends the time zone for the nightly check-in).

### 3. Mix the page

Fill 15 slots from the lanes, about **6 interests, 4 circle, 3 trending, 2 fresh**. A lane that
runs out (normal while YORU is small) gives its slots to the others in that order. Then:

- at most **2 posts per author** per page, never two in a row from the same author;
- your own posts from the last 30 minutes stay pinned at the top (as now);
- ties break by newest first, then by id, so the same inputs always give the same order.

### 4. Paging that never repeats or skips

The client keeps the ids it has shown in this scroll (up to 300) and sends them with the next
request. The server leaves them out. Scores can change between scrolls without a post ever
appearing twice or being skipped. Nothing is stored server-side; the list lives in the open tab.

## New: "Not interested" (**DECIDE**)

A "Not interested" option on every post (in the ··· menu). It hides that post for you right
away, and for 30 days lowers that author and those hashtags in your feed (×0.3). It's private:
the author is never told and it doesn't count against them anywhere else.

## "No mistakes": what gets tested

The function runs against the real schema in the embedded test database (the same PGlite the demo
uses), with seeded users and posts. Each of these is an automated test that has to pass before it
ships:

1. Never returns a post from someone you blocked, someone who blocked you, a banned member, a
   deleted post, or a post Night Watch removed.
2. Never returns the same post twice in one scroll, across any number of pages.
3. Never skips: scrolling to the end returns every eligible post exactly once.
4. Same reach: making an author Pro, staff or a high level changes no score (checked by swapping
   those fields and comparing).
5. One person adding all 9 reactions counts as one person.
6. The author's own reactions and comments count for nothing.
7. Every post from the last 6 hours reaches the first 3 pages of every eligible viewer
   (the fresh lane's guarantee).
8. No page has more than 2 posts from one author, or two in a row.
9. "Not interested" hides the post immediately and the author/hashtags drop for 30 days.
10. Same inputs, same order (deterministic), and under 150 ms with 10,000 posts.

## Rollout

1. New migration `0016_night_feed.sql`: only additions (a `get_for_you` function, a
   `not_interested` table with row-level security, two indexes). Nothing existing changes.
2. A switch in Watchtower → Controls, **off** by default. With it off, For You works exactly as
   today.
3. Turn it on for yourself first, then everyone. If anything looks wrong, flip it off; no
   redeploy needed.
4. Later, the same scoring for the Watch tab.

## Decisions needed

1. **Night boost:** posts made at night rank a little higher (×1.15). Recommended: yes. It's
   YORU's identity and it's small.
2. **"Not interested" button:** recommended yes. It's the main way people correct the feed
   without any tracking.
3. **New-member boost** (first 14 days, ×1.3): recommended yes. It helps the people joining
   from your videos actually get seen.
