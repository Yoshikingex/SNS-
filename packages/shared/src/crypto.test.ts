import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt } from "./crypto";

const VALID_KEY = randomBytes(32).toString("base64");
const ANOTHER_KEY = randomBytes(32).toString("base64");

describe("crypto AES-256-GCM", () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalKey;
    }
  });

  it("plaintext を encrypt → decrypt すると元に戻る", () => {
    const plaintext = "secret SNS token: abc123";
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("出力形式が iv:authTag:ciphertext の3要素 (Base64) である", () => {
    const ciphertext = encrypt("payload");
    const parts = ciphertext.split(":");
    expect(parts).toHaveLength(3);
    expect(Buffer.from(parts[0], "base64")).toHaveLength(12);
    expect(Buffer.from(parts[1], "base64")).toHaveLength(16);
    expect(Buffer.from(parts[2], "base64").length).toBeGreaterThan(0);
  });

  it("同じ平文でも IV が乱数なので暗号文は毎回異なる", () => {
    const plaintext = "stable input";
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  it("空文字も encrypt/decrypt できる", () => {
    expect(decrypt(encrypt(""))).toBe("");
  });

  it("マルチバイト文字 (日本語/絵文字) も復元できる", () => {
    const plaintext = "投稿一括統合システム 🌸";
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it("不正な鍵で復号すると例外が出る", () => {
    const ciphertext = encrypt("data");
    process.env.ENCRYPTION_KEY = ANOTHER_KEY;
    expect(() => decrypt(ciphertext)).toThrow();
  });

  it("ENCRYPTION_KEY 未設定だと encrypt が例外", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
  });

  it("ENCRYPTION_KEY 未設定だと decrypt が例外", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => decrypt("a:b:c")).toThrow(/ENCRYPTION_KEY/);
  });

  it("32バイトでない鍵だと例外", () => {
    process.env.ENCRYPTION_KEY = Buffer.from("too short").toString("base64");
    expect(() => encrypt("x")).toThrow(/32 bytes/);
  });

  it("不正な形式 (区切り不足) は例外", () => {
    expect(() => decrypt("only-one-part")).toThrow(/format/);
  });

  it("authTag が改ざんされていると復号失敗", () => {
    const ciphertext = encrypt("data");
    const [iv, , data] = ciphertext.split(":");
    const tamperedAuthTag = randomBytes(16).toString("base64");
    expect(() => decrypt([iv, tamperedAuthTag, data].join(":"))).toThrow();
  });
});
