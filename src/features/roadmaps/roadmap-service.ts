import { api } from "@/shared/api/client";
import type {
  CreateRoadmapRequestDto,
  RoadmapDetailDto,
  RoadmapPageDto,
  RoadmapRouteDto,
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

export const roadmapService: RoadmapPlanService &
  RoadmapListService &
  RoadmapDetailService = {
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
};
