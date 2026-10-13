import type { RoleCode } from "@/features/auth/types";

/** Frontend view models. Business API DTOs remain pending API Design v1.8. */
export type DataMode = "demo" | "live";
export type Visibility = "visible" | "hidden" | "suspended";
export type Verification =
  "unverified" | "pending" | "verified" | "rejected" | "needs_changes";
export interface Restaurant {
  id: string;
  name: string;
  address: string;
  province: string;
  district: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  image: string;
  verification: Verification;
  operating: "open" | "closed";
  moderation: Visibility;
  rating: number;
  latitude: number;
  longitude: number;
  photos?: string[];
}
export interface Dish {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  kind: "water" | "dry" | "other";
  tags: string[];
  serving: boolean;
  moderation: Visibility;
}
export interface Review {
  id: string;
  restaurantId: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  reply?: string;
  moderation: Visibility;
  replyModeration?: Visibility;
}
export interface Blog {
  id: string;
  title: string;
  content: string;
  author: string;
  date: string;
  image: string;
  photos: string[];
  likes: number;
  liked: boolean;
  moderation: Visibility;
  trip?: Trip;
  comments: Comment[];
}
export interface Comment {
  id: string;
  author: string;
  text: string;
  date: string;
  moderation: Visibility;
}
export interface ItineraryItem {
  id: string;
  dishId: string;
  restaurantId: string;
  meal: string;
  time: string;
  note: string;
  feedback: "like" | "dislike" | null;
  snapshot?: { dishName: string; restaurantName: string; price: number };
}
export interface Trip {
  id: string;
  name: string;
  destination: string;
  start: string;
  end: string;
  budget: number;
  notes: string;
  readOnly: boolean;
  privacy?: "private" | "public";
  expenses?: {
    id: string;
    name: string;
    amount: number;
    category: string;
    date: string;
  }[];
  days: { date: string; items: ItineraryItem[] }[];
}
export interface Notice {
  id: string;
  title: string;
  body: string;
  date: string;
  read: boolean;
  destination?: string;
  role: RoleCode;
}
export interface Person {
  id: string;
  name: string;
  email: string;
  role: "TRAVELER" | "RESTAURANT_OWNER";
  status: "active" | "suspended" | "banned" | "pending_verification";
  suspendedUntil?: string;
  history: { action: string; reason: string; date: string; actor: string }[];
}
export type OverrideValue = "inherit" | "allow" | "deny";
export interface Permission {
  code: string;
  label: string;
  description: string;
  defaultAllowed: boolean;
  grantable: boolean;
}
export interface Moderator {
  id: string;
  name: string;
  email: string;
  active: boolean;
  created: string;
  lastLogin: string | null;
  invitation: "pending" | "accepted";
  overrides: { permission: string; effect: "allow" | "deny" }[];
}
export interface AuditEvent {
  id: string;
  actor: string;
  role: string;
  action: string;
  entity: string;
  entityId: string;
  related: string;
  date: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reason?: string;
}
export interface SyncEvent {
  id: string;
  type: string;
  entityId: string;
  status: "dead" | "pending" | "processing" | "completed";
  attempts: number;
  date: string;
  nextAttempt: string | null;
  error: string | null;
  payload: Record<string, unknown>;
}
export interface Report {
  id: string;
  target: "restaurant" | "blog";
  targetId: string;
  reporter: string;
  reason: string;
  description: string;
  status: "open" | "claimed" | "resolved" | "dismissed";
  assignee?: string;
  date: string;
  conclusion?: string;
}
export interface Submission {
  id: string;
  kind: "menu" | "verification";
  restaurantId: string;
  status:
    | "draft"
    | "pending"
    | "approved"
    | "rejected"
    | "needs_changes"
    | "cancelled";
  date: string;
  note: string;
  legalName?: string;
  license?: string;
  taxCode?: string;
  documents?: { type: string; name: string }[];
}
export interface AppData {
  ownerRestaurantId?: string;
  restaurants: Restaurant[];
  dishes: Dish[];
  menuDraft: Dish[];
  reviews: Review[];
  blogs: Blog[];
  trips: Trip[];
  notices: Notice[];
  people: Person[];
  moderators: Moderator[];
  permissions: Permission[];
  audit: AuditEvent[];
  sync: SyncEvent[];
  reports: Report[];
  submissions: Submission[];
  profile: { name: string; phone: string; avatar: string; bio?: string };
  preferences: string[];
  surveyFinished: boolean;
  hours: { day: string; open: string; close: string; closed: boolean }[];
}
export interface DataService {
  readonly mode: DataMode;
  load(): Promise<AppData>;
  save(data: AppData): Promise<AppData>;
}
