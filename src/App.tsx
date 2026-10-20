import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { AboutPage } from "./pages/AboutPage";
import { AgentPage } from "./pages/AgentPage";
import { ArticlePage } from "./pages/ArticlePage";
import { ArticlesPage } from "./pages/ArticlesPage";
import { HomePage } from "./pages/HomePage";
import { HonorsPage } from "./pages/HonorsPage";
import { ManagePage } from "./pages/ManagePage";
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
          <Route path="works" element={<WorksPage />} />
          <Route path="works/:id" element={<WorkPage />} />
          <Route path="repos" element={<ReposPage />} />
          <Route path="agent" element={<AgentPage />} />
          <Route path="manage" element={<ManagePage />} />
          <Route path="honors" element={<HonorsPage />} />
          <Route path="shares" element={<SharesPage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
