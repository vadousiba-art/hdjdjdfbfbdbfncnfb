import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, PublicShell } from "@/components/public/PublicShell";
import { LEGAL_UPDATED, supportEmail } from "@/lib/support";
import { paypalConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How YORU collects, uses and protects your information.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  const paypal = paypalConfig().enabled;
  const email = supportEmail();
  return (
    <PublicShell>
      <LegalDoc title="Privacy Policy" updated={LEGAL_UPDATED}>
        <p>
          YORU (夜) is a social network for anime, manga, music, Vocaloid, gaming and art fans, available at yoru-social.vercel.app and in the YORU
          Android app. This policy explains what information YORU collects, why, who it is shared with, and the choices you have. In this policy
          &quot;YORU&quot;, &quot;we&quot; and &quot;us&quot; mean the people who run the service; &quot;you&quot; means anyone who uses it.
        </p>
        <p>
          <b>The short version:</b> we collect what you give us to run your account and show your posts to other members. We don&apos;t show ads, we
          don&apos;t sell your data, and we don&apos;t use third-party analytics or tracking. You can delete your account and everything you posted at
          any time from Settings.
        </p>

        <h2>1. Information we collect</h2>
        <h3>Information you give us</h3>
        <ul>
          <li>
            <b>Account details:</b> your email address, password (stored only in hashed form by our authentication provider), username and display
            name. The email you sign up with is never shown to other members.
          </li>
          <li>
            <b>Profile details you choose to add:</b> profile photo, bio, status, badge emoji, &quot;currently watching / reading / listening /
            playing&quot;, inside jokes, app color and preferences (for example notification and roast settings).
          </li>
          <li>
            <b>Content:</b> posts, photos, GIFs and videos, polls and votes, comments, reactions, awards, bookmarks, reposts and quotes, stories,
            group and direct messages, your AI Menace chat history and your Atlas conversation.
          </li>
          <li>
            <b>Drafts and scheduled posts:</b> drafts you save in Draft Studio and posts you schedule, including the time you picked. They are
            private to you until they are posted.
          </li>
          <li>
            <b>Profile cosmetics and Pro settings:</b> the cosmetics you equip, your wishlist, and choices such as feed filters, muted words,
            interest hub tags, dashboard layout and sound settings.
          </li>
          <li>
            <b>Safety and support:</b> reports you file, people you block, and messages you send through our contact form (including the email you
            give us there).
          </li>
        </ul>
        <h3>Information created as you use YORU</h3>
        <ul>
          <li>
            <b>Activity data:</b> when you were last online (to show the online dot), unread counts, notifications, XP, level, nightly streak and
            points.
          </li>
          <li>
            <b>Milestones:</b> Profile Evolution milestones are worked out from your own activity on YORU (for example posting streaks) and saved
            with the date you earned them.
          </li>
          <li>
            <b>Profile visit counts:</b> when a signed-in member opens your profile, we add one to a daily total for your profile. To count each
            visitor only once a day, we keep a hashed key made from the visitor, your profile and the date. That key is deleted after about two
            days and is never shown to anyone, including you and admins. You only see totals, never who visited.
          </li>
          <li>
            <b>Your analytics</b> (reach, reactions, comments, visit totals) are calculated only from your own posts and profile, and only you can see
            them. We don&apos;t make up or estimate numbers.
          </li>
          <li>
            <b>Technical data:</b> your IP address is used briefly in memory to limit login, sign-up and contact attempts. Our hosting provider
            records standard server logs (such as IP address, device and browser type, and pages requested) to operate and secure the service.
          </li>
          <li>
            <b>Cookies and local storage:</b> we use only the cookies needed to keep you signed in. Your device also stores display preferences
            (theme, motion, sound, background effect, app color and dismissed announcements) and your &quot;recently viewed&quot; cosmetics
            locally. Trying on a cosmetic happens only on your device. We do not use advertising or analytics cookies.
          </li>
        </ul>

        <h2>2. How we use your information</h2>
        <ul>
          <li>To create and secure your account and keep you signed in.</li>
          <li>To show your profile and content to other YORU members, deliver messages and send notifications.</li>
          <li>
            To run features you use: feeds, trending tags, leaderboards (only if you opt in), levels, streaks, milestones, profile cosmetics,
            scheduled posts, your private analytics and the AI Menace.
          </li>
          <li>To keep YORU safe: enforce our Terms, review reports, prevent spam and abuse, and apply limits such as mutes and bans.</li>
          <li>To answer your support, privacy and deletion requests.</li>
        </ul>
        <p>
          Where privacy laws require a legal basis, we rely on performing our agreement with you (running the service you asked for), our legitimate
          interest in keeping YORU safe and working, and your consent where we ask for it (for example personalized AI roasts), which you can
          withdraw at any time in Settings.
        </p>

        <h2>3. Who can see your content</h2>
        <ul>
          <li>YORU is members-only: posts, comments, profiles and stories are visible to signed-in YORU members, not to the public web.</li>
          <li>Direct messages and private group chats are visible only to the people in that conversation.</li>
          <li>
            Admins and moderators (members of the YORU team) can see reported content, content held for review and moderation records in
            Watchtower. A reported direct or group message is shown to them; unreported messages are not. People who operate YORU can access
            stored data when needed to run, secure or repair the service, or to respond to legal obligations.
          </li>
          <li>
            Cosmetics you equip (ring, banner, nameplate, badge, layout and featured milestone) and whether you have Pro are shown on your profile to
            other members. Your milestone timeline is shown too unless you turn it off in the Pro hub. Your wishlist, drafts, scheduled posts,
            settings and analytics are private to you.
          </li>
          <li>Staff cosmetics show that an account belongs to YORU staff. They are tied to the account&apos;s admin or founder role.</li>
          <li>If you block someone, you won&apos;t see each other&apos;s posts, comments or messages.</li>
        </ul>

        <h2>4. AI features</h2>
        <p>
          YORU&apos;s optional comedy features (the AI Menace, roasts and other tools) use Anthropic&apos;s Claude API. When you use them, the text you
          enter, the post being roasted and the relevant display names and usernames are sent to Anthropic to generate a reply. If you turn on
          &quot;Personalized roasts&quot; in Settings, your bio, status, inside jokes and your 5 most recent posts can also be included. Direct and
          group messages are never used for personalization; in group chats, only a message that summons the Menace with a command is sent.
          Members are only roasted by others or picked for &quot;Roast of the Day&quot; if they turn on &quot;Let others roast me&quot;. Under its
          commercial terms, Anthropic does not use these API inputs to train its models. If the AI is unavailable, an offline joke generator runs
          on our own server instead.
        </p>

        <h3>Automated moderation (Night Watch)</h3>
        <p>
          Every new post, comment and story is checked by automated rules that run in our own database (for example slurs, scams, other
          people&apos;s phone numbers and spam floods). When AI review is turned on, the text and any image are also sent to Anthropic&apos;s Claude
          API before they are posted, to check them against our rules; the same happens to content someone reports, including a reported direct
          or group message, and to the content and explanation in an appeal. Unreported messages are never sent for moderation. Under its
          commercial terms Anthropic does not use these inputs to train its models.
        </p>
        <p>
          We keep a record of each moderation decision (the rule, the decision, the reason, and an excerpt of up to 600 characters) and any
          strikes. You can see the decisions about you in Account Standing. Closed records are deleted after a year; strikes a year after they
          expire. When a file is removed, we keep its fingerprint (a one-way SHA-256 hash, not the file) so the same file can&apos;t be uploaded
          again. If a post suggests you might be at risk, Night Watch sends you a private message with free helplines; it doesn&apos;t punish you.
        </p>

        <h3 id="atlas">Atlas, the AI assistant</h3>
        <p>
          Atlas is an optional assistant in its own section of YORU. When you use it, what you send it goes to an AI provider to get a reply: your
          message, any photo or audio you attach (including voice recordings), your recent Atlas conversation (the text of up to 16 earlier
          messages), and your display name, username, bio and status so it can help you with YORU; if you ask about what&apos;s trending, YORU&apos;s
          current trending tags are included too. Voice, audio and photos go to Google&apos;s Gemini API. Text goes to the model you pick: Gemini, or
          a free model offered through OpenRouter, which passes it to the company that runs that model. The Atlas buttons in the post composer,
          comments, chat and bio editor send only the text in that box and your profile basics. Atlas never posts, sends or changes anything for you;
          it only suggests, and you decide.
        </p>
        <p>
          Atlas uses these providers&apos; <b>free tiers</b>. On free tiers, Google and some model providers may use what you send to improve their
          products, and people at those companies may review it. Don&apos;t share passwords, private information or anything about other people that
          they wouldn&apos;t want shared. YORU keeps the text of your Atlas conversation (your latest 200 messages) and your model and voice
          settings, so Atlas can pick up where you left off; you can clear the conversation at any time in Atlas. YORU does not store the photos or
          audio you send Atlas, only a note that something was attached. Spoken replies use your device&apos;s built-in voices; on some browsers
          those voices are provided online by the browser&apos;s maker.
        </p>

        <h3 id="push">Push notifications</h3>
        <p>
          Push notifications are off until you turn them on and allow them on a device. On the website and the installed web app, your browser
          gives YORU a push address at its push service (Google for Chrome, Mozilla for Firefox, Apple for Safari, Microsoft for Edge) and two
          keys. YORU stores those with a short device name like &quot;Chrome on Windows&quot;. Each notification is encrypted so that only your
          device can read it; the push service delivers it without being able to read it, though it can see that something was sent to your
          device and when. Notifications follow your notification settings, and their text (for example a message preview) can appear on your
          lock screen; your phone&apos;s settings control that. YORU deletes a device&apos;s push address when you turn notifications off there,
          when you log out, when the push service says the device is gone, after repeated failed deliveries, or when you delete your account.
        </p>
        <p>
          In the YORU Android app, notifications are shown by the app itself. It checks YORU for new notifications in the background (about every
          15 minutes, using your sign-in on that phone) or, when YORU has turned on instant delivery, receives them through Google&apos;s Firebase
          Cloud Messaging. For instant delivery YORU stores a Firebase token for the phone, and the notification&apos;s title and text pass through
          Google to reach it (they are not end-to-end encrypted on that route).
        </p>

        <h3 id="app-permissions">Android app permissions</h3>
        <p>
          The first time you open the Android app it asks, with Android&apos;s own dialogs, for notifications, the microphone and the camera. You can
          allow or refuse each one, and change them any time in your phone&apos;s Settings → Apps → YORU → Permissions. The microphone is only used
          while you record a message to Atlas, and the camera only while you take a photo or video to attach. Nothing is recorded in the
          background, and YORU&apos;s own pages are the only ones the app lets use them.
        </p>

        <h2>5. Payments</h2>
        {paypal ? (
          <p>
            YORU Pro is a monthly subscription paid through PayPal. You pay in PayPal&apos;s own window, and PayPal handles your card, bank or
            balance under its own privacy statement; YORU never receives or stores your payment details. From PayPal, YORU keeps only what it
            needs to run the subscription: the subscription id, its plan and status, the next billing date, and records of PayPal&apos;s billing
            events (what happened and when, not your name, email or card). Some members also get Pro for free from an admin.
          </p>
        ) : (
          <p>
            YORU Pro can&apos;t be bought yet, and YORU doesn&apos;t collect any payment or card information. Members who test Pro get it for free
            from an admin. If paid Pro opens later, we&apos;ll name the payment provider and update this policy before any payment is taken. Card
            details would be handled by that provider, not stored by YORU.
          </p>
        )}

        <h2>6. Service providers</h2>
        <p>We don&apos;t sell or rent personal information. We share it only with providers that run YORU for us, under their own security and privacy terms:</p>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>What they do</th>
              <th>Data involved</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>Database, sign-in and file storage</td>
              <td>Account details, profile, content, uploads, messages</td>
            </tr>
            {paypal && (
              <tr>
                <td>PayPal</td>
                <td>YORU Pro subscription payments (only if you subscribe)</td>
                <td>Your payment details stay with PayPal; YORU gets the subscription id, status and billing dates</td>
              </tr>
            )}
            <tr>
              <td>Vercel</td>
              <td>Website and app hosting</td>
              <td>Server logs and requests passing through</td>
            </tr>
            <tr>
              <td>Anthropic</td>
              <td>AI comedy features (only when used) and automated moderation (when turned on)</td>
              <td>The text and images described in section 4</td>
            </tr>
            <tr>
              <td>Google (Gemini API)</td>
              <td>Atlas: voice, audio, photos and text (only when you use Atlas)</td>
              <td>What you send Atlas, as described in section 4</td>
            </tr>
            <tr>
              <td>Your browser&apos;s push service (Google, Mozilla, Apple or Microsoft)</td>
              <td>Delivers push notifications to your device (only if you turn them on)</td>
              <td>An encrypted notification and your device&apos;s push address</td>
            </tr>
            <tr>
              <td>Google (Firebase Cloud Messaging)</td>
              <td>Instant notifications in the Android app (only if YORU turns it on and you allow notifications)</td>
              <td>The notification&apos;s title and text, and the phone&apos;s Firebase token</td>
            </tr>
            <tr>
              <td>OpenRouter</td>
              <td>Atlas: routes text to the free model you pick (only when you use it)</td>
              <td>What you send Atlas, as described in section 4</td>
            </tr>
          </tbody>
        </table>
        <p>
          We may also disclose information if required by law, to protect someone&apos;s safety, or as part of a transfer of the service to a new
          operator (in which case this policy continues to apply).
        </p>

        <h2>7. International transfers</h2>
        <p>
          Our providers may store and process information in the United States and other countries, which may have different data protection laws
          than yours. We rely on their contractual safeguards for these transfers.
        </p>

        <h2>8. How long we keep information</h2>
        <ul>
          <li>We keep your account and content for as long as your account exists.</li>
          <li>
            When you delete a post, comment, message or story, it disappears from YORU right away. A hidden copy can remain in our database until you
            delete your account.
          </li>
          <li>
            When you delete your account, we erase your profile, content, messages, uploads and login. Copies in our providers&apos; backups and logs
            expire on their normal schedule.
          </li>
          <li>Stories expire from view after 24 hours. Support messages are kept as long as needed to handle your request.</li>
          <li>Your Atlas conversation keeps your latest 200 messages until you clear it or delete your account. Photos and audio sent to Atlas are not stored by YORU.</li>
          <li>Moderation records are deleted a year after the case is closed; strikes a year after they expire. Content removed by moderation is hidden, not erased, so it can be restored after an appeal or kept as evidence where the law requires.</li>
          <li>
            Drafts are kept until you post or delete them. Daily profile visit totals are kept while your account exists; the keys used to count
            each visitor once are deleted after about two days.
          </li>
        </ul>

        <h2>9. Your choices and rights</h2>
        <ul>
          <li>
            <b>Access and correct:</b> view and edit your profile at any time. Ask us via the contact form for a copy of the personal data we hold
            about you.
          </li>
          <li>
            <b>Delete:</b> Settings → Account → Delete my account erases your account immediately. If you can&apos;t sign in, see{" "}
            <Link href="/delete-account">yoru-social.vercel.app/delete-account</Link>.
          </li>
          <li>
            <b>Control:</b> turn off personalized AI, being roasted, leaderboards and each type of notification in Settings; hide your milestone
            timeline and reset your look in the Pro hub; delete drafts and cancel scheduled posts at any time; block or report anyone.
          </li>
          <li>
            Depending on where you live (for example the EU, UK or California), you may also have rights to object to or restrict processing, to data
            portability, and to complain to your local data protection authority. We don&apos;t sell or &quot;share&quot; personal information for
            targeted advertising. We respond to requests within 30 days.
          </li>
        </ul>

        <h2>10. Security</h2>
        <p>
          YORU uses encrypted HTTPS connections, hashed passwords, database row-level security so members can only read what they are allowed to,
          private file storage with short-lived links, and rate limits. No system is perfectly secure, so please use a unique password.
        </p>

        <h2>11. Age requirement</h2>
        <p>
          YORU is for people aged 16 and older. We don&apos;t knowingly collect information from anyone under 16. If you believe someone under 16 has
          an account, contact us and we will delete it.
        </p>

        <h2>12. Changes to this policy</h2>
        <p>
          We may update this policy as YORU changes. We&apos;ll update the date above and, for significant changes, announce them in the app before
          they take effect.
        </p>

        <h2>13. Contact</h2>
        <p>
          Questions or requests: use the contact form at <Link href="/support">yoru-social.vercel.app/support</Link>
          {email ? (
            <>
              {" "}
              or email <a href={`mailto:${email}`}>{email}</a>
            </>
          ) : null}
          .
        </p>
      </LegalDoc>
    </PublicShell>
  );
}
