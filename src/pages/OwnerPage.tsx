import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useBoard } from "../hooks/useBoard";
import { useOwner } from "../hooks/useOwner";
import { clearStoredOwnerToken, getStoredOwnerToken, ownerHeaders, setStoredOwnerToken } from "../lib/owner";
import { PROJECTS } from "../data/projects";
import { livePreviewHref } from "../components/LiveFrame";
import { findProject } from "../data/projects";

type Stats = {
  engine: string;
  mysql: string;
  mongodb: string;
  visits: number;
  notes: number;
  articles: number;
  articlesBySource: { csdn: number; github: number; local: number };
  agentRuns: number;
};

type Profiles = {
  csdn: { user: string; home: string; label: string };
  github: { owner: string; label: string };
};

type ArticleRow = {
  slug: string;
  source: string;
  title: string;
  date: string;
  fetched_at: string;
};

type Tab = "overview" | "profile" | "sources" | "stage" | "agent";

type Person = {
  name: string;
  handle: string;
  school: string;
  role: string;
  bio: string;
  github: string;
};

type Honor = {
  id: string;
  year: string;
  category: string;
  title: string;
  result: string;
  detail: string;
  url: string;
};

const HONOR_CATEGORIES = ["学业", "竞赛与奖项", "经历", "项目结果"];

function emptyHonor(): Honor {
  return { id: "", year: String(new Date().getFullYear()), category: "竞赛与奖项", title: "", result: "", detail: "", url: "" };
}

function tabFromParam(raw: string | null): Tab {
  if (raw === "sources" || raw === "stage" || raw === "agent" || raw === "overview" || raw === "profile") return raw;
  return "overview";
}

export function OwnerPage() {
  const { isOwner, unlock, lock } = useOwner();
  const [params, setParams] = useSearchParams();
  const [unlocked, setUnlocked] = useState(() => Boolean(getStoredOwnerToken()));
  const [tokenInput, setTokenInput] = useState("");
  const [ownerConfigured, setOwnerConfigured] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>(() => tabFromParam(params.get("tab")));
  const [stats, setStats] = useState<Stats | null>(null);
  const [profiles, setProfiles] = useState<Profiles | null>(null);
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [csdnUser, setCsdnUser] = useState("");
  const [githubOwner, setGithubOwner] = useState("MoonPointer-Byte");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [agentInfo, setAgentInfo] = useState<{
    configured: boolean;
    model: string;
    baseUrl?: string;
    keyMasked?: string;
  } | null>(null);
  const [agentKey, setAgentKey] = useState("");
  const [agentBaseUrl, setAgentBaseUrl] = useState("https://api.deepseek.com/v1");
  const [agentModel, setAgentModel] = useState("deepseek-chat");
  const [person, setPerson] = useState<Person>({
    name: "",
    handle: "",
    school: "",
    role: "",
    bio: "",
    github: "",
  });
  const [honors, setHonors] = useState<Honor[]>([]);
  const { board, pending, stop, refresh } = useBoard();
  const active = findProject(board.activeId);

  useEffect(() => {
    setTab(tabFromParam(params.get("tab")));
  }, [params]);

  function switchTab(next: Tab) {
    setTab(next);
    setParams(
      (prev) => {
        const copy = new URLSearchParams(prev);
        if (next === "overview") copy.delete("tab");
        else copy.set("tab", next);
        return copy;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    void fetch("/api/manage/status")
      .then((res) => res.json())
      .then((data: { ownerConfigured?: boolean }) => setOwnerConfigured(Boolean(data.ownerConfigured)))
      .catch(() => setOwnerConfigured(null));
  }, []);

  async function load() {
    const [statsRes, articlesRes, agentRes, profileRes, honorRes] = await Promise.all([
      fetch("/api/manage/stats", { headers: ownerHeaders() }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "无权读取");
        return json;
      }),
      fetch("/api/manage/articles", { headers: ownerHeaders() }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "无权读取");
        return json;
      }),
      fetch("/api/manage/settings/agent", { headers: ownerHeaders() }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "无权读取 Agent 配置");
        return json;
      }),
      fetch("/api/profile").then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "无法读取档案");
        return json;
      }),
      fetch("/api/achievements").then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "无法读取成就");
        return json;
      }),
    ]);
    setStats(statsRes.stats ?? null);
    setProfiles(statsRes.profiles ?? null);
    setArticles(articlesRes.articles ?? []);
    setCsdnUser(statsRes.profiles?.csdn?.user || "");
    setGithubOwner(statsRes.profiles?.github?.owner || "MoonPointer-Byte");
    setAgentInfo({
      configured: Boolean(agentRes.configured),
      model: String(agentRes.model || ""),
      baseUrl: String(agentRes.baseUrl || ""),
      keyMasked: String(agentRes.keyMasked || ""),
    });
    setAgentBaseUrl(String(agentRes.baseUrl || "https://api.deepseek.com/v1"));
    setAgentModel(String(agentRes.model || "deepseek-chat"));
    setAgentKey("");
    const profile = profileRes.profile as Person | undefined;
    if (profile) setPerson(profile);
    setHonors(Array.isArray(honorRes.achievements) ? honorRes.achievements : []);
  }

  useEffect(() => {
    if (!unlocked) return;
    void load().catch((error: unknown) => {
      clearStoredOwnerToken();
      lock();
      setUnlocked(false);
      setMessage(error instanceof Error ? error.message : "无法读取");
    });
  }, [unlocked]);

  async function doUnlock(event: FormEvent) {
    event.preventDefault();
    const token = tokenInput.trim();
    if (token.length < 8) {
      setMessage("密钥至少 8 位");
      return;
    }
    setBusy(true);
    setMessage("");
    setStoredOwnerToken(token);
    unlock(token);
    try {
      const res = await fetch("/api/manage/stats", { headers: ownerHeaders() });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "密钥不对");
      setUnlocked(true);
      setTokenInput("");
    } catch (error) {
      clearStoredOwnerToken();
      lock();
      setUnlocked(false);
      setMessage(error instanceof Error ? error.message : "解锁失败");
    } finally {
      setBusy(false);
    }
  }

  function doLock() {
    clearStoredOwnerToken();
    lock();
    setUnlocked(false);
    setStats(null);
    setMessage("已退出主人模式");
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("正在保存档案…");
    try {
      const profileRes = await fetch("/api/manage/profile", {
        method: "POST",
        headers: ownerHeaders(),
        body: JSON.stringify(person),
      });
      const profileJson = (await profileRes.json()) as { error?: string; profile?: Person };
      if (!profileRes.ok) throw new Error(profileJson.error || "档案保存失败");
      const honorRes = await fetch("/api/manage/achievements", {
        method: "POST",
        headers: ownerHeaders(),
        body: JSON.stringify({ achievements: honors }),
      });
      const honorJson = (await honorRes.json()) as { error?: string; achievements?: Honor[] };
      if (!honorRes.ok) throw new Error(honorJson.error || "成就保存失败");
      if (profileJson.profile) setPerson(profileJson.profile);
      setHonors(honorJson.achievements ?? []);
      setMessage("档案已更新，关于页会立刻用新的内容。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveAgent(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("正在保存 Agent…");
    try {
      const data = await fetch("/api/manage/settings/agent", {
        method: "POST",
        headers: ownerHeaders(),
        body: JSON.stringify({
          apiKey: agentKey.trim() || undefined,
          baseUrl: agentBaseUrl.trim(),
          model: agentModel.trim(),
        }),
      }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "保存失败");
        return json as {
          settings?: { configured: boolean; model: string; baseUrl?: string; keyMasked?: string };
        };
      });
      if (data.settings) {
        setAgentInfo(data.settings);
        setAgentBaseUrl(data.settings.baseUrl || agentBaseUrl);
        setAgentModel(data.settings.model || agentModel);
      }
      setAgentKey("");
      setMessage("Agent 配置已保存，访客可直接对话");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function clearAgentKey() {
    setBusy(true);
    setMessage("正在清除密钥…");
    try {
      const data = await fetch("/api/manage/settings/agent", {
        method: "POST",
        headers: ownerHeaders(),
        body: JSON.stringify({ clearKey: true, baseUrl: agentBaseUrl.trim(), model: agentModel.trim() }),
      }).then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "清除失败");
        return json as {
          settings?: { configured: boolean; model: string; baseUrl?: string; keyMasked?: string };
        };
      });
      if (data.settings) setAgentInfo(data.settings);
      setAgentKey("");
      setMessage("已清除 API Key，将回落到站内搜索");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "清除失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("正在保存…");
    try {
      const data = await fetch("/api/manage/settings/articles", {
        method: "POST",
        headers: ownerHeaders(),
        body: JSON.stringify({
          csdnUser: csdnUser.trim(),
          csdnHome: csdnUser.trim() ? `https://blog.csdn.net/${csdnUser.trim()}` : "",
          githubOwner: githubOwner.trim() || "MoonPointer-Byte",
          syncReadmes: true,
        }),
      }).then(async (res) => {
        const json = (await res.json()) as { error?: string; count?: number };
        if (!res.ok) throw new Error(json.error || "保存失败");
        return json;
      });
      setMessage(`已保存。远程文章约 ${data.count ?? 0} 篇。`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  if (!unlocked || !isOwner) {
    return (
      <main className="owner">
        <header className="owner__hero">
          <p>Private</p>
          <h1>主人台</h1>
          <span>启停展示、绑源、配置 Agent API Key、数据台都从这里进。</span>
        </header>
        <article className="owner__card owner__gate">
          <h2>用密钥进入</h2>
          {ownerConfigured === false ? (
            <p className="owner__hint">
              服务器未配置 <code>USERMOON_OWNER_TOKEN</code>，请在 `.env` 设置后重启。
            </p>
          ) : (
            <form className="owner__form" onSubmit={(event) => void doUnlock(event)}>
              <label>
                主人密钥
                <input
                  type="password"
                  autoComplete="current-password"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  placeholder="USERMOON_OWNER_TOKEN"
                />
              </label>
              <button type="submit" disabled={busy}>
                {busy ? "校验中…" : "进入"}
              </button>
            </form>
          )}
          {message ? <em className="owner__msg">{message}</em> : null}
        </article>
      </main>
    );
  }

  return (
    <main className="owner">
      <header className="owner__hero">
        <div>
          <p>Owner hub</p>
          <h1>主人台</h1>
        </div>
        <button type="button" className="ghost-btn" onClick={doLock}>
          退出
        </button>
      </header>

      <nav className="owner__tabs" aria-label="主人功能">
        {(
          [
            ["overview", "总览"],
            ["profile", "档案"],
            ["stage", "展示位"],
            ["sources", "文章源"],
            ["agent", "Agent"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "is-on" : undefined} onClick={() => switchTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {message ? <p className="owner__msg">{message}</p> : null}

      {tab === "overview" ? (
        <section className="owner__grid">
          <article className="owner__card">
            <h2>快捷入口</h2>
            <div className="owner__links">
              <Link to="/works">作品舞台（启停）</Link>
              <Link to="/agent">打开 Agent</Link>
              <Link to="/about">关于页</Link>
              <button type="button" onClick={() => switchTab("sources")}>
                绑定 CSDN / GitHub
              </button>
              <button type="button" onClick={() => switchTab("agent")}>
                配置 Agent Key
              </button>
            </div>
          </article>
          <article className="owner__card">
            <h2>库概况</h2>
            {stats ? (
              <ul className="owner__stats">
                <li>
                  <strong>访问</strong>
                  <em>{stats.visits}</em>
                </li>
                <li>
                  <strong>留言</strong>
                  <em>{stats.notes}</em>
                </li>
                <li>
                  <strong>文章</strong>
                  <em>
                    {stats.articles}（CSDN {stats.articlesBySource.csdn} / GH {stats.articlesBySource.github}）
                  </em>
                </li>
                <li>
                  <strong>Agent</strong>
                  <em>{stats.agentRuns}</em>
                </li>
                <li>
                  <strong>MySQL</strong>
                  <em>{stats.mysql}</em>
                </li>
              </ul>
            ) : (
              <p>读取中…</p>
            )}
          </article>
        </section>
      ) : null}

      {tab === "profile" ? (
        <section className="owner__grid">
          <article className="owner__card">
            <h2>个人信息</h2>
            <form className="owner__form" onSubmit={(event) => void saveProfile(event)}>
              <label>
                名字
                <input value={person.name} onChange={(event) => setPerson({ ...person, name: event.target.value })} />
              </label>
              <label>
                GitHub 名
                <input value={person.handle} onChange={(event) => setPerson({ ...person, handle: event.target.value })} />
              </label>
              <label>
                方向
                <input value={person.role} onChange={(event) => setPerson({ ...person, role: event.target.value })} />
              </label>
              <label>
                学校
                <input value={person.school} onChange={(event) => setPerson({ ...person, school: event.target.value })} />
              </label>
              <label>
                简介
                <textarea value={person.bio} onChange={(event) => setPerson({ ...person, bio: event.target.value })} />
              </label>
              <label>
                GitHub 链接
                <input value={person.github} onChange={(event) => setPerson({ ...person, github: event.target.value })} />
              </label>
              <div className="owner__links">
                <button type="submit" disabled={busy}>
                  {busy ? "保存中…" : "保存档案"}
                </button>
                <Link to="/about">打开关于页</Link>
              </div>
            </form>
          </article>
          <article className="owner__card">
            <h2>成就</h2>
            <div className="owner__rows">
              {honors.map((item, index) => (
                <div key={`${item.id}-${index}`} className="owner__honor">
                  <input
                    value={item.year}
                    aria-label="年份"
                    onChange={(event) =>
                      setHonors(honors.map((row, rowIndex) => (rowIndex === index ? { ...row, year: event.target.value } : row)))
                    }
                  />
                  <select
                    value={item.category}
                    aria-label="分类"
                    onChange={(event) =>
                      setHonors(honors.map((row, rowIndex) => (rowIndex === index ? { ...row, category: event.target.value } : row)))
                    }
                  >
                    {HONOR_CATEGORIES.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                  <input
                    value={item.title}
                    aria-label="标题"
                    placeholder="标题"
                    onChange={(event) =>
                      setHonors(honors.map((row, rowIndex) => (rowIndex === index ? { ...row, title: event.target.value } : row)))
                    }
                  />
                  <input
                    value={item.result}
                    aria-label="结果"
                    placeholder="银奖"
                    onChange={(event) =>
                      setHonors(honors.map((row, rowIndex) => (rowIndex === index ? { ...row, result: event.target.value } : row)))
                    }
                  />
                  <input
                    value={item.detail}
                    aria-label="补充"
                    placeholder="补充"
                    onChange={(event) =>
                      setHonors(honors.map((row, rowIndex) => (rowIndex === index ? { ...row, detail: event.target.value } : row)))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setHonors(honors.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
            <div className="owner__links">
              <button type="button" onClick={() => setHonors([...honors, emptyHonor()])}>
                添加一条
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {tab === "stage" ? (
        <section className="owner__card">
          <h2>展示位</h2>
          <p className="owner__hint">
            状态：{board.status}
            {active ? ` · ${active.name}` : " · 空闲"}
            {board.message ? ` · ${board.message}` : ""}
          </p>
          <div className="owner__links">
            <Link to={active ? `/works?id=${active.id}` : "/works"}>去作品舞台操作</Link>
            <button type="button" disabled={pending || board.status === "idle"} onClick={() => void stop("主人")}>
              立即停止
            </button>
            <button type="button" onClick={() => void refresh()}>
              刷新状态
            </button>
            {board.status === "running" && active ? (
              <a href={livePreviewHref(board, active)} target="_blank" rel="noreferrer">
                新窗口预览
              </a>
            ) : null}
          </div>
          <p className="owner__hint">可运行：{PROJECTS.filter((item) => item.launch).map((item) => item.name).join("、")}</p>
        </section>
      ) : null}

      {tab === "sources" ? (
        <section className="owner__grid">
          <article className="owner__card">
            <h2>绑定远程源</h2>
            <form className="owner__form" onSubmit={(event) => void saveSettings(event)}>
              <label>
                CSDN 用户名
                <input value={csdnUser} onChange={(event) => setCsdnUser(event.target.value)} />
              </label>
              <label>
                GitHub 所有者
                <input value={githubOwner} onChange={(event) => setGithubOwner(event.target.value)} />
              </label>
              <button type="submit" disabled={busy}>
                {busy ? "处理中…" : "保存并拉取"}
              </button>
              {profiles?.csdn.home ? (
                <a href={profiles.csdn.home} target="_blank" rel="noreferrer">
                  打开 CSDN
                </a>
              ) : null}
            </form>
          </article>
          <article className="owner__card">
            <h2>已入库文章</h2>
            <div className="owner__rows">
              {articles.length === 0 ? <p>还没有远程文章。</p> : null}
              {articles.slice(0, 40).map((item) => (
                <div key={item.slug} className="owner__row">
                  <span>{item.source}</span>
                  <strong>{item.title}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {tab === "agent" ? (
        <section className="owner__card">
          <h2>Agent API</h2>
          <p className="owner__hint">
            对话页对所有人开放；只有你能改密钥。未配置时访客仍可用站内搜索兜底。
            {agentInfo?.configured ? ` 当前已接 · ${agentInfo.model}${agentInfo.keyMasked ? ` · ${agentInfo.keyMasked}` : ""}` : " 当前未配置 Key。"}
          </p>
          <form className="owner__form" onSubmit={(event) => void saveAgent(event)}>
            <label>
              API Key{agentInfo?.keyMasked ? `（留空保留 ${agentInfo.keyMasked}）` : ""}
              <input
                type="password"
                autoComplete="off"
                value={agentKey}
                onChange={(event) => setAgentKey(event.target.value)}
                placeholder="sk-…"
              />
            </label>
            <label>
              Base URL
              <input value={agentBaseUrl} onChange={(event) => setAgentBaseUrl(event.target.value)} />
            </label>
            <label>
              Model
              <input value={agentModel} onChange={(event) => setAgentModel(event.target.value)} />
            </label>
            <div className="owner__links">
              <button type="submit" disabled={busy}>
                {busy ? "保存中…" : "保存"}
              </button>
              <button type="button" disabled={busy || !agentInfo?.configured} onClick={() => void clearAgentKey()}>
                清除 Key
              </button>
              <Link to="/agent">打开对话台</Link>
            </div>
          </form>
        </section>
      ) : null}
    </main>
  );
}
