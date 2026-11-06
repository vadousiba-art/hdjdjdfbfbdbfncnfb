# YORU video: the stare, with a new message

Your best video so far: **2.3K views, 118 likes, 9 reposts and 17 sends**, from 15 seconds of
you staring into the lens. This keeps that format (the stare, the dark room, the stacked
words) but says something new, in the YORU look. The original's message ("they don't see it,
you do") isn't reused.

## Why the original works

- **One unbroken stare** in a dark room lit only by the monitor, eyes wide. It looks nothing
  like the bright videos around it, so people stop scrolling.
- **It talks to the viewer about their own feeling**: people don't get what you're building.
  That's why it got sends: people pass it to the friend who's building something.
- **The words stack up top-left as you say them**, small connector words and huge key words,
  so it works with the sound off.
- **The twist at the end**: "You know who does? You do."

## What stays, what changes

| | Your best video | The YORU version |
| --- | --- | --- |
| Room and light | dark, blue monitor glow | dark, **YORU red** glow from the monitor (`light/yoru-red-light.png`), plus one blue take as a test |
| You | no sunglasses, wide eyes, straight at the lens | the same |
| Words | condensed font, stacked top-left, appear as spoken | **Inter** (YORU's font), uppercase, stacked top-left, appear as spoken |
| Key word | white | **one word per block in YORU red** |
| Handle | Instagram icon + @ethan_lang__founder | the same, in Inter, lower left |
| Ending | "let that sink in" | the last line, then **"Comment NIGHT and I'll send you what I'm building"** on screen |

A preview of the look on a frame of your own video, blue next to red, is in
`out/motivation-look.png`. It stays private and isn't in git.

**Exception to the style rules, on purpose:** this video keeps your stacked words instead of
the usual 1–3 word captions at 68% down, because that's the look you asked for. Everything
else stays: each word just appears in place (nothing flies or slides), one font, plain cuts,
pauses over 0.1 s cut.

## The script: "Nobody's coming" (scripts 2 and 3 mixed, about 18 s)

> **Nobody's coming to give you permission.**
> So your first version will be embarrassing, and you'll post it anyway, because waiting for
> perfect is just quitting slowly.
> **Cringe beats never.**
> Nobody's coming, and that's the best news you'll get, because the only person you're
> waiting on is you.
> **Ship it tonight.**

### The rhythm: short, long, short, long, short

| # | Type | Line | Words |
| --- | --- | --- | --- |
| 1 | **Hook (short)** | Nobody's coming to give you permission. | 6 |
| 2 | Long (a sentence and a half) | So your first version will be embarrassing, and you'll post it anyway, because waiting for perfect is just quitting slowly. | 20 |
| 3 | **Short** | Cringe beats never. | 3 |
| 4 | Long (the second hook) | Nobody's coming, and that's the best news you'll get, because the only person you're waiting on is you. | 18 |
| 5 | **Short (the ending)** | Ship it tonight. | 3 |

- Every short line is under 7 words, and every long line is one sentence and a bit, easy to
  say in one breath (breathe at the comma if you need to).
- **Line 4 is a callback:** it repeats the hook ("Nobody's coming") but flips its meaning
  from scary to good news. That twist is this video's "You do."
- Script 3 gives the hook, the callback and the "tonight"; script 2 gives the embarrassing
  first version and "cringe beats never".

### The blocks on screen (one red word per block)

1. NOBODY'S COMING / TO GIVE YOU / **[PERMISSION.]**
2. SO YOUR FIRST VERSION / **WILL BE [EMBARRASSING,]**
3. AND YOU'LL POST IT ANYWAY, / BECAUSE WAITING FOR PERFECT / **IS JUST QUITTING [SLOWLY.]**
4. **CRINGE / BEATS / [NEVER.]**
5. NOBODY'S COMING, / AND THAT'S / **THE BEST [NEWS]** / YOU'LL GET,
6. BECAUSE THE ONLY PERSON / YOU'RE WAITING ON / **IS [YOU.]**
7. SHIP IT / **[TONIGHT.]**
8. (small, last 2 s) COMMENT "NIGHT" AND I'LL SEND YOU WHAT I'M BUILDING

### Alternate lines (one extra take each, for the test versions)

- Hook: **"Nobody's coming to save your idea."** (6 words)
- Ending: **"So decide. Tonight."** (3 words)

Say the lines your way. If a word comes out different, I'll put up the words you actually say.

### The technique: what it's called

There isn't one official name for it, but it's well known:

- **Sentence length variation.** Gary Provost's "write music" passage in *100 Ways to Improve
  Your Writing* (1985) is the famous example: a run of same-length sentences gets monotonous,
  so mix short, medium and long so the writing "sings".
- **Tension and release** (also called suspension and resolution). A long sentence builds,
  and the short one right after it lands the point. The contrast is what makes the short line
  hit.
- Two classic devices in this script: the **callback** (line 4 repeats the hook) and the
  **punch line** or "kicker" (the short line that ends each beat).

**Saved for later:** "You're early" (being young is a head start) is still a good separate
video. Its script is in git history if you want it next.

## How to record

1. **Light test first.** Turn every light off. Open `light/yoru-red-light.png` full screen on
   your monitor (F11) with the brightness all the way up. Record **5 seconds** and send it to
   me before anything else. Phone cameras can turn strong red muddy; if that happens we go a
   bit darker or back to blue.
2. **Framing:** phone vertical, propped at eye level, close (head and shoulders), straight
   on. Keep your **eyes about 40–45% down the frame**, so the top third is dark wall for the
   words. No sunglasses, same as the original.
3. **Delivery:** wide eyes, barely blink, stare **into the lens**, not the screen. Slow, low
   and steady, without long stops between lines (I cut every gap over 0.1 s, so steady speech
   keeps it one continuous stare). Long lines: steady, one breath, like you're
   explaining. **Short lines: stop for a beat first, then say them slower and lower, hitting
   every word** ("Cringe. Beats. Never."). The contrast is what makes them land
4. **Takes:** the whole script **in one go, start to finish**, 3 takes, with a second of
   silence before and after. Then one take each of the alternate hook and ending lines.
5. **Extras:**
   - The script once more with a **normal monitor** (blue or white glow), to test the
     original look against the red one.
   - Optional: after the script, quieter: "If you want to see what I'm building... comment
     NIGHT." (a spoken-CTA version)

## How I'll edit it

- **Grade:** deep blacks, keep the glow's colour, nothing else.
- **Words:** Inter, uppercase, stacked top-left starting about 16% down (inside the grid
  crop). Connector words are about 62 px ExtraBold, big words about 150 px Black. Each word
  appears the moment you say it, fading from grey to white in 0.1 s like the original, with a
  soft dark shadow and one red word per block. The block clears at each new sentence.
- **Handle:** Instagram icon + @ethan_lang__founder, lower left.
- **Sound:** your voice, cleaned to -14 LUFS. If you want, add a quiet trending sound in
  Instagram.
- **Four versions:** the main one in red, the same in blue (look test), the alternate hook
  ("...to save your idea") and the alternate ending ("So decide. Tonight."). The spoken-CTA
  cut too, if you record it.

## Caption (draft)

> Nobody's coming to give you permission. 🌙
>
> Ship the embarrassing version tonight.
>
> Send this to the friend sitting on a project they're too scared to post. Comment NIGHT and
> I'll send you what I'm building.
>
> #buildinpublic #founder #entrepreneur #motivation

## Posting

- Post the red main version first. Post the blue version and the alternate lines on later
  days to see which wins.
- If your account has **over 1,000 followers**, try the test versions as **Trial Reels**
  first (non-followers only).
- Reply to every NIGHT comment with the YORU link.

## What I need from you

1. **The 5-second light test**, first.
2. Then the takes: the full script (3 takes), the alternate lines and the extras.
3. Your handle is **@ethan_lang__founder** (from your screenshot). Tell me if the videos
   should use a different one.
