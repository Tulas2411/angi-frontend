import { redirect } from "next/navigation";
import { roadmapRoutes } from "@/features/roadmaps/routes";

/**
 * F-19 has no page of its own any more: "Lập lộ trình mới" is a dialog over "Lộ trình của tôi".
 * Old links and bookmarks to `/roadmaps/new` open that dialog.
 */
export default function Page() {
  redirect(roadmapRoutes.plan);
}
