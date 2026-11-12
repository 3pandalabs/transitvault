import { describe, expect, it } from "vitest";
import { AIRPORT_ASSISTANCE, type AirportAssistEntry } from "../src/data/airportAssistance.js";
import { airlinesFor, airportHelp, assistForRoute, assistMailBlock, bookPath, providerUrl, routeAirports } from "../src/lib/assist.js";

const entry = (iata: string, covers: AirportAssistEntry["covers"], extra: Partial<AirportAssistEntry> = {}): AirportAssistEntry => ({
  iata,
  airport: iata,
  provider: `${iata} Meet & Assist`,
  operator: `${iata} Airport`,
  authority: "run by the airport",
  url: `https://example.test/${iata.toLowerCase()}`,
  covers,
  priceNote: "From €100.",
  affiliateParam: "",
  lastChecked: "2026-11-12",
  ...extra,
});

const route = { origin: "DEL", layovers: ["FRA"], destination: "ORD" };

describe("route → airports", () => {
  it("lists origin, layovers, destination in travel order", () => {
    expect(routeAirports(route)).toEqual([
      { iata: "DEL", role: "origin" },
      { iata: "FRA", role: "layover" },
      { iata: "ORD", role: "destination" },
    ]);
  });

  it("keeps each airport once (round trip through the origin)", () => {
    expect(routeAirports({ origin: "DEL", layovers: ["DXB"], destination: "DEL" }).map((a) => a.iata)).toEqual(["DEL", "DXB"]);
  });

  it("returns only airports with an entry covering what the traveller does there", () => {
    const table = {
      DEL: entry("DEL", ["departure", "arrival", "transit"]),
      FRA: entry("FRA", ["departure", "arrival", "transit"]),
      // ORD has none.
    };
    expect(assistForRoute(route, table).map((x) => [x.entry.iata, x.role])).toEqual([
      ["DEL", "origin"],
      ["FRA", "layover"],
    ]);
  });

  it("skips a departure-only service at a layover or the destination", () => {
    const table = { CDG: entry("CDG", ["departure"]), LHR: entry("LHR", ["arrival"]) };
    expect(assistForRoute({ origin: "BOM", layovers: ["CDG"], destination: "LHR" }, table).map((x) => x.entry.iata)).toEqual(["LHR"]);
    expect(assistForRoute({ origin: "CDG", layovers: [], destination: "BOM" }, table).map((x) => x.entry.iata)).toEqual(["CDG"]);
  });

  it("empty when no airport on the route has an entry", () => {
    expect(assistForRoute({ origin: "XXX", layovers: [], destination: "YYY" })).toEqual([]);
  });
});

describe("provider URL", () => {
  it("is the plain URL when no affiliate param is set", () => {
    expect(providerUrl(entry("DEL", ["departure"]))).toBe("https://example.test/del");
  });

  it("appends the affiliate param with ? or &", () => {
    expect(providerUrl({ url: "https://p.test/book", affiliateParam: "ref=transitvault" })).toBe("https://p.test/book?ref=transitvault");
    expect(providerUrl({ url: "https://p.test/book?loc=yyz", affiliateParam: "ref=transitvault" })).toBe("https://p.test/book?loc=yyz&ref=transitvault");
    expect(providerUrl({ url: "https://p.test/book?", affiliateParam: "&ref=tv" })).toBe("https://p.test/book?ref=tv");
  });

  it("keeps a #fragment last", () => {
    expect(providerUrl({ url: "https://p.test/book#top", affiliateParam: "?aff=1" })).toBe("https://p.test/book?aff=1#top");
  });

  it("the click path carries the need id when there is one", () => {
    expect(bookPath("DEL", "abc")).toBe("/go/assist/DEL?need=abc");
    expect(bookPath("DEL", null)).toBe("/go/assist/DEL");
  });
});

describe("the checked-in data", () => {
  it("every entry is keyed by its own IATA code, has an https URL, covers something, and has no affiliate param yet", () => {
    for (const [k, e] of Object.entries(AIRPORT_ASSISTANCE)) {
      expect(k).toBe(e.iata);
      expect(k).toMatch(/^[A-Z]{3}$/);
      expect(e.url).toMatch(/^https:\/\//);
      expect(e.covers.length).toBeGreaterThan(0);
      expect(e.affiliateParam).toBe("");
      expect(e.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("airport help payload + email block", () => {
  const need = { ...route, flightNumbers: ["LH761", "LH430"] };

  it("names the airlines from the flight numbers, unknown ones by code", () => {
    expect(airlinesFor(["LH761", "LH430", "ZZ1"])).toEqual([
      { code: "LH", name: "Lufthansa" },
      { code: "ZZ", name: null },
    ]);
  });

  it("uses the real data for DEL → FRA → ORD (FRA has an official service)", () => {
    const help = airportHelp(need, "n1");
    expect(help.airports.some((a) => a.iata === "FRA" && a.role === "layover" && a.bookPath === "/go/assist/FRA?need=n1")).toBe(true);
    expect(help.airports.every((a) => AIRPORT_ASSISTANCE[a.iata])).toBe(true);
    expect(help.airlines).toEqual([{ code: "LH", name: "Lufthansa" }]);
  });

  it("email block: airline line always, airport lines link through the API redirect", () => {
    const b = assistMailBlock(need, "n1", "https://api.example.test/");
    expect(b.text).toContain("Ask Lufthansa for free wheelchair / special assistance, at least 48 hours before");
    expect(b.text).toContain("https://api.example.test/go/assist/FRA?need=n1");
    expect(b.text).toContain("third-party paid services");
    expect(b.html).toContain('href="https://api.example.test/go/assist/FRA?need=n1"');
  });

  it("email block with no airport entries is only the airline line", () => {
    const b = assistMailBlock({ origin: "XXX", layovers: [], destination: "YYY", flightNumbers: ["ZZ1"] }, "n1", "https://api.test");
    expect(b.text).toBe("Ask ZZ for free wheelchair / special assistance, at least 48 hours before the flight.");
    expect(b.html).not.toContain("go/assist");
  });
});
