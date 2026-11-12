# Official airport assistance: research

**Checked 2026-11-12.** Used by `api/src/data/airportAssistance.ts`, which holds only the verified rows marked **in app** below. How to add or update an entry and switch on a referral parameter: `infra/README.md`. Contract: `api/ROUTES.md` "Airport assistance".

**What we looked for:** a paid meet-and-assist, meet-and-greet or escort service, run by the airport operator or named or endorsed on the airport's own site, that takes a passenger through check-in, security, immigration and transfers.

**The baseline everywhere:** the **airline's own wheelchair / special-assistance service** is free under DGCA, US DOT (ACAA), Canadian CTA and EU/UK PRM rules. Book it with the airline, ideally at least 48 hours ahead. In the US, **TSA Cares** (+1 855 787 2227, at least 72 h ahead, https://www.tsa.gov/travel/passenger-support) adds a Passenger Support Specialist at screening. The app always shows the airline line, and shows a paid service only where an official one exists.

**URL status:** "OK" means the URL loaded (HTTP 200) on 2026-11-12. "Bot-blocked" means an official page exists (seen in search results) but refused automated fetches, so it isn't in the app. "Unverified" means not confirmed, so no URL is given.

## Affiliate and partner programs: which deals to pursue first

None of the official airport-run services has a self-serve, public affiliate program. Every deal below needs a written agreement. They're ranked by how much of TransitVault's India ↔ US/Canada/UK/Gulf traffic each one covers.

1. **Adani Pranaam (BOM, AMD; Adani also runs LKO, JAI, TRV, GAU and IXE).** BOM is the biggest India gateway Adani runs. Pranaam's terms define a "Sales Agent" and an "Authorised Partner for Bookings of Services" (APBS), both by written agreement only. **Apply:** corporateenquiry.pranaam@adani.com, quoting click volume from `assist_clicks`. The B2B reseller Flyzy already resells Pranaam (source 7).
2. **Encalm Atithya (DEL, HYD, GOX: all GMR airports).** DEL is the busiest origin on these routes. No agent or affiliate program is published. **Apply:** Encalm's corporate or B2B contact via encalm.com, or GMR's airport commercial team. Pitch a referral deal backed by DEL click volume.
3. **Plaza Premium Group / ALLWAYS (DFW, YYZ; also on Heathrow's approved list; network includes the other US airports).** This is the **only official provider with a live affiliate program**: Plaza Premium on **Awin**, 4% commission, 30-day cookie (https://ui.awin.com/merchant-profile/15571). India coverage of that program is unclear. **Apply:** join Awin as a publisher and request the Plaza Premium programme, then set `affiliateParam` (or the Awin deep link as `url`) on DFW, YYZ and, if wanted, LHR.

Next tier:
- **Primefly / Speedwings (COK; also lists MAA and GOI):** "Become a B2B Partner" at https://www.primefly.in/register-corporate (not opened).
- **Qatar Airways Al Maha (DOH):** agents sell it through the QR Trade Portal; commission terms unverified.
- **airport.online:** a multi-airport aggregator, not official. Its affiliate program pays up to 15%; apply by emailing editor@airport.online (https://airport.online/en/affiliate-program). Use it only as a fallback.
- **airssist:** an aggregator with a travel-agent partnership (https://airssist.com/airssist-for-travel-agents; terms not readable). It covers ATQ, GOI, ZRH and many US airports.

## India

| Airport | Service | Operator | Booking / info URL | Journeys | Indicative price (2026-11-12) | Affiliate / partner | In app |
|---|---|---|---|---|---|---|---|
| DEL | Atithya Meet & Assist | Encalm Hospitality for DIAL (GMR) | https://www.newdelhiairport.in/atithya-and-services (OK); booking engine https://encalm.com/atithya/home (OK) | Dep / Arr / Transit, dom + intl | Not published. Silver / Gold / Elite tiers; a reseller lists Silver intl arrival at US$66 | None public (see deal #2) | **yes** |
| BOM | Pranaam | Adani Airports (operator) | https://csmia-mumbai.adaniairports.com/en/airport-services/pranaam-meet-and-greet-service (OK); booking on adanione.com | Dep / Arr / Transit, dom + intl | Not published (Platinum / Elite / Elite Plus). An old ₹3,500 Platinum price is historical | Sales Agent / APBS by agreement (deal #1) | **yes** |
| AMD | Pranaam | Adani Airports (operator) | https://svpia-ahmedabad.adaniairports.com/en/airport-services/pranaam-meet-and-greet-service (OK) | Dep / Arr / Transit | Not published | As BOM | **yes** |
| HYD | Atithya Meet & Greet | Encalm, listed on the GMR airport site | https://www.hyderabad.aero/rgia/airport-facilities/meet-greet-services (OK) | Dep / Arr / Transit | Official table: Silver ₹2,600, Gold ₹3,500, Elite ₹4,500 (incl. taxes, labelled international) | None public | **yes** |
| BLR | Care by BLR (Meet & Assist) | BIAL (operator) | Unverified (the site is a single-page app, so no deep link could be confirmed) | Dep / Arr / Transit (press) | Unverified | None found | no |
| MAA | AAI airport; contractor unclear (Primefly reported in 2022, GlobeGround "Namaskar" in another report) | — | Unverified | — | Unverified | — | no |
| COK | Primefly Meet & Greet | Speedwings Air Services, CIAL's contracted operator | https://www.primefly.in/ (OK; choose Cochin-COK). cial.aero was bot-blocked | Dep / Arr / Transit, dom + intl | Not published (₹300 in 2021, historical) | B2B partner signup | **yes** |
| CCU | Elite Assist | Travel Food Services, launched at the airport Feb 2025 (an airport official cited by PTI) | https://eliteassist.travelfoodservices.com/ (OK) | Dep / Arr (transit not listed); book at least 4 h ahead | Unverified | None found | **yes** (dep/arr only) |
| ATQ | No official service verified | — | — | — | — | Aggregator: airssist covers Amritsar (no public affiliate) | no |
| GOI (Dabolim, AAI) | No official service found | — | — | — | — | Aggregator: Primefly lists GOI (B2B signup) | no |
| GOX (Mopa, GMR) | Atithya | Encalm | https://www.miagoaairport.com/athitya-services (OK) | Dep / Arr | Not published | None public | **yes** (added: many Goa flights now use Mopa) |

## Gulf, Europe and Asian hubs

| Airport | Service | Operator | Booking / info URL | Journeys | Indicative price (2026-11-12) | Affiliate / partner | In app |
|---|---|---|---|---|---|---|---|
| DXB | marhaba Meet & Greet | dnata (Emirates Group) | https://www.marhabaservices.com/ (OK) | Dep / Arr / Transit | From AED 136 (flydubai resells it from AED 99.75) | None official. An affi.io page exists but its operator is unverified | **yes** |
| AUH | Salam Meet & Assist | Abu Dhabi Airports | adairports.ae / zayedinternationalairport.ae hospitality pages: bot-blocked (403) | Dep / Arr | Unverified (resellers ~US$140) | None found | no |
| DOH | Al Maha Services | Qatar Airways / HIA | qatarairways.com Al Maha page: bot-blocked / timed out | Dep / Arr / Transit | Unverified (reseller ~US$185); book at least 12 h ahead | QR Trade Portal (agents) | no |
| IST | iGA Meet & Greet | iGA (airport operator) | https://www.igapass.com/en/iga-meet-and-greet-p-7000 (OK) | Dep / Arr / Transfer | €207.50 + VAT; **35% off for 65+** at sales points | None found | **yes** |
| FRA | Fraport VIP Services; Terminal 3 Concierge Meet & Assist | Fraport AG | https://vip.frankfurt-airport.com/en.html (OK); https://www.frankfurt-airport.com/en/travel-planning/bookable-services/concierge_services.html (OK) | VIP: Dep / Arr / Transfer (T1/T2); Concierge: T3 only | T3 Meet & Assist €339 incl. VAT (+€175 per extra guest); VIP price list unverified | "VIP-Partners" page, no affiliate | **yes** |
| MUC | Meet & Assist Service (VipWing is the premium tier) | Flughafen München GmbH | https://www.munich-airport.de/meet-and-assist-595054 (OK); order form or meetandassist@munich-airport.de | Dep / Arr / Transfer | €200 net (+€75 per extra person; Dec-2025 tariff). VipWing from €630 | None found | **yes** |
| LHR | Heathrow's approved provider list (Global Airport Concierge, REPS UK, Airport Concierge, ALLWAYS, VIP Assist, Airport VIP); the Windsor Suite is separate | Third parties approved by Heathrow | https://www.heathrow.com/at-the-airport/airport-services/meet-and-assist-concierge-service (OK) | Varies by provider | From ~£120 (Global Airport Concierge); Windsor Suite ~£3,800 | Plaza Premium / ALLWAYS on Awin (deal #3) | **yes** |
| AMS | Schiphol Meet & Assist | Royal Schiphol Group | schiphol.nl meet-and-assist page: bot-blocked (403) | Dep / Arr / Transfer (unverified) | €219 family package (unverified) | None found | no |
| CDG | Extime Meet & Greet, hosted by Paris Aéroport | Paris Aéroport (Extime / Paris Lounge Network) | https://www.extime.com/en/paris/services/le-meet-greet-extime (OK) | **Departure only** | €171 for 1–3 people | None found | **yes** (origin only) |
| ZRH | VIP Service (no cheaper official meet & assist) | Flughafen Zürich AG | https://www.flughafen-zuerich.ch/en/passengers/fly/assistance/vip-services (OK) | Dep / Arr / Transit | From CHF 1,100 | None. Aggregator: airssist | **yes** |
| SIN | Changi Meet & Greet | Changi Travel Services (Changi Recommends), listed by changiairport.com | https://www.changirecommends.com/meetandgreet.aspx (OK) | Dep / Arr / Transit (+ mobility companion) | From ~S$100 arr/dep; transit ~S$200 | None found | **yes** |

## North America

Most US airports have no airport-run paid meet-and-assist service. Wheelchair and escort help comes from the airline, and TSA Cares covers screening.

| Airport | Service | Operator | Booking / info URL | Journeys | Indicative price (2026-11-12) | Affiliate / partner | In app |
|---|---|---|---|---|---|---|---|
| DFW | ALLWAYS Meet & Greet, named the airport's "partner" | ALLWAYS (Plaza Premium Group) | https://www.dfwairport.com/explore/plan/assist/meetgreet/ (OK) | Dep / Arr (incl. CBP + bag recheck) / Transit | "From US$69" on a Plaza Premium listing (unverified) | Plaza Premium on Awin (deal #3) | **yes** |
| YYZ | ALLWAYS Meet & Assist, endorsed on torontopearson.com (T1 + T3) | ALLWAYS (Plaza Premium Group) | https://www.allwaysvip.com/?loc=yyz (OK). The Pearson page is bot-blocked (ShieldSquare) | Dep / Arr / Connection | Unverified | Plaza Premium on Awin | **yes** |
| JFK | JFK T4 Meet & Greet (Terminal 4 only) | JFKIAT, the private T4 operator | https://www.jfkairport.com/explore-jfk/terminals/terminal-4 (OK) | Dep / Arr / Connection | Unverified | None found | **yes** (T4 only) |
| LAX | No official meet & assist. PS is a private terminal (Salon ~US$995+) | — | — | — | — | PS Travel Advisor program (unverified) | no |
| SFO | None current (a 2016 paid-concierge pilot) | — | — | — | — | — | no |
| IAH | None (free volunteer ambassadors) | — | — | — | — | — | no |
| ATL | None (free Guest Relations) | — | — | — | — | — | no |
| EWR, ORD, IAD, BOS, SEA | None found | — | — | — | SEA: a third party cited at US$475 | Aggregator: airssist (agent partnership) | no |
| YVR | None official (YVR Guest Experience is free, +1 604 207 7077; Airport Butler is private) | — | — | — | — | — | no |

**Aggregator for the "none" rows:** airssist covers JFK, IAH, ATL, SFO, LAX, YVR, YYZ, ZRH, ATQ and GOI (all its pages block automated fetches, so its prices are unverified). ALLWAYS lists all 13 North American airports in its network, but only DFW and YYZ endorse it on their own sites. Neither is in the app, which shows only official services.

## Sources

India: https://www.newdelhiairport.in/atithya-and-services · https://encalm.com/atithya/home · https://fasttrack.aero/maas-del-intl-arr-silver · https://csmia-mumbai.adaniairports.com/en/airport-services/pranaam-meet-and-greet-service · https://svpia-ahmedabad.adaniairports.com/en/airport-services/pranaam-meet-and-greet-service · https://www.adanione.com/terms-and-conditions/pranaam-services · https://travelbizmonitor.com/flyzy-partners-with-adani-digital-labs · https://www.hyderabad.aero/rgia/airport-facilities/meet-greet-services · https://www.deccanherald.com/india/karnataka/bengaluru/kia-launches-care-by-blr-for-personalised-passenger-services-3878073 · https://www.primefly.in/ · https://www.onmanorama.com/travel/travel-news/2021/10/12/kochi-airport-resumes-meet-and-greet-service.html · https://www.indianeagle.com/travelbeats/indian-airports-meet-and-greet-service · https://theprint.in/india/paid-concierge-service-launched-at-kolkata-airport/2502804 · https://eliteassist.travelfoodservices.com/pages/faq · https://www.miagoaairport.com/athitya-services · https://airssist.com/meet-and-greet-service/dabolim-airport · https://airssist.com/meet-and-greet-service/amritsar-raja-sansi-airport

Gulf, Europe, Asia: https://www.marhabaservices.com/ · https://flydubai.com/en/book-and-manage/meet-and-greet · https://affi.io/m/marhaba · https://www.adairports.ae/en/services/hospitality · https://www.qatarairways.com/en/hia-hamad-international-airport/al-maha-services.html · https://www.qatarairways.com/tradeportal/en/ancillaryservices/AL-Maha-Services.html · https://www.istairport.com/en/services/discover/iga-pass-experiences · https://www.igapass.com/en/iga-meet-and-greet-p-7000 · https://vip.frankfurt-airport.com/en.html · https://www.frankfurt-airport.com/en/travel-planning/bookable-services/concierge_services.html · https://www.munich-airport.de/meet-and-assist-595054 · https://www.heathrow.com/at-the-airport/airport-services/meet-and-assist-concierge-service · https://thebusinesstravelmag.com/heathrow-unveils-3m-vip-suite-refurb/ · https://www.schiphol.nl/en/at-schiphol/services/meet-and-assist · https://www.extime.com/en/paris/services/le-meet-greet-extime · https://www.flughafen-zuerich.ch/en/passengers/fly/assistance/vip-services · https://www.changiairport.com/en/at-changi/facilities-and-services-directory/passenger-meeting-services.html · https://www.changirecommends.com/meetandgreet_faq.aspx

North America: https://www.dfwairport.com/explore/plan/assist/meetgreet/ · https://www.allwaysvip.com/our-services/meet-and-assist · https://www.torontopearson.com/en/while-you-are-here/book-meet-and-greet · https://www.jfkairport.com/explore-jfk/terminals/terminal-4 · https://reserveps.com/faqs · https://airportimprovement.com/article/san-francisco-intl-launches-pilot-paid-concierge-service/ · https://www.fly2houston.com/airport-business/newsroom/articles/item/houston-airports-honors-volunteers-who-set-the-tone-for-travelers/ · https://www.atl.com/?p=4891 · https://thepointsguy.com/travel/vip-airport-concierge-services/ · https://news.yvr.ca/accessible-travel-at-yvr-making-spirits-bright-for-everyone/ · https://www.tsa.gov/travel/passenger-support

Affiliate: https://ui.awin.com/merchant-profile/15571 · https://airport.online/en/affiliate-program · https://airssist.com/airssist-for-travel-agents
