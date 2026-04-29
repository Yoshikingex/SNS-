// Phase 4-2 #data Bluesky AppPassword + 投稿
// scope: 1ユーザーが自分の Bluesky アカウントにテキスト+画像1枚（最大4枚）を投稿
// 認証: AppPassword（ユーザーが Bluesky で発行 → 手動入力）
// セッション: 保存しない、postToBluesky 内で都度ログイン
// 文字数: 300 grapheme（emoji や日本語含む実描画文字単位）

import { AppBskyEmbedImages, BskyAgent } from "@atproto/api";
import Graphemer from "graphemer";
import { decrypt, encrypt } from "@posting/shared";
import { createClient } from "@/lib/supabase/server";

export const BLUESKY_SERVICE = "https://bsky.social";
export const BLUESKY_MAX_GRAPHEMES = 300;
export const BLUESKY_MAX_IMAGES = 4;

export type BlueskyCredentials = {
  identifier: string; // 例: alice.bsky.social or DID
  app_password: string; // ユーザー手動入力の AppPassword
};

/** 復号した creds で Bluesky にログインしてエージェントを返す */
export async function loginToBluesky(
  creds: BlueskyCredentials
): Promise<BskyAgent> {
  const agent = new BskyAgent({ service: BLUESKY_SERVICE });
  await agent.login({
    identifier: creds.identifier,
    password: creds.app_password
  });
  return agent;
}

/** grapheme 単位での文字数 */
export function countGraphemes(text: string): number {
  return new Graphemer().countGraphemes(text);
}

/** Bluesky に投稿する（テキスト + 任意で画像最大4枚） */
export async function postToBluesky(
  userId: string,
  body: string,
  images?: { url: string }[]
): Promise<{ uri: string; cid: string; webUrl: string }> {
  const length = countGraphemes(body);
  if (length > BLUESKY_MAX_GRAPHEMES) {
    throw new Error(
      `Bluesky text exceeds ${BLUESKY_MAX_GRAPHEMES} graphemes (got ${length})`
    );
  }

  const supabase = createClient();
  const { data: account, error } = await supabase
    .from("sns_accounts")
    .select("id, encrypted_credentials, account_name")
    .eq("user_id", userId)
    .eq("platform", "bluesky")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`sns_accounts fetch error: ${error.message}`);
  }
  if (!account) {
    throw new Error("Bluesky account not connected");
  }

  const creds: BlueskyCredentials = JSON.parse(
    decrypt(account.encrypted_credentials)
  );

  const agent = await loginToBluesky(creds);

  // 画像アップロード（最大4枚）
  let embed: AppBskyEmbedImages.Main | undefined;
  if (images && images.length > 0) {
    const limitedImages = images.slice(0, BLUESKY_MAX_IMAGES);
    const uploads: AppBskyEmbedImages.Image[] = await Promise.all(
      limitedImages.map(async (img) => {
        const res = await fetch(img.url);
        if (!res.ok) {
          throw new Error(`Failed to fetch image: ${res.status}`);
        }
        const buffer = new Uint8Array(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") ?? "image/jpeg";
        const upload = await agent.uploadBlob(buffer, {
          encoding: contentType
        });
        return {
          alt: "",
          image: upload.data.blob
        };
      })
    );
    embed = {
      $type: "app.bsky.embed.images",
      images: uploads
    };
  }

  const post = await agent.post({
    text: body,
    ...(embed ? { embed } : {})
  });

  // session 情報の最新化（agent.session.handle が変わる場合に対応）
  const handle = agent.session?.handle ?? creds.identifier;
  if (handle !== account.account_name) {
    await supabase
      .from("sns_accounts")
      .update({ account_name: handle })
      .eq("id", account.id);
  }

  // app password を持ち続けるので encrypted_credentials の中身は変更しない
  // （session の re-issue は都度ログインのため不要）

  const rkey = post.uri.split("/").pop() ?? "";
  const webUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;

  return {
    uri: post.uri,
    cid: post.cid,
    webUrl
  };
}

/**
 * AppPassword の検証 + sns_accounts への保存（or 上書き）
 * connect ルートから呼ぶ
 */
export async function saveBlueskyCredentials(
  userId: string,
  identifier: string,
  appPassword: string
): Promise<{ handle: string }> {
  const agent = new BskyAgent({ service: BLUESKY_SERVICE });
  await agent.login({ identifier, password: appPassword });

  const handle = agent.session?.handle ?? identifier;

  const creds: BlueskyCredentials = {
    identifier,
    app_password: appPassword
  };
  const encrypted = encrypt(JSON.stringify(creds));

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("sns_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("platform", "bluesky")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("sns_accounts")
      .update({
        account_name: handle,
        encrypted_credentials: encrypted,
        is_active: true
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("sns_accounts").insert({
      user_id: userId,
      platform: "bluesky",
      account_name: handle,
      encrypted_credentials: encrypted,
      is_active: true
    });
    if (error) throw new Error(error.message);
  }

  return { handle };
}
