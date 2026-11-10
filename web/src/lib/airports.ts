// City names for the airports families fly most, for friendlier share text
// and previews ("Delhi → Chicago"). Anything not listed shows its IATA code.

const CITIES: Record<string, string> = {
  DEL: "Delhi",
  BOM: "Mumbai",
  BLR: "Bengaluru",
  HYD: "Hyderabad",
  MAA: "Chennai",
  AMD: "Ahmedabad",
  COK: "Kochi",
  ATQ: "Amritsar",
  CCU: "Kolkata",
  ORD: "Chicago",
  JFK: "New York",
  EWR: "Newark",
  SFO: "San Francisco",
  IAD: "Washington",
  DFW: "Dallas",
  IAH: "Houston",
  ATL: "Atlanta",
  SEA: "Seattle",
  BOS: "Boston",
  LAX: "Los Angeles",
  YYZ: "Toronto",
  YVR: "Vancouver",
  LHR: "London",
  FRA: "Frankfurt",
  DXB: "Dubai",
  DOH: "Doha",
  AUH: "Abu Dhabi",
  MUC: "Munich",
  CDG: "Paris",
  AMS: "Amsterdam",
  IST: "Istanbul",
  SIN: "Singapore",
};

/** "DEL" → "Delhi"; unknown codes come back unchanged. */
export const city = (code: string) => CITIES[code] ?? code;

/** "Delhi → Chicago" (end points only; layovers are in the flight list). */
export const cityRoute = (origin: string, destination: string) => `${city(origin)} → ${city(destination)}`;
