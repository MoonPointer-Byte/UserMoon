import { ClassicHome } from "./ClassicHome";
import { StageHome } from "./StageHome";
import { useFace } from "../hooks/useFace";

export function HomePage() {
  const { face, choose } = useFace();
  if (face === "classic") return <ClassicHome />;
  return <StageHome onClassic={() => choose("classic")} />;
}
