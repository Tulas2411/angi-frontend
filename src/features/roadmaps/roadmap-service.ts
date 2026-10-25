import { api } from "@/shared/api/client";
import { suggestionsQueryString } from "./roadmap-add-item-rules";
import type {
  AddRoadmapItemRequestDto,
  CreateRoadmapRequestDto,
  RoadmapDetailDto,
  RoadmapItemDto,
  RoadmapPageDto,
  RoadmapRouteDto,
  RoadmapSuggestionsDto,
  RoadmapSuggestionsQuery,
  UpdateRoadmapRequestDto,
} from "./roadmap-types";

export interface RoadmapPlanService {
  /** RM-01: 201 Created with the new RoadmapDetail. */
  create: (request: CreateRoadmapRequestDto) => Promise<RoadmapDetailDto>;
  /** RM-04: 200 OK with the updated RoadmapDetail. */
  update: (
    roadmapId: number,
    request: UpdateRoadmapRequestDto,
  ) => Promise<RoadmapDetailDto>;
}

export interface RoadmapListService {
  /** RM-02: one page of the caller's roadmaps, newest first. `page` starts at 1. */
  list: (page: number, pageSize: number) => Promise<RoadmapPageDto>;
}

export interface RoadmapDetailService {
  /** RM-03: overview, itinerary and budget of one of the caller's roadmaps. */
  get: (roadmapId: number) => Promise<RoadmapDetailDto>;
  /**
   * RM-14: the legs of one day. `gpsOrigin` is only for roadmaps with `originMode = gps`:
   * both coordinates go together on each call and the backend never stores them.
   */
  dayRoute: (
    roadmapId: number,
    dayId: number,
    gpsOrigin?: { latitude: number; longitude: number },
  ) => Promise<RoadmapRouteDto>;
}

export interface RoadmapItemService {
  /** RM-06: ranked dishes for a meal that are not in the roadmap yet; `cursor` pages the list. */
  suggestions: (
    roadmapId: number,
    query: RoadmapSuggestionsQuery,
  ) => Promise<RoadmapSuggestionsDto>;
  /** RM-07: 201 Created with the new RoadmapItem. */
  addItem: (
    roadmapId: number,
    dayId: number,
    request: AddRoadmapItemRequestDto,
  ) => Promise<RoadmapItemDto>;
  /** RM-09: 200 OK with `data: null`; the item is gone for good, other items are untouched. */
  deleteItem: (roadmapId: number, itemId: number) => Promise<void>;
}

/** Everything the roadmap detail screen calls: RM-03, RM-14, RM-06, RM-07 and RM-09. */
export type RoadmapScreenService = RoadmapDetailService & RoadmapItemService;

export const roadmapService: RoadmapPlanService &
  RoadmapListService &
  RoadmapDetailService &
  RoadmapItemService = {
  create: (request) => api.post<RoadmapDetailDto>("roadmaps", request),
  update: (roadmapId, request) =>
    api.patch<RoadmapDetailDto>(`roadmaps/${roadmapId}`, request),
  list: (page, pageSize) =>
    api.get<RoadmapPageDto>(`roadmaps?page=${page}&pageSize=${pageSize}`),
  get: (roadmapId) => api.get<RoadmapDetailDto>(`roadmaps/${roadmapId}`),
  dayRoute: (roadmapId, dayId, gpsOrigin) => {
    const query = gpsOrigin
      ? `?originLat=${gpsOrigin.latitude}&originLng=${gpsOrigin.longitude}`
      : "";
    return api.get<RoadmapRouteDto>(
      `roadmaps/${roadmapId}/days/${dayId}/route${query}`,
    );
  },
  suggestions: (roadmapId, query) =>
    api.get<RoadmapSuggestionsDto>(
      `roadmaps/${roadmapId}/suggestions?${suggestionsQueryString(query)}`,
    ),
  addItem: (roadmapId, dayId, request) =>
    api.post<RoadmapItemDto>(
      `roadmaps/${roadmapId}/days/${dayId}/items`,
      request,
    ),
  deleteItem: async (roadmapId, itemId) => {
    await api.delete<null>(`roadmaps/${roadmapId}/items/${itemId}`);
  },
};
