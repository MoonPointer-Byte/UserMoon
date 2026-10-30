import { Navigate, useParams } from "react-router-dom";
import { findProject } from "../data/projects";

/** Legacy /works/:id → unified works stage */
export function WorkPage() {
  const { id } = useParams();
  const project = findProject(id ?? null);
  if (!project) return <Navigate to="/works" replace />;
  return <Navigate to={`/works?id=${encodeURIComponent(project.id)}`} replace />;
}
