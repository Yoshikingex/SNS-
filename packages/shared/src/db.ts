// Phase 3-1 #data
// 手書き型定義（雛形）。Supabase CLI で上書き可能：
//   pnpm dlx supabase gen types typescript \
//     --project-id pfdjajckhvnxgetcmieh \
//     > packages/shared/src/db.ts
// 詳細は README の「TypeScript 型自動生成」セクション参照。

export type Platform = "x" | "bluesky" | "relaxy" | "02";
export type PostStatus = "pending" | "success" | "failed";

export type ImageItem = {
  url: string;
  width: number;
  height: number;
};

// ---- Row 型（SELECT 戻り値） ----

export type UserRow = {
  id: string;
  email: string;
  plan: string;
  created_at: string;
};

export type PostRow = {
  id: string;
  user_id: string;
  body_common: string;
  images: ImageItem[];
  status: PostStatus;
  created_at: string;
};

export type PostTargetRow = {
  id: string;
  post_id: string;
  platform: Platform;
  status: PostStatus;
  error_message: string | null;
  posted_at: string | null;
  external_post_url: string | null;
};

export type SnsAccountRow = {
  id: string;
  user_id: string;
  platform: Platform;
  account_name: string;
  encrypted_credentials: string;
  is_active: boolean;
};

// ---- Insert 型（必須項目のみ、デフォルト値があるものは省略可） ----

export type PostInsert = {
  user_id: string;
  body_common: string;
  images?: ImageItem[];
  status?: PostStatus;
};

export type PostTargetInsert = {
  post_id: string;
  platform: Platform;
  status?: PostStatus;
  error_message?: string | null;
  posted_at?: string | null;
  external_post_url?: string | null;
};

export type SnsAccountInsert = {
  user_id: string;
  platform: Platform;
  account_name: string;
  encrypted_credentials: string;
  is_active?: boolean;
};

// ---- Database 型（@supabase/supabase-js のジェネリクス互換） ----

export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Omit<UserRow, "created_at"> & { created_at?: string };
        Update: Partial<UserRow>;
      };
      posts: {
        Row: PostRow;
        Insert: PostInsert;
        Update: Partial<PostInsert>;
      };
      post_targets: {
        Row: PostTargetRow;
        Insert: PostTargetInsert;
        Update: Partial<PostTargetInsert>;
      };
      sns_accounts: {
        Row: SnsAccountRow;
        Insert: SnsAccountInsert;
        Update: Partial<SnsAccountInsert>;
      };
    };
  };
};
