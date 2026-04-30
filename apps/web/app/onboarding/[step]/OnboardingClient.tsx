"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3 | 4 | 5;

const TOTAL = 5;

const STEP_TITLES: Record<Step, string> = {
  1: "Chrome 拡張機能をインストール",
  2: "X (旧Twitter) と連携",
  3: "Bluesky と連携",
  4: "リラクシィー にログイン",
  5: "02 にログイン"
};

export function OnboardingClient(props: {
  step: Step;
  xConnected: boolean;
  blueskyConnected: boolean;
  xAccountName: string | null;
  blueskyAccountName: string | null;
}) {
  const { step } = props;

  return (
    <main className="mx-auto max-w-xl px-4 py-8 space-y-6">
      <Header step={step} />

      <section className="rounded border bg-white p-6 space-y-4">
        <h2 className="text-xl font-bold">
          Step {step}: {STEP_TITLES[step]}
        </h2>
        {step === 1 && <Step1 />}
        {step === 2 && (
          <Step2
            connected={props.xConnected}
            accountName={props.xAccountName}
          />
        )}
        {step === 3 && (
          <Step3
            connected={props.blueskyConnected}
            accountName={props.blueskyAccountName}
          />
        )}
        {step === 4 && <StepLoginConfirm platform="リラクシィー" />}
        {step === 5 && <StepLoginConfirm platform="02" />}
      </section>

      <Navigation step={step} />
    </main>
  );
}

// ===== ヘッダー（進捗バー） =====
function Header({ step }: { step: Step }) {
  const ratio = (step / TOTAL) * 100;
  return (
    <header className="space-y-2">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">セットアップガイド</h1>
        <span className="text-sm text-gray-600 tabular-nums">
          {step} / {TOTAL}
        </span>
      </div>
      <div className="h-2 rounded bg-gray-200 overflow-hidden">
        <div
          className="h-full bg-black transition-all"
          style={{ width: `${ratio}%` }}
        />
      </div>
    </header>
  );
}

// ===== Step1: 拡張インストール =====
function Step1() {
  const [installed, setInstalled] = useState(false);
  const [pinged, setPinged] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as
        | { source?: string; type?: string; extensionId?: string }
        | null;
      if (data?.source !== "post-integration-extension") return;
      if (data?.type === "installed" || data?.type === "pong") {
        setInstalled(true);
      }
    };
    window.addEventListener("message", handler);

    // Web → 拡張へ ping (拡張の web-bridge.ts が pong を返す)
    window.postMessage(
      { source: "post-integration-app", type: "ping_extension" },
      "*"
    );
    setPinged(true);

    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm">
        投稿時にブラウザで自動操作を行うため、Chrome 拡張機能のインストールが必要です。
      </p>
      <ol className="list-decimal pl-5 space-y-1 text-sm">
        <li>
          ブラウザで <code>chrome://extensions/</code> を開く（コピーして貼り付け）
        </li>
        <li>右上の「デベロッパーモード」を ON にする</li>
        <li>「パッケージ化されていない拡張機能を読み込む」をクリック</li>
        <li>
          開発時は{" "}
          <code>apps/extension/dist/</code>{" "}
          フォルダを選択（または配布された拡張ファイルを選択）
        </li>
      </ol>
      <p className="text-xs text-gray-600">
        拡張をインストール後、このページをリロードしてください。
      </p>

      <div
        className={`rounded p-3 text-sm ${
          installed
            ? "bg-green-50 text-green-700"
            : "bg-gray-50 text-gray-700"
        }`}
      >
        {installed
          ? "✅ 拡張機能を検知しました"
          : pinged
            ? "⏳ 拡張機能を検知中... インストール後にリロードしてください"
            : "⏳ 確認中..."}
      </div>
    </div>
  );
}

// ===== Step2: X 連携 =====
function Step2({
  connected,
  accountName
}: {
  connected: boolean;
  accountName: string | null;
}) {
  if (connected) {
    return (
      <div className="space-y-2">
        <p className="rounded bg-green-50 p-3 text-sm text-green-700">
          ✅ 連携済み: <strong>@{accountName}</strong>
        </p>
        <p className="text-xs text-gray-600">
          別のアカウントに切り替える場合は{" "}
          <Link href="/settings/connections" className="underline">
            連携設定
          </Link>
          {" "}から解除してください。
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm">
        X (旧Twitter) のアカウントと連携します。下のボタンを押すと X の認可画面が開きます。
      </p>
      <a
        href="/api/auth/x/start"
        className="inline-block rounded bg-black px-4 py-2 text-white"
      >
        Xと連携
      </a>
      <p className="text-xs text-gray-500">
        投稿のためのアクセストークンのみ取得します。パスワードは渡しません。
      </p>
    </div>
  );
}

// ===== Step3: Bluesky AppPassword =====
function Step3({
  connected,
  accountName
}: {
  connected: boolean;
  accountName: string | null;
}) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (connected) {
    return (
      <p className="rounded bg-green-50 p-3 text-sm text-green-700">
        ✅ 連携済み: <strong>@{accountName}</strong>
      </p>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/bluesky/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          app_password: appPassword.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "連携に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-gray-600">
        Bluesky アプリの Settings → Privacy and Security → App Passwords で AppPassword を発行してから入力してください。
      </p>
      <label className="block">
        <span className="text-sm">Identifier (例: alice.bsky.social)</span>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm">AppPassword</span>
        <input
          type="password"
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-sky-600 px-4 py-2 text-white disabled:bg-gray-300"
      >
        {submitting ? "確認中..." : "Blueskyと連携"}
      </button>
    </form>
  );
}

// ===== Step4 / Step5: 業界SNS ログイン確認 =====
function StepLoginConfirm({ platform }: { platform: string }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {platform} に**ブラウザでログイン**しておいてください。投稿時に拡張機能がそのセッションを使って自動投稿します。
      </p>
      <p className="text-xs text-gray-500">
        ※ 自動ログインは行いません。お手元で {platform} のサイトに通常通りログインしてください。
      </p>
      <label className="flex items-center gap-2 rounded border p-3 cursor-pointer hover:bg-gray-50">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span className="text-sm">{platform} にログインしました</span>
      </label>
      {!confirmed && (
        <p className="text-xs text-gray-500">
          スキップしても進めますが、その場合 {platform} への投稿は失敗する可能性があります。
        </p>
      )}
    </div>
  );
}

// ===== ナビゲーション（戻る / スキップ / 次へ） =====
function Navigation({ step }: { step: Step }) {
  const router = useRouter();
  const isFirst = step === 1;
  const isLast = step === TOTAL;

  function goNext() {
    if (isLast) {
      router.push("/dashboard/compose");
    } else {
      router.push(`/onboarding/${step + 1}`);
    }
  }
  function goPrev() {
    if (!isFirst) {
      router.push(`/onboarding/${step - 1}`);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={goPrev}
        disabled={isFirst}
        className="rounded border px-4 py-2 disabled:opacity-40"
      >
        戻る
      </button>
      <div className="flex gap-2">
        {!isLast && (
          <button
            type="button"
            onClick={goNext}
            className="rounded border px-4 py-2 text-sm"
          >
            スキップ
          </button>
        )}
        <button
          type="button"
          onClick={goNext}
          className="rounded bg-black px-4 py-2 text-white"
        >
          {isLast ? "完了して投稿画面へ" : "次へ"}
        </button>
      </div>
    </div>
  );
}
