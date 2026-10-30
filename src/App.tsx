import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { AboutPage } from "./pages/AboutPage";
import { AgentPage } from "./pages/AgentPage";
import { ArticlePage } from "./pages/ArticlePage";
import { ArticlesPage } from "./pages/ArticlesPage";
import { HomePage } from "./pages/HomePage";
import { HonorsPage } from "./pages/HonorsPage";
import { ManagePage } from "./pages/ManagePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { OwnerPage } from "./pages/OwnerPage";
import { ProjectDeck } from "./pages/ProjectDeck";
import { ReposPage } from "./pages/ReposPage";
import { SharesPage } from "./pages/SharesPage";
import { WorkPage } from "./pages/WorkPage";
import { WorksPage } from "./pages/WorksPage";

export default function App() {
  return (
    <BrowserRouter basename="/UserMoon">
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<HomePage />} />
          <Route path="articles" element={<ArticlesPage />} />
          <Route path="articles/:slug" element={<ArticlePage />} />
          <Route path="projects" element={<ProjectDeck />} />
          <Route path="works" element={<WorksPage />} />
          <Route path="works/:id" element={<WorkPage />} />
          <Route path="repos" element={<ReposPage />} />
          <Route path="agent" element={<AgentPage />} />
          <Route path="owner" element={<OwnerPage />} />
          <Route path="manage" element={<ManagePage />} />
          <Route path="honors" element={<HonorsPage />} />
          <Route path="shares" element={<SharesPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
