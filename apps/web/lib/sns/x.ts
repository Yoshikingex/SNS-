// Phase 4-1 #data X API v2 OAuth2 PKCE + 投稿
// scope: 1ユーザーが自分の X アカウントにテキスト+画像1枚を投稿できる
// 鍵管理: access_token / refresh_token は packages/shared/src/crypto.ts で AES-256-GCM 暗号化
//         して sns_accounts.encrypted_credentials に保存

import { TwitterApi } from "twitter-api-v2";
import { decrypt, encrypt } from "@posting/shared";
import { createClient } from "@/lib/supabase/server";

export const X_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "media.write",
  "offline.access"
] as const;

export type XCredentials = {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO timestamp
  scopes: string[];
  x_user_id: string;
  x_username: string;
};

function readEnvOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function getXClient(): TwitterApi {
  return new TwitterApi({
    clientId: readEnvOrThrow("X_CLIENT_ID"),
    clientSecret: readEnvOrThrow("X_CLIENT_SECRET")
  });
}

function getRedirectUri(): string {
  return readEnvOrThrow("X_REDIRECT_URI");
}

/** OAuth2 PKCE 認可 URL を生成 */
export function generateAuthLink(): {
  url: string;
  codeVerifier: string;
  state: string;
} {
  const client = getXClient();
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
    getRedirectUri(),
    { scope: [...X_SCOPES] }
  );
  return { url, codeVerifier, state };
}

/** code を access_token に交換 + me() でユーザー情報取得 */
export async function exchangeCodeForToken(params: {
  code: string;
  codeVerifier: string;
}): Promise<XCredentials> {
  const client = getXClient();
  const { client: logged, accessToken, refreshToken, expiresIn, scope } =
    await client.loginWithOAuth2({
      code: params.code,
      codeVerifier: params.codeVerifier,
      redirectUri: getRedirectUri()
    });

  if (!refreshToken) {
    throw new Error("refresh_token not received (offline.access scope missing?)");
  }

  const me = await logged.v2.me();

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scopes: scope ?? [...X_SCOPES],
    x_user_id: me.data.id,
    x_username: me.data.username
  };
}

/** 期限近い場合に refresh */
async function ensureFreshAccessToken(creds: XCredentials): Promise<XCredentials> {
  const expiresAt = new Date(creds.expires_at).getTime();
  const now = Date.now();
  if (expiresAt - now > 5 * 60 * 1000) {
    return creds;
  }

  const client = getXClient();
  const { accessToken, refreshToken, expiresIn } =
    await client.refreshOAuth2Token(creds.refresh_token);

  return {
    ...creds,
    access_token: accessToken,
    refresh_token: refreshToken ?? creds.refresh_token,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString()
  };
}

/** X API v2 /2/media/upload で画像アップロード（OAuth2 + シンプル multipart 1リクエスト） */
async function uploadImageV2(
  accessToken: string,
  imageUrl: string
): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch image: ${imgRes.status}`);
  }
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";

  // X API v2: multipart/form-data で 'media' フィールドに画像を入れて1回 POST
  // (旧 v1.1 の INIT/APPEND/FINALIZE チャンク方式は v2 では非対応)
  const fd = new FormData();
  fd.append("media", new Blob([buffer], { type: contentType }), "image");
  fd.append("media_category", "tweet_image");

  const res = await fetch("https://api.x.com/2/media/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
      // Content-Type は FormData が boundary 付きで自動設定するので明示しない
    },
    body: fd
  });
  if (!res.ok) {
    throw new Error(
      `media upload failed: ${res.status} ${await res.text()}`
    );
  }

  // レスポンス形式は揺れる: {data: {id}} or {id, media_key} or {media_id_string}
  const json = (await res.json()) as {
    data?: { id?: string; media_key?: string };
    id?: string;
    media_id_string?: string;
    media_id?: string | number;
  };
  const mediaId =
    json.data?.id ??
    json.id ??
    json.media_id_string ??
    (json.media_id !== undefined ? String(json.media_id) : undefined);
  if (!mediaId) {
    throw new Error(`media upload: id not in response: ${JSON.stringify(json)}`);
  }
  return mediaId;
}

/** 自分の X アカウントにテキスト+画像1枚を投稿する */
export async function postToX(
  userId: string,
  body: string,
  images?: { url: string }[]
): Promise<{ tweetId: string; url: string }> {
  const supabase = createClient();

  const { data: account, error } = await supabase
    .from("sns_accounts")
    .select("id, encrypted_credentials, account_name")
    .eq("user_id", userId)
    .eq("platform", "x")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`sns_accounts fetch error: ${error.message}`);
  }
  if (!account) {
    throw new Error("X account not connected");
  }

  const credsObj: XCredentials = JSON.parse(
    decrypt(account.encrypted_credentials)
  );

  const fresh = await ensureFreshAccessToken(credsObj);
  if (fresh.access_token !== credsObj.access_token) {
    await supabase
      .from("sns_accounts")
      .update({
        encrypted_credentials: encrypt(JSON.stringify(fresh))
      })
      .eq("id", account.id);
  }

  // Phase 4-1 スコープ: 画像は最初の1枚のみ
  let mediaId: string | undefined;
  if (images && images.length > 0) {
    mediaId = await uploadImageV2(fresh.access_token, images[0].url);
  }

  const client = new TwitterApi(fresh.access_token);
  const tweet = await client.v2.tweet({
    text: body,
    ...(mediaId ? { media: { media_ids: [mediaId] as [string] } } : {})
  });

  return {
    tweetId: tweet.data.id,
    url: `https://x.com/${fresh.x_username}/status/${tweet.data.id}`
  };
}
