import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/workspace";
import { ComponentGallery } from "@/features/platform/component-gallery";
export default function GalleryPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY !== "true"
  )
    notFound();
  return (
    <WorkspaceShell user={null} base="/demo/guest" demo mode="demo">
      <ComponentGallery />
    </WorkspaceShell>
  );
}
