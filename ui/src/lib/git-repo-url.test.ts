import { describe, expect, it } from "vitest";
import { isHttpGitRepoUrl } from "./git-repo-url";

describe("isHttpGitRepoUrl", () => {
  it("accepts HTTP and HTTPS Git repository URLs from any host", () => {
    expect(isHttpGitRepoUrl("https://gitlab.example.com/team/demo-repo")).toBe(true);
    expect(isHttpGitRepoUrl("https://github.com/org/repo")).toBe(true);
    expect(isHttpGitRepoUrl("http://git.example.local/team/demo-repo")).toBe(true);
  });

  it("rejects empty values, unsupported protocols, and URLs without a repo path", () => {
    expect(isHttpGitRepoUrl("")).toBe(false);
    expect(isHttpGitRepoUrl("ftp://git.example.local/team/demo-repo")).toBe(false);
    expect(isHttpGitRepoUrl("https://git.example.local")).toBe(false);
  });
});
