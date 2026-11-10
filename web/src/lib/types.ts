// Response and request shapes from api/ROUTES.md.

export type User = { id: string; email: string; name: string; phone: string; createdAt: string };
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
  postedBy: { firstName: string };
  mine: boolean;
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
  otherParty: { firstName: string };
  lastMessage: { body: string; at: string; mine: boolean } | null;
  helperFlightNumbers: string[];
  createdAt: string;
};

export type Conversation = ConversationSummary;

export type Message = { id: string; body: string; createdAt: string; mine: boolean };
