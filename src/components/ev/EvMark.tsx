import { ExpoMark } from "@/components/site/ExpoMark";

/** The planner uses the expo mark on its dark tile. */
export function EvMark({ className }: { className?: string }) {
  return <ExpoMark className={className} tile />;
}
