// Phase 5-4 #ops セレクタ動的取得
// background が /api/dom-selectors を定期取得して chrome.storage.local にキャッシュ。
// content script (relaxy / zero-two) は getCachedSelectors() でキャッシュから読む。
// 取得失敗時はキャッシュ使用、キャッシュもなければエラー。

export type SupportedPlatform = "relaxy" | "02";

export type SelectorMap = {
  relaxy: Record<string, string>;
  "02": Record<string, string>;
};

const STORAGE_KEY_CACHE = "dom_selectors_cache";
const STORAGE_KEY_CACHED_AT = "dom_selectors_cached_at";
const STORAGE_KEY_API_BASE_URL = "api_base_url";

const DEFAULT_API_BASE_URL = "http://localhost:3000";

type DomSelectorRow = {
  platform: string;
  field_name: string;
  selector: string;
  version: number;
};

/** /api/dom-selectors から最新セレクタを取得 → SelectorMap に整形 */
export async function fetchSelectorsFromApi(
  apiBaseUrl: string
): Promise<SelectorMap> {
  const res = await fetch(`${apiBaseUrl}/api/dom-selectors`, {
    credentials: "include"
  });
  if (!res.ok) {
    throw new Error(`fetch dom-selectors failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { selectors?: DomSelectorRow[] };
  if (!data.selectors || !Array.isArray(data.selectors)) {
    throw new Error("Invalid response format from /api/dom-selectors");
  }

  const map: SelectorMap = { relaxy: {}, "02": {} };
  for (const row of data.selectors) {
    if (row.platform === "relaxy" || row.platform === "02") {
      map[row.platform][row.field_name] = row.selector;
    }
  }
  return map;
}

/** キャッシュを保存（タイムスタンプ付き） */
export async function saveCache(map: SelectorMap): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY_CACHE]: map,
    [STORAGE_KEY_CACHED_AT]: new Date().toISOString()
  });
}

/** キャッシュを読み込み（なければ null） */
export async function loadCache(): Promise<{
  map: SelectorMap;
  cachedAt: string;
} | null> {
  const data = await chrome.storage.local.get([
    STORAGE_KEY_CACHE,
    STORAGE_KEY_CACHED_AT
  ]);
  const map = data[STORAGE_KEY_CACHE] as SelectorMap | undefined;
  const cachedAt = data[STORAGE_KEY_CACHED_AT] as string | undefined;
  if (!map || !cachedAt) return null;
  return { map, cachedAt };
}

/** content script から呼ぶ: 指定 platform のキャッシュ済セレクタ取得 */
export async function getCachedSelectors(
  platform: SupportedPlatform
): Promise<Record<string, string>> {
  const cache = await loadCache();
  if (!cache) {
    throw new Error(
      "No cached dom_selectors. Extension may have just installed; wait 1 min for first fetch or visit Web app to trigger refresh."
    );
  }
  const platformMap = cache.map[platform];
  if (!platformMap || Object.keys(platformMap).length === 0) {
    throw new Error(
      `No cached selectors for platform '${platform}' (cachedAt: ${cache.cachedAt})`
    );
  }
  return platformMap;
}

/** API ベースURL を取得（拡張が最後に通信した Web オリジン or デフォルト） */
export async function getApiBaseUrl(): Promise<string> {
  const data = await chrome.storage.local.get([STORAGE_KEY_API_BASE_URL]);
  const url = data[STORAGE_KEY_API_BASE_URL] as string | undefined;
  return url ?? DEFAULT_API_BASE_URL;
}

/** API ベースURL を更新 */
export async function setApiBaseUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_API_BASE_URL]: url });
}

/** background から呼ぶ: API 取得 → キャッシュ保存。失敗時はキャッシュを残してエラーログ */
export async function refreshSelectors(): Promise<{
  ok: boolean;
  count?: number;
  error?: string;
}> {
  const apiBaseUrl = await getApiBaseUrl();
  try {
    const map = await fetchSelectorsFromApi(apiBaseUrl);
    await saveCache(map);
    const count =
      Object.keys(map.relaxy).length + Object.keys(map["02"]).length;
    console.log(
      `[selectors] refreshed ${count} selectors from ${apiBaseUrl}`
    );
    return { ok: true, count };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[selectors] refresh failed (${apiBaseUrl}):`, msg);
    return { ok: false, error: msg };
  }
}
