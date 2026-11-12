// Official paid meet-and-assist services, keyed by IATA code (api/ROUTES.md
// "Airport assistance"). Research, sources and the airports left out:
// infra/airport-assistance-research.md. How to add or update an entry, and how
// to switch on a referral parameter once a deal is signed: infra/README.md.
//
// Only VERIFIED entries go here: an airport-run or airport-authorised service
// whose booking URL resolved when checked. If unsure, leave the airport out:
// the web then shows only the free airline-assistance line.

export type Journey = "departure" | "arrival" | "transit";

export type AirportAssistEntry = {
  iata: string;
  /** Airport name as families say it ("Delhi"). */
  airport: string;
  /** The service as the provider names it. */
  provider: string;
  /** Who runs it. */
  operator: string;
  /** How it's official, shown as "(paid, <authority>)": e.g. "run by the airport". */
  authority: string;
  /** Booking page; the click redirect sends families here. */
  url: string;
  /** Journeys it covers. The origin needs departure, a layover transit, the destination arrival. */
  covers: Journey[];
  /** Indicative price with currency, or how pricing works. Shown as-is. */
  priceNote: string;
  /** Referral query parameter(s) appended to `url` once a deal is signed, e.g. "ref=transitvault". Empty = none. */
  affiliateParam: string;
  /** YYYY-MM-DD the entry was last checked. */
  lastChecked: string;
};

const CHECKED = "2026-11-12";
const ALL: Journey[] = ["departure", "arrival", "transit"];

// `affiliateParam` and `lastChecked` default to "" and CHECKED; set them on an
// entry to override (e.g. `affiliateParam: "ref=transitvault"` once signed).
const entries: (Omit<AirportAssistEntry, "lastChecked" | "affiliateParam"> & Partial<Pick<AirportAssistEntry, "lastChecked" | "affiliateParam">>)[] = [
  // ---- India -----------------------------------------------------------------
  {
    iata: "DEL",
    airport: "Delhi",
    provider: "Atithya Meet & Assist",
    operator: "Encalm Hospitality for Delhi Airport (DIAL)",
    authority: "run for the airport",
    url: "https://www.newdelhiairport.in/atithya-and-services",
    covers: ALL,
    priceNote: "Silver, Gold and Elite tiers; price shown when booking.",
  },
  {
    iata: "BOM",
    airport: "Mumbai",
    provider: "Pranaam Meet & Greet",
    operator: "Adani Airports (Mumbai airport operator)",
    authority: "run by the airport",
    url: "https://csmia-mumbai.adaniairports.com/en/airport-services/pranaam-meet-and-greet-service",
    covers: ALL,
    priceNote: "Platinum, Elite and Elite Plus tiers; price shown when booking.",
  },
  {
    iata: "AMD",
    airport: "Ahmedabad",
    provider: "Pranaam Meet & Greet",
    operator: "Adani Airports (Ahmedabad airport operator)",
    authority: "run by the airport",
    url: "https://svpia-ahmedabad.adaniairports.com/en/airport-services/pranaam-meet-and-greet-service",
    covers: ALL,
    priceNote: "Price shown when booking.",
  },
  {
    iata: "HYD",
    airport: "Hyderabad",
    provider: "Atithya Meet & Greet",
    operator: "Encalm Hospitality for GMR Hyderabad airport",
    authority: "listed by the airport",
    url: "https://www.hyderabad.aero/rgia/airport-facilities/meet-greet-services",
    covers: ALL,
    priceNote: "About ₹2,600–₹4,500 (Silver to Elite, incl. taxes).",
  },
  {
    iata: "COK",
    airport: "Kochi",
    provider: "Primefly Meet & Greet",
    operator: "Speedwings Air Services (Primefly), Kochi airport's contracted operator",
    authority: "the airport's contracted service",
    url: "https://www.primefly.in/",
    covers: ALL,
    priceNote: "Price shown when booking (choose Cochin-COK).",
  },
  {
    iata: "CCU",
    airport: "Kolkata",
    provider: "Elite Assist",
    operator: "Travel Food Services, at Kolkata airport",
    authority: "the airport's concession",
    url: "https://eliteassist.travelfoodservices.com/",
    covers: ["departure", "arrival"],
    priceNote: "Price shown when booking; book at least 4 hours ahead.",
  },
  {
    iata: "GOX",
    airport: "Goa Mopa",
    provider: "Atithya Meet & Greet",
    operator: "Encalm Hospitality for GMR Goa (Mopa) airport",
    authority: "listed by the airport",
    url: "https://www.miagoaairport.com/athitya-services",
    covers: ["departure", "arrival"],
    priceNote: "Price shown when booking.",
  },
  // ---- Gulf / hubs -----------------------------------------------------------
  {
    iata: "DXB",
    airport: "Dubai",
    provider: "marhaba Meet & Greet",
    operator: "dnata (Emirates Group)",
    authority: "the airport's official meet-and-greet service",
    url: "https://www.marhabaservices.com/",
    covers: ALL,
    priceNote: "From about AED 136 per person.",
  },
  {
    iata: "IST",
    airport: "Istanbul",
    provider: "iGA Meet & Greet",
    operator: "iGA Istanbul Airport",
    authority: "run by the airport",
    url: "https://www.igapass.com/en/iga-meet-and-greet-p-7000",
    covers: ALL,
    priceNote: "About €207.50 + VAT; 35% off for passengers 65+ at iGA sales points.",
  },
  {
    iata: "FRA",
    airport: "Frankfurt",
    provider: "Fraport VIP Services",
    operator: "Fraport AG",
    authority: "run by the airport",
    url: "https://vip.frankfurt-airport.com/en.html",
    covers: ALL,
    priceNote: "VIP pricing on request; Terminal 3 Meet & Assist from €339.",
  },
  {
    iata: "MUC",
    airport: "Munich",
    provider: "Munich Airport Meet & Assist",
    operator: "Flughafen München GmbH",
    authority: "run by the airport",
    url: "https://www.munich-airport.de/meet-and-assist-595054",
    covers: ALL,
    priceNote: "About €200 + VAT; book by order form or email.",
  },
  {
    iata: "LHR",
    airport: "London Heathrow",
    provider: "Heathrow-approved meet & assist providers",
    operator: "Approved third parties listed by Heathrow",
    authority: "approved by Heathrow",
    url: "https://www.heathrow.com/at-the-airport/airport-services/meet-and-assist-concierge-service",
    covers: ALL,
    priceNote: "From about £120, varies by provider.",
  },
  {
    iata: "CDG",
    airport: "Paris Charles de Gaulle",
    provider: "Extime Meet & Greet",
    operator: "Paris Aéroport (Extime)",
    authority: "run by the airport",
    url: "https://www.extime.com/en/paris/services/le-meet-greet-extime",
    covers: ["departure"],
    priceNote: "About €171 for 1–3 people; departures only.",
  },
  {
    iata: "ZRH",
    airport: "Zurich",
    provider: "Zurich Airport VIP Service",
    operator: "Flughafen Zürich AG",
    authority: "run by the airport",
    url: "https://www.flughafen-zuerich.ch/en/passengers/fly/assistance/vip-services",
    covers: ALL,
    priceNote: "From CHF 1,100 (VIP service).",
  },
  {
    iata: "SIN",
    airport: "Singapore Changi",
    provider: "Changi Meet & Greet",
    operator: "Changi Travel Services (Changi Recommends)",
    authority: "the airport's official service",
    url: "https://www.changirecommends.com/meetandgreet.aspx",
    covers: ALL,
    priceNote: "From about S$100 for arrival or departure; transit about S$200.",
  },
  // ---- North America ---------------------------------------------------------
  {
    iata: "JFK",
    airport: "New York JFK",
    provider: "JFK Terminal 4 Meet & Greet",
    operator: "JFKIAT (Terminal 4 operator)",
    authority: "run by the terminal operator",
    url: "https://www.jfkairport.com/explore-jfk/terminals/terminal-4",
    covers: ALL,
    priceNote: "Terminal 4 only; price shown when booking.",
  },
  {
    iata: "DFW",
    airport: "Dallas/Fort Worth",
    provider: "ALLWAYS Meet & Greet",
    operator: "ALLWAYS (Plaza Premium Group)",
    authority: "the airport's partner",
    url: "https://www.dfwairport.com/explore/plan/assist/meetgreet/",
    covers: ALL,
    priceNote: "Price shown when booking.",
  },
  {
    iata: "YYZ",
    airport: "Toronto Pearson",
    provider: "ALLWAYS Meet & Assist",
    operator: "ALLWAYS (Plaza Premium Group)",
    authority: "endorsed by Toronto Pearson",
    url: "https://www.allwaysvip.com/?loc=yyz",
    covers: ALL,
    priceNote: "Price shown when booking.",
  },
];

export const AIRPORT_ASSISTANCE: Record<string, AirportAssistEntry> = Object.fromEntries(
  entries.map((e) => [e.iata, { affiliateParam: "", lastChecked: CHECKED, ...e }]),
);
