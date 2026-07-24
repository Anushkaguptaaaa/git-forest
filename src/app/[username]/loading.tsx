import { ForestGrowingLoader } from "@/components/ForestGrowingLoader";

export default function ForestRouteLoading() {
  return (
    <main className="forest-growing-page forest-bg">
      <ForestGrowingLoader label="Growing forest…" />
    </main>
  );
}
