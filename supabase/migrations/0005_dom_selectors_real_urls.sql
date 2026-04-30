-- Phase 6 後編: 実 URL とセレクタを反映
-- リラクシィー (rx-sns.jp) と 02 (m-sns.net) の本物の DOM セレクタを version 2 として登録。
-- API は最新 version を返すので、これが自動採用される（拡張機能は60秒以内に追従）。

insert into public.dom_selectors (platform, field_name, selector, version) values
  -- リラクシィー (rx-sns.jp): Twitter 風 SPA、textarea + 隠し file input
  ('relaxy', 'post_body',     'textarea[placeholder="いまどうしてる？"]',                  2),
  ('relaxy', 'image_upload',  'input[data-testid="image-file-input"]',                    2),
  ('relaxy', 'submit_button', 'button[aria-label="投稿する"]',                              2),

  -- 02 (m-sns.net/user/post/): フォーム送信型
  ('02', 'post_body',     'textarea#content',                                              2),
  ('02', 'image_upload',  'input[name="image1"]',                                          2),
  ('02', 'submit_button', 'button[type="submit"][name="action"][value="publish"]',         2)
on conflict (platform, field_name, version) do nothing;
