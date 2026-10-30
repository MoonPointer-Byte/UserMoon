import { Navigate, useSearchParams } from "react-router-dom";

/** Legacy /repos → unified /works */
export function ReposPage() {
  const [params] = useSearchParams();
  const run = params.get("run");
  const pick = params.get("pick");
  const id = run || pick;
  const qs = new URLSearchParams();
  if (id) qs.set("id", id);
  if (run) qs.set("run", run);
  const suffix = qs.toString();
  return <Navigate to={suffix ? `/works?${suffix}` : "/works"} replace />;
}
