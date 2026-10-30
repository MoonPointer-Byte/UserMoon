import { FormEvent, useState } from "react";
import { useOwner } from "../hooks/useOwner";

type Props = {
  title?: string;
  hint?: string;
  onUnlocked?: () => void;
};

export function OwnerGate({
  title = "需要主人密钥",
  hint = "启动 / 停止展示位会占用服务器内存，只有主人可以操作。访客仍可观看已启动的画面。",
  onUnlocked,
}: Props) {
  const { isOwner, unlock, lock } = useOwner();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  if (isOwner) {
    return (
      <p className="owner-gate owner-gate--ok">
        主人模式已开启
        <button type="button" className="ghost-btn" onClick={lock}>
          退出
        </button>
      </p>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (value.trim().length < 8) {
      setError("密钥至少 8 位");
      return;
    }
    unlock(value);
    setValue("");
    setError("");
    onUnlocked?.();
  }

  return (
    <form className="owner-gate" onSubmit={submit}>
      <strong>{title}</strong>
      <span>{hint}</span>
      <label>
        主人密钥
        <input
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="USERMOON_OWNER_TOKEN"
        />
      </label>
      <button type="submit">解锁操作</button>
      {error ? <em>{error}</em> : null}
    </form>
  );
}
