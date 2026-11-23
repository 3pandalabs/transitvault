# Google Play listing: TransitVault

Package `com.threepandalabs.transitvault` · Developer: 3PandaLabs LLC (organization account) · Category: **Travel & Local** · Free to install · No ads · No purchases through Google Play Billing. Posting and reaching out are free; optional **paid help** is a $10-per-trip fee, charged by card on Stripe Checkout when a poster accepts a helper (the helper gets $5 TransitVault credit). It pays for a real-world, in-person service, which Play's payments policy allows outside Play Billing. Answer the Play Console payments declaration to match.

> **Stripe mode check (2026-11-22):** `GET https://api.transitvault.3pandalabs.com/payments/config` returns `enabled: true`, and as of the last record the API runs on Stripe **TEST** keys. A real user who accepts a helper would land on a test checkout that rejects real cards. Switch to live keys (or set `PAYMENTS_ENABLED=false`) before the app goes to Production.

## App name (30)
TransitVault by 3PandaLabs

## Short description (80)
Parent flying alone? Find someone on the same flight to keep them company.

## Full description (4000)
Is your mom or dad flying alone, maybe through a connection they've never done before?

TransitVault is a simple board for families. Post the trip: who is travelling, the languages they speak, the help they'd like, and every flight with its times, direct or connecting. Someone who is on the same flight sees it and reaches out. You talk privately in the app and agree on how they'll help: a friendly face at the gate, help finding the connecting flight, or just a chat on board.

HOW IT WORKS
• Post a trip: flights, connections and layovers, languages, and the help needed.
• Browse the board: filter by from, to, via, date, flight number and language.
• Flying soon? Post your own flights. TransitVault emails you when a parent is on the same flight, and tells families when a fellow traveller matches.
• Private conversations: one chat per trip and helper. Phone numbers and emails are never shown; people share what they want, when they want.
• Share the trip on WhatsApp with a public preview that hides personal details.
• Travel-day checklist, plus links to official airport meet-and-assist services you can book directly.
• Say thank you afterwards with a note.

FREE TO USE
Posting a trip, browsing the board and reaching out are free. If a family wants to confirm a helper, there's an optional $10 per-trip fee, paid by card when they accept the helper. If the helper doesn't show, the fee comes back as TransitVault credit.

SAFE BY DESIGN
• Only signed-in members can see the board.
• Report or block anyone. Posts reported by three people are hidden.
• Delete your account any time from your profile.

Helpers are fellow travellers lending a hand, not hired escorts. TransitVault doesn't operate any assistance service.

Made by 3PandaLabs.

## Contact
- Email: transitvault@3pandalabs.com (the From address of all app mail; the site itself shows support@3pandalabs.com)
- Website: https://transitvault.3pandalabs.com
- Privacy policy: https://transitvault.3pandalabs.com/privacy
- Terms: https://transitvault.3pandalabs.com/terms
- Account deletion URL: https://transitvault.3pandalabs.com/support (public; explains Profile → Delete account, which is `/profile/delete` when signed in, and the contact form for people who can't sign in)

## Graphics (infra/play-store/)
- `graphics/play-icon-512.png`: Play Store app icon (512×512, opaque): "TransitVault" wordmark in #3b82f6 (a lighter tint of the app accent #1d4ed8, which is too dark on black) with "by 3PandaLabs" beneath, on #0a0a0a. Upload this one. (`graphics/icon-512.png` is the shield icon `npm run graphics` renders for the PWA/launcher.)
- `graphics/feature-graphic.png`: 1024×500
- `screenshots/framed/*.png`: phone screenshots, 1080×1920 (upload these). Raw captures are in `screenshots/raw/`.

## App content answers
- **Ads:** No.
- **App access:** Everything past the home page needs sign-in. No reviewer account exists yet: create one on the live site (name, email, mobile number, password) and paste its email + password into "App access" → "All or some functionality is restricted". Sign-up is email + password only (no Google/phone sign-in).
- **Target audience:** 18+ (not designed for children).
- **Content rating (IARC):** Social/communication app: users can interact and exchange messages (yes); shares user location (no; airports and flights are typed in, no GPS); digital purchases (no: the optional $10 paid-help fee is for an in-person service, paid on the website); AI-generated content (no). Expected rating: Everyone / PEGI 3 with "Users Interact".
- **News app:** No. **Government app:** No. **Financial features:** None. **Health:** No.
- **Data safety:**
  - Collected, all **required** unless noted: Name (account), Email address (account), Phone number (account; never shown to other members), User IDs, Messages → "Other in-app messages" (conversations, thank-you notes), Other user-generated content (trip and "I'm flying" posts: traveller label, age (optional), languages, help needed (optional, may mention e.g. a wheelchair), notes (optional), flight numbers, airports, times), Purchase history (optional: paid-help fees and the credit ledger). Card details are entered on Stripe's page and never reach TransitVault.
  - Purpose: App functionality, Account management, Developer communications (alert and reminder emails), Fraud prevention, security and compliance (reports, blocks, server logs).
  - Shared with third parties: No. Cloudflare, Hetzner, Stripe and Gmail act as service providers, which Play doesn't count as sharing.
  - Encrypted in transit: Yes. Users can request deletion: Yes (in-app Profile → Delete account + URL above). Account creation: username (email) + password, made in the app.
  - No location, contacts, photos, audio, or device identifiers. No analytics SDK, no crash SDK.
- **Permissions in the AAB:** none user-facing (verified with `aapt2 dump permissions` on build 1.0.0 (1) `com.threepandalabs.transitvault`: only the library's internal non-exported receiver permission; Chrome does the networking, notifications are off).
