import { Navigate } from "react-router-dom";

/** Legacy /manage → owner hub */
export function ManagePage() {
  return <Navigate to="/owner" replace />;
}
