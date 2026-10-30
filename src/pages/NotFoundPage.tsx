import { Link } from "react-router-dom";
import { StageSheet } from "../components/StageSheet";
import { useFace } from "../hooks/useFace";

export function NotFoundPage() {
  const { face } = useFace();
  if (face === "stage") {
    return (
      <StageSheet kicker="404" title="没有这一页">
        <div className="stage-sheet__empty">
          <p>路径可能写错了，或者内容已经挪走。</p>
          <Link to="/">回首页</Link>
        </div>
      </StageSheet>
    );
  }
  return (
    <main className="inner">
      <article className="panel inner-hero">
        <p className="hello-kicker">404</p>
        <h1>没有这一页</h1>
        <p>路径可能写错了，或者内容已经挪走。</p>
        <Link className="pill-link" to="/">
          回首页
        </Link>
      </article>
    </main>
  );
}
