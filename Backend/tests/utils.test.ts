import { describe, expect, it } from "vitest";
import { keyPrefixFromName, slugifyName } from "../src/utils/slug";
import { initialsFromName } from "../src/utils/initials";
import { normalizeGithubRepoFullNameInput } from "../src/utils/githubUrlParse";
import { isValidEmail, LIMITS } from "../src/utils/inputLimits";
import { isValidStatusSlug, parseAndValidateBoardColumns } from "../src/utils/boardColumns";
import { isTrustedUploadUrl, attachmentGridFsIdFromTrustedUrl } from "../src/utils/uploadUrl";

describe("slugifyName", () => {
  it("folds accents and keeps letters from any script", () => {
    expect(slugifyName("Café Été")).toBe("cafe-ete");
    expect(slugifyName("Проект Альфа")).toBe("проект-альфа");
    expect(slugifyName("项目")).toBe("项目");
  });
  it("strips punctuation, collapses separators and falls back to 'project'", () => {
    expect(slugifyName("  My   Project!! ")).toBe("my-project");
    expect(slugifyName("---")).toBe("project");
    expect(slugifyName("!!!")).toBe("project");
  });
  it("caps length without a trailing dash", () => {
    const slug = slugifyName(`${"a".repeat(79)} b`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("keyPrefixFromName", () => {
  it("uses up to three ASCII letters", () => {
    expect(keyPrefixFromName("Apollo")).toBe("APO");
    expect(keyPrefixFromName("X")).toBe("XX");
    expect(keyPrefixFromName("Проект")).toBe("TK");
  });
});

describe("initialsFromName", () => {
  it("never splits emoji or astral characters", () => {
    expect(initialsFromName("😀 Smile")).toBe("😀S");
    expect(initialsFromName("jane doe")).toBe("JD");
    expect(initialsFromName("Émile Zola")).toBe("ÉZ");
    expect(initialsFromName("   ")).toBe("ME");
  });
});

describe("normalizeGithubRepoFullNameInput", () => {
  it("accepts owner/repo, URLs and SSH form", () => {
    expect(normalizeGithubRepoFullNameInput("Acme/App")).toBe("acme/app");
    expect(normalizeGithubRepoFullNameInput("https://github.com/Acme/App.git")).toBe("acme/app");
    expect(normalizeGithubRepoFullNameInput("github.com/acme/app")).toBe("acme/app");
    expect(normalizeGithubRepoFullNameInput("git@github.com:acme/app.git")).toBe("acme/app");
  });
  it("does not treat look-alike hosts as github.com", () => {
    expect(normalizeGithubRepoFullNameInput("https://evilgithub.com/acme/app")).not.toBe("acme/app");
    expect(normalizeGithubRepoFullNameInput("evilgithub.com/acme/app")).not.toBe("acme/app");
  });
});

describe("isValidEmail", () => {
  it.each(["a@b.co", "first.last+tag@example.com"])("accepts %s", (e) => expect(isValidEmail(e)).toBe(true));
  it.each(["notanemail", "a@b", "x<evil@a.com>", "a b@c.com", 'a"b@c.com', "a,b@c.com", `${"a".repeat(LIMITS.email)}@x.com`])(
    "rejects %s",
    (e) => expect(isValidEmail(e)).toBe(false),
  );
});

describe("board columns", () => {
  it("validates status slugs", () => {
    expect(isValidStatusSlug("in-progress")).toBe(true);
    expect(isValidStatusSlug("Garbage!")).toBe(false);
    expect(isValidStatusSlug("")).toBe(false);
  });
  it("requires the protected core columns", () => {
    expect(() => parseAndValidateBoardColumns([{ id: "a", title: "A", status: "todo" }])).toThrow();
  });
});

describe("upload URLs", () => {
  const id = "64b000000000000000000000";
  it("only trusts this API's file route", () => {
    expect(isTrustedUploadUrl(`/api/uploads/files/${id}`)).toBe(true);
    expect(isTrustedUploadUrl(`http://127.0.0.1:4999/api/uploads/files/${id}`)).toBe(true);
    expect(isTrustedUploadUrl(`https://evil.example/api/uploads/files/${id}`)).toBe(false);
    expect(isTrustedUploadUrl("javascript:alert(1)")).toBe(false);
    expect(isTrustedUploadUrl(`/api/uploads/files/../${id}`)).toBe(false);
  });
  it("extracts the GridFS id from relative and absolute forms", () => {
    expect(attachmentGridFsIdFromTrustedUrl(`/api/uploads/files/${id}`)?.toHexString()).toBe(id);
    expect(attachmentGridFsIdFromTrustedUrl(`http://127.0.0.1:4999/api/uploads/files/${id}`)?.toHexString()).toBe(id);
  });
});
