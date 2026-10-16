import type { MapLocation } from "@/shared/maps/mapbox";

/** OWN-01/02/03/04 and MEDIA-01 wire contracts, API Design v1.8. */
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
  district?: string | null;
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
  operatingStatus: "open" | "temporarily_closed" | "permanently_closed";
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
  latestVerification: unknown | null;
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
  ward: string;
  priceLevel: string;
}
