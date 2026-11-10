// Response and request shapes from api/ROUTES.md.

export type User = { id: string; email: string; name: string; phone: string; alertsEnabled: boolean; createdAt: string };
export type Me = { user: User };
export type AuthResponse = { accessToken: string; refreshToken: string; user: User };

/** Times are airport-local wall-clock encoded `YYYY-MM-DDTHH:mm:00Z` (the Z is not UTC). */
export type Leg = { flightNumber: string; from: string; to: string; departsAt: string; arrivesAt: string };

export type NeedStatus = "open" | "found" | "closed";

export type NeedInput = {
  travelerLabel: string;
  travelerAge?: number;
  languages: string[];
  assistance?: string;
  legs: Leg[];
  notes?: string;
};

export type NeedPatch = Partial<NeedInput> & { status?: NeedStatus };

/** A person as others see them: first name and how many families thanked them. */
export type PostedBy = { id: string; firstName: string; thanksCount: number };

export type NeedSummary = {
  id: string;
  travelerLabel: string;
  travelerAge: number | null;
  languages: string[];
  travelDate: string;
  origin: string;
  destination: string;
  layovers: string[];
  flightNumbers: string[];
  legs: Leg[];
  status: NeedStatus;
  postedBy: PostedBy;
  mine: boolean;
  /** Hidden after reports. Only ever true for the owner. */
  hidden: boolean;
  responseCount: number;
  /** Set when the viewer has reached out to this need (always null for the owner). */
  myConversationId: string | null;
  createdAt: string;
};

export type Need = NeedSummary & {
  assistance: string | null;
  notes: string | null;
};

export type ConversationSummary = {
  id: string;
  need: {
    id: string;
    travelerLabel: string;
    origin: string;
    destination: string;
    travelDate: string;
    flightNumbers: string[];
    status: NeedStatus;
  };
  role: "poster" | "helper";
  otherParty: PostedBy;
  lastMessage: { body: string; at: string; mine: boolean } | null;
  helperFlightNumbers: string[];
  thankedAt: string | null;
  thankNote: string | null;
  /** Either party has blocked the other: sending is refused. */
  blocked: boolean;
  createdAt: string;
};

export type Conversation = ConversationSummary;

export type Message = { id: string; body: string; createdAt: string; mine: boolean };

// ---- sharing ----

/** The public preview of a need (/n/:id): no age, help notes or poster name. */
export type PublicNeed = {
  id: string;
  travelerLabel: string;
  languages: string[];
  travelDate: string;
  origin: string;
  destination: string;
  layovers: string[];
  flightNumbers: string[];
  legs: Leg[];
};

// ---- "I'm flying" posts ----

export type FlightStatus = "open" | "closed";

export type FlightInput = { legs: Leg[]; languages: string[]; note?: string };
export type FlightPatch = Partial<FlightInput> & { status?: FlightStatus };

export type FlightSummary = {
  id: string;
  travelDate: string;
  origin: string;
  destination: string;
  layovers: string[];
  flightNumbers: string[];
  legs: Leg[];
  languages: string[];
  note: string | null;
  status: FlightStatus;
  postedBy: PostedBy;
  mine: boolean;
  /** Hidden after reports. Only ever true for the owner. */
  hidden: boolean;
  createdAt: string;
};
export type Flight = FlightSummary;

export type NeedMatch = NeedSummary & { matchReason: string };
export type FlightMatch = FlightSummary & { matchReason: string };

// ---- safety ----

export type ReportTarget = "need" | "flight" | "user";
export type ReportReason = "spam" | "inappropriate" | "scam" | "other";
export type BlockedUser = { userId: string; firstName: string };
