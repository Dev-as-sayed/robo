import { AIMessage } from "@langchain/core/messages";
import { describe, expect, it, vi } from "vitest";
import { explainImage } from "../src/modules/ai/vision";

function model(response: unknown) {
  return {
    constructor: { name: "FakeVision" },
    invoke: vi.fn(async () => response),
  } as never;
}

describe("vision explanation", () => {
  it("sends a data URL and returns the model answer", async () => {
    const fake = model(
      new AIMessage({
        content: "Use the quadratic formula: x = (-b ± √(b²-4ac)) / 2a.",
        usage_metadata: {
          input_tokens: 120,
          output_tokens: 35,
          total_tokens: 155,
        },
        response_metadata: { model_name: "gemini-2.5-flash" },
      })
    );

    const result = await explainImage(
      {
        imageBase64: Buffer.from("fake-image").toString("base64"),
        mimeType: "image/png",
        question: "Explain this formula",
      },
      [fake as never]
    );

    expect(result.answer).toContain("quadratic");
    expect(result.model).toBe("gemini-2.5-flash");
    expect(result.usage).toEqual({
      input_tokens: 120,
      output_tokens: 35,
      total_tokens: 155,
    });

    const messages = (fake as unknown as { invoke: ReturnType<typeof vi.fn> })
      .invoke.mock.calls[0][0];
    expect(messages[1].content).toEqual([
      { type: "text", text: "Explain this formula" },
      {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${Buffer.from("fake-image").toString("base64")}`,
        },
      },
    ]);
  });

  it("falls back to the next vision model", async () => {
    const first = {
      constructor: { name: "Broken" },
      invoke: vi.fn(async () => {
        throw Object.assign(new Error("rate limited"), { status: 429 });
      }),
    };
    const second = model(new AIMessage("Second model answer"));

    const result = await explainImage(
      {
        imageBase64: Buffer.from("fake-image").toString("base64"),
        mimeType: "image/jpeg",
      },
      [first as never, second as never]
    );

    expect(result.answer).toBe("Second model answer");
    expect(first.invoke).toHaveBeenCalledOnce();
    expect(
      (second as unknown as { invoke: ReturnType<typeof vi.fn> }).invoke
    ).toHaveBeenCalledOnce();
  });

  it("rejects empty responses and configured-less providers", async () => {
    await expect(
      explainImage(
        { imageBase64: "aGVsbG8=", mimeType: "image/png" },
        []
      )
    ).rejects.toThrow("AI_NOT_CONFIGURED");

    await expect(
      explainImage(
        { imageBase64: "aGVsbG8=", mimeType: "image/png" },
        [model(new AIMessage("")) as never]
      )
    ).rejects.toThrow("AI_EMPTY_RESPONSE");
  });
});
