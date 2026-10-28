import { describe, expect, it } from "vitest";
import {
  gateModelsByRegression,
  parseModelChain,
  parseRegressionScores,
} from "../src/modules/ai/llm-router";

describe("model regression gating", () => {
  const specs = parseModelChain(
    "gemini:gemini-2.5-flash,groq:llama-3.3-70b-versatile,openrouter:meta-llama/llama-3.3-70b-instruct:free"
  );

  it("does nothing when gating is disabled", () => {
    expect(
      gateModelsByRegression(specs, { "groq:llama-3.3-70b-versatile": 0.1 }, 0)
    ).toHaveLength(specs.length);
  });

  it("drops low-scoring models and keeps unmeasured ones", () => {
    const gated = gateModelsByRegression(
      specs,
      {
        "gemini:gemini-2.5-flash": 0.95,
        "groq:llama-3.3-70b-versatile": 0.4,
      },
      0.8
    );

    expect(gated.map((spec) => spec.provider)).toEqual(["gemini", "openrouter"]);
  });

  it("falls back to the full chain if every model is below the floor", () => {
    const gated = gateModelsByRegression(
      specs,
      Object.fromEntries(
        specs.map((spec) => [`${spec.provider}:${spec.model}`, 0.1])
      ),
      0.9
    );

    expect(gated).toHaveLength(specs.length);
  });

  it("ignores malformed score documents", () => {
    expect(parseRegressionScores("{nope")).toEqual({});
    expect(
      parseRegressionScores(
        "{\"gemini:gemini-2.5-flash\":0.9,\"groq:llama-3.3-70b-versatile\":\"bad\"}"
      )
    ).toEqual({ "gemini:gemini-2.5-flash": 0.9 });
  });
});
