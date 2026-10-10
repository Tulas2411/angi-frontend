import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { scenarios, scenarioSeed } from "@/mocks/scenarios";
import { demoUsers } from "@/mocks/fixtures";
import { WorkspaceShell } from "@/components/layout/workspace";
import { PageRouter } from "@/features/platform/page-router";
import { Skeleton } from "@/components/ui/primitives";
const slugs = {
  TRAVELER: "traveler",
  RESTAURANT_OWNER: "owner",
  MOD: "moderator",
  ADMIN: "admin",
};
export default async function ScenarioPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY !== "true"
  )
    notFound();
  const { state = "traveler-empty-trips" } = await searchParams,
    scenario = scenarios[state];
  if (!scenario) notFound();
  return (
    <>
      <aside className="dev-scenario-controls">
        <details>
          <summary>Trạng thái phát triển · {scenario.label}</summary>
          <nav className="actions">
            {Object.entries(scenarios).map(([key, value]) => (
              <Link href={`/dev/scenarios?state=${key}`} key={key}>
                {value.label}
              </Link>
            ))}
          </nav>
        </details>
      </aside>
      <WorkspaceShell
        key={state}
        user={demoUsers[scenario.role]}
        base={`/demo/${slugs[scenario.role]}`}
        demo
        mode="demo"
        seed={scenarioSeed(state)}
      >
        <Suspense fallback={<Skeleton />}>
          <PageRouter role={scenario.role} segments={scenario.segments} />
        </Suspense>
      </WorkspaceShell>
    </>
  );
}
