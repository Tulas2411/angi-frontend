import type { MapLocation } from "@/shared/maps/mapbox";
import type {
  VerificationDocumentType,
  VerificationDto,
} from "./verification-types";

/** OWN-01/02/03/04 and MEDIA-01 wire contracts, API Design v1.8. */
/** OWN-01/02/03/04/05 and MEDIA-01 wire contracts, API Design v1.8. */
export type OperatingStatus =
  "open" | "temporarily_closed" | "permanently_closed";

export interface UpdateOperatingStatusRequestDto {
  operatingStatus: OperatingStatus;
  note?: string | null;
}

export interface UpdateOperatingStatusResponseDto {
  operatingStatus: OperatingStatus;
}

export interface BusinessHourDto {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

/** OWN-04 replaces the entire week; [] means no hours declared. */
export interface UpdateBusinessHoursRequestDto {
  hours: BusinessHourDto[];
}

export interface UpdateBusinessHoursResponseDto {
  hours: BusinessHourDto[];
  isOpenNow: boolean;
}

export interface RegisterRestaurantRequestDto {
  name: string;
  phone: string;
  addressLine: string;
  /** Required by OWN-01 (pre-merger district, from the V1 catalog). */
  district: string;
  provinceName: string;
  latitude: number;
  longitude: number;
  description?: string;
  email?: string;
  website?: string;
  ward?: string;
  priceLevel?: number;
  coverMediaId?: number;
  imageMediaIds?: number[];
  businessHours?: BusinessHourDto[];
}

export interface OwnerRestaurantDto {
  id: number;
  name: string;
  slug: string;
  coverUrl: string | null;
  addressLine: string;
  district: string | null;
  provinceName: string | null;
  latitude: number | null;
  longitude: number | null;
  priceLevel: number | null;
  ratingAvg: number;
  ratingCount: number;
  operatingStatus: OperatingStatus;
  isOpenNow: boolean;
  distanceKm: number | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  ward: string | null;
  images: string[];
  businessHours: BusinessHourDto[];
  menu: unknown | null;
  myReview: unknown | null;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  moderationStatus: "visible" | "hidden" | "suspended";
  latestVerification: VerificationDto | null;
  openMenuSubmission: { id: number; status: "draft" | "pending" } | null;
  createdAt: string;
  updatedAt: string;
}

/** Omitted fields remain unchanged; explicit null clears nullable fields. */
export interface UpdateRestaurantRequestDto {
  name?: string;
  phone?: string;
  addressLine?: string;
  district?: string | null;
  provinceName?: string;
  latitude?: number;
  longitude?: number;
  description?: string | null;
  email?: string | null;
  website?: string | null;
  ward?: string | null;
  priceLevel?: number | null;
  coverMediaId?: number | null;
  imageMediaIds?: number[];
}

export interface MediaFileDto {
  id: number;
  url: string;
  mimeType: string;
  sizeBytes: number;
  purpose: string;
  createdAt: string;
}

/** Uploaded private file metadata used only while preparing a verification. */
export interface VerificationUpload {
  key: string;
  fileName: string;
  docType: VerificationDocumentType;
  media: MediaFileDto;
}

/** OWN-07 supplies IDs/URLs only; do not invent filenames, MIME types or file sizes. */
export interface RetainedVerificationDocument {
  key: string;
  fileName: string;
  docType: VerificationDocumentType;
  media: Pick<MediaFileDto, "id" | "url">;
  retained: true;
}

export type VerificationDocumentSelection =
  VerificationUpload | RetainedVerificationDocument;

/** UI selection metadata is never spread into an owner API request. */
export type RestaurantLocation = MapLocation;

export interface RestaurantFormValues {
  name: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  addressLine: string;
  provinceName: string;
  district: string;
  ward: string;
  priceLevel: string;
}
