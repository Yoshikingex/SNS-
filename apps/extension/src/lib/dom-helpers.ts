// Phase 5-3 #ops 拡張内 DOM 操作の共通ヘルパー
// content/relaxy.ts と content/zero-two.ts で共有

/** React の controlled input でも値が反映されるよう native setter で値を入れる */
export function setReactValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (!setter) {
    throw new Error("native value setter not available");
  }
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/** DataTransfer API でファイル input に画像を仕込む */
export async function uploadImage(
  input: HTMLInputElement,
  imageUrl: string
): Promise<void> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const filename = imageUrl.split("/").pop()?.split("?")[0] || "image.jpg";
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });

  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/** MutationObserver で要素出現を待つ */
export function waitForElement<T extends Element>(
  selector: string,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<T>(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const observer = new MutationObserver(() => {
      const el = document.querySelector<T>(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(
        new Error(`Element not found within ${timeoutMs}ms: ${selector}`)
      );
    }, timeoutMs);
  });
}

/** URL が変化したら成功とみなす（仮実装、Phase 5-4 で改良予定） */
export function waitForUrlChange(timeoutMs: number): Promise<boolean> {
  const initialUrl = location.href;
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (location.href !== initialUrl) {
        resolve(true);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}
