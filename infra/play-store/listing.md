# Google Play listing: TransitVault

Package `com.threepanda.transitvault` · Developer: 3PandaLabs LLC (organization account) · Category: **Travel & Local** · Free · No ads · No in-app purchases through Play (paid help is a $10 card payment on the website via Stripe Checkout for a real-world service, which Play's payments policy allows outside Google Play Billing).

## App name (30)
TransitVault: Flight Companion

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

SAFE BY DESIGN
• Only signed-in members can see the board.
• Report or block anyone. Posts reported by three people are hidden.
• Delete your account any time from your profile.

Helpers are fellow travellers lending a hand, not hired escorts. TransitVault doesn't operate any assistance service.

Made by 3PandaLabs.

## Contact
- Email: support@3pandalabs.com
- Website: https://transitvault.3pandalabs.com
- Privacy policy: https://transitvault.3pandalabs.com/privacy
- Account deletion URL: https://transitvault.3pandalabs.com/support (public; explains Profile → Delete account, which is `/profile/delete` when signed in, and the contact form for people who can't sign in)

## Graphics (infra/play-store/)
- `graphics/icon-512.png`: hi-res icon (512×512, opaque)
- `graphics/feature-graphic.png`: 1024×500
- `screenshots/framed/*.png`: phone screenshots, 1080×1920 (upload these). Raw captures are in `screenshots/raw/`.

## App content answers
- **Ads:** No.
- **App access:** All features need sign-in. Give reviewers a test account (create one on the live site and paste its email + password into "App access" → "All or some functionality is restricted").
- **Target audience:** 18+ (not designed for children).
- **Content rating (IARC):** Social/communication app: users can interact and exchange messages (yes); shares user location (no); digital purchases (no). Expected rating: Everyone / PEGI 3 with "Users Interact".
- **News app:** No. **Government app:** No. **Financial features:** None. **Health:** No.
- **Data safety:**
  - Collected: Name (optional display name), Email address (account), User IDs, Other user-generated content (trip posts, messages), Payment info is handled by Stripe on the website (not collected by the app).
  - Purpose: App functionality, Account management, Communications (email alerts).
  - Shared with third parties: No (Stripe processes card payments as a service provider).
  - Encrypted in transit: Yes. Users can request deletion: Yes (in-app + URL above).
  - No location, contacts, photos, audio, or device identifiers. No analytics SDK, no crash SDK.
- **Permissions in the AAB:** none user-facing (verified with `aapt2 dump permissions` on build 1.0.0 (1): only the library's internal non-exported receiver permission; Chrome does the networking, notifications are off).
