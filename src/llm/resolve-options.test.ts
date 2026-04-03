import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ZscanConfig } from "../config.js";
import { resolveLlmOptions } from "./resolve-options.js";
import {
  ZSCAN_LLM_BASE_URL_DEFAULT,
  ZSCAN_LLM_MODEL_DEFAULT,
} from "./constants.js";

const KEYS = [
  "ZSCAN_LLM_BASE_URL",
  "ZSCAN_LLM_MODEL",
  "ZSCAN_LLM_API_KEY",
  "ZSCAN_LLM_PROVIDER",
] as const;

describe("resolveLlmOptions", () => {
  const snapshot: Partial<Record<(typeof KEYS)[number], string | undefined>> =
    {};

  beforeEach(() => {
    for (const k of KEYS) {
      snapshot[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      const v = snapshot[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("uses defaults when llm is sparse", () => {
    const cfg: ZscanConfig = {
      schema_version: 1,
      version: 1,
      llm: { enabled: false },
    };
    const o = resolveLlmOptions(cfg);
    expect(o.baseUrl).toBe(ZSCAN_LLM_BASE_URL_DEFAULT);
    expect(o.model).toBe(ZSCAN_LLM_MODEL_DEFAULT);
    expect(o.provider).toBe("openai_compatible");
    expect(o.enabled).toBe(false);
  });

  it("infers anthropic from api.anthropic.com", () => {
    const cfg: ZscanConfig = {
      schema_version: 1,
      version: 1,
      llm: {
        enabled: true,
        base_url: "https://api.anthropic.com/v1",
        model: "claude-3-5-haiku-20241022",
      },
    };
    expect(resolveLlmOptions(cfg).provider).toBe("anthropic");
  });

  it("respects llm.provider anthropic without anthropic host", () => {
    const cfg: ZscanConfig = {
      schema_version: 1,
      version: 1,
      llm: {
        enabled: true,
        base_url: "http://127.0.0.1:9/v1",
        model: "x",
        provider: "anthropic",
      },
    };
    expect(resolveLlmOptions(cfg).provider).toBe("anthropic");
  });

  it("env ZSCAN_LLM_PROVIDER overrides yaml when set", () => {
    process.env.ZSCAN_LLM_PROVIDER = "anthropic";
    const cfg: ZscanConfig = {
      schema_version: 1,
      version: 1,
      llm: {
        enabled: true,
        base_url: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        provider: "openai_compatible",
      },
    };
    expect(resolveLlmOptions(cfg).provider).toBe("anthropic");
  });

  it("env base URL wins over yaml", () => {
    process.env.ZSCAN_LLM_BASE_URL = "https://example.com/v1";
    const cfg: ZscanConfig = {
      schema_version: 1,
      version: 1,
      llm: { enabled: true, base_url: "http://ignored/v1", model: "m" },
    };
    expect(resolveLlmOptions(cfg).baseUrl).toBe("https://example.com/v1");
  });
});
