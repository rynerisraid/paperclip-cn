import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveBetterAuthSecret } from "../auth/better-auth.js";

describe("resolveBetterAuthSecret", () => {
  const originalBetterAuthSecret = process.env.BETTER_AUTH_SECRET;
  const originalAgentJwtSecret = process.env.PAPERCLIP_AGENT_JWT_SECRET;

  beforeEach(() => {
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.PAPERCLIP_AGENT_JWT_SECRET;
  });

  afterEach(() => {
    if (originalBetterAuthSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = originalBetterAuthSecret;

    if (originalAgentJwtSecret === undefined) delete process.env.PAPERCLIP_AGENT_JWT_SECRET;
    else process.env.PAPERCLIP_AGENT_JWT_SECRET = originalAgentJwtSecret;
  });

  it("uses the first non-empty trimmed secret", () => {
    process.env.BETTER_AUTH_SECRET = "  better-auth-secret  ";
    process.env.PAPERCLIP_AGENT_JWT_SECRET = "agent-jwt-secret";

    expect(resolveBetterAuthSecret()).toBe("better-auth-secret");
  });

  it("falls back to the agent JWT secret when the Better Auth secret is blank", () => {
    process.env.BETTER_AUTH_SECRET = "   ";
    process.env.PAPERCLIP_AGENT_JWT_SECRET = "  agent-jwt-secret  ";

    expect(resolveBetterAuthSecret()).toBe("agent-jwt-secret");
  });

  it("throws when both candidate secrets are missing or whitespace-only", () => {
    process.env.BETTER_AUTH_SECRET = "   ";
    process.env.PAPERCLIP_AGENT_JWT_SECRET = "\t";

    expect(() => resolveBetterAuthSecret()).toThrow(
      "BETTER_AUTH_SECRET (or PAPERCLIP_AGENT_JWT_SECRET) must be set.",
    );
  });
});
