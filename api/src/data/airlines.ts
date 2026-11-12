// Airline names for the "ask the airline for free wheelchair / special
// assistance" line, keyed by the flight number's two-character IATA prefix.
// The airlines families fly most on India ↔ North America/Europe/Gulf routes;
// an unknown prefix shows as its code.

export const AIRLINES: Record<string, string> = {
  AI: "Air India",
  "6E": "IndiGo",
  UK: "Vistara",
  IX: "Air India Express",
  SG: "SpiceJet",
  QP: "Akasa Air",
  LH: "Lufthansa",
  LX: "SWISS",
  OS: "Austrian",
  BA: "British Airways",
  VS: "Virgin Atlantic",
  AF: "Air France",
  KL: "KLM",
  EK: "Emirates",
  EY: "Etihad",
  QR: "Qatar Airways",
  FZ: "flydubai",
  TK: "Turkish Airlines",
  SQ: "Singapore Airlines",
  UA: "United",
  AA: "American Airlines",
  DL: "Delta",
  AC: "Air Canada",
  WS: "WestJet",
  AS: "Alaska Airlines",
  B6: "JetBlue",
  VN: "Vietnam Airlines",
  CX: "Cathay Pacific",
  SV: "Saudia",
  GF: "Gulf Air",
  WY: "Oman Air",
  KU: "Kuwait Airways",
};
