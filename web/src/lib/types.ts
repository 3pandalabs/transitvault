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
  /** Paid help: the owner's accepted helper (null for others, or if none). */
  acceptedHelper: { conversationId: string; status: AcceptanceStatus; firstName: string } | null;
  createdAt: string;
};

export type Need = NeedSummary & {
  assistance: string | null;
  notes: string | null;
  airportHelp: AirportHelp;
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
  /** `deleted`: they deleted their account; shown as "Deleted user", sending is refused. */
  otherParty: PostedBy & { deleted: boolean };
  lastMessage: { body: string; at: string; mine: boolean } | null;
  helperFlightNumbers: string[];
  thankedAt: string | null;
  thankNote: string | null;
  /** Either party has blocked the other: sending is refused. */
  blocked: boolean;
  /** Paid help: the helper is helping for free (no thank-you credit). */
  rewardDeclined: boolean;
  /** Paid help: this conversation's helper was accepted (null otherwise). */
  acceptance: Acceptance | null;
  /** The need already has an accepted helper (this one or another). */
  needHasHelper: boolean;
  createdAt: string;
};

export type Conversation = ConversationSummary;

// ---- paid help ----

export type AcceptanceStatus = "pending_payment" | "confirmed" | "cancelled";

export type Acceptance = {
  id: string;
  status: AcceptanceStatus;
  feeCents: number;
  /** Poster only (null for the helper). */
  creditAppliedCents: number | null;
  cashCents: number | null;
  checkoutUrl: string | null;
  confirmedAt: string | null;
  landsAt: string | null;
  feedbackDueAt: string | null;
  canAnswer: boolean;
  outcome: "helped" | "no_show" | null;
  outcomeAt: string | null;
  rewardDeclined: boolean;
  rewardReleasedAt: string | null;
  rewardCreditedCents: number;
  refundedAt: string | null;
};

export type PaymentsConfig = { enabled: boolean; feeCents: number; rewardCents: number; currency: string };

export type CreditReason = "helper_reward" | "fee_applied" | "fee_restored" | "no_show_refund" | "card_refund" | "account_deleted";

/** api/ROUTES.md "Account deletion". */
export type DeletionBlocker = {
  kind: "pending_payment" | "trip_unresolved";
  role: "poster" | "helper";
  conversationId: string;
  needId: string;
  origin: string;
  destination: string;
  travelDate: string;
};
export type DeletionPreflight = { canDelete: boolean; blockers: DeletionBlocker[]; creditCents: number };

export type ContactTopic = "general" | "safety" | "payments" | "delete_data" | "other";
export type Credits = {
  balanceCents: number;
  entries: { id: string; amountCents: number; reason: CreditReason; needId: string | null; createdAt: string }[];
};

export type FeedbackView = {
  helperFirstName: string;
  travelerLabel: string;
  origin: string;
  destination: string;
  travelDate: string;
  outcome: "helped" | "no_show" | null;
  conversationId: string;
};

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
  airportHelp: AirportHelp;
};

// ---- official airport assistance (api/ROUTES.md "Airport assistance") ----

export type AirportAssist = {
  iata: string;
  role: "origin" | "layover" | "destination";
  airport: string;
  provider: string;
  operator: string;
  /** "run by the airport", "approved by Heathrow", … */
  authority: string;
  covers: ("departure" | "arrival" | "transit")[];
  priceNote: string;
  /** Path on the API host: logs the click, then redirects to the provider. */
  bookPath: string;
};

export type AirportHelp = { airports: AirportAssist[]; airlines: { code: string; name: string | null }[] };

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
