import { describe, expect, it } from "vitest";
import { getOpenApiDocument } from "../src/openapi";

describe("OpenAPI document", () => {
  it("is generated from the Zod schemas", () => {
    const document = getOpenApiDocument() as any;

    expect(document.openapi).toBe("3.0.3");
    expect(document.components.schemas.CreateTodo).toMatchObject({
      type: "object",
    });
    expect(document.components.schemas.GenerateQuiz).toBeTruthy();
    expect(document.components.schemas.DocumentUploadUrl).toBeTruthy();
    expect(document.paths["/api/v1/todos"].post).toBeTruthy();
    expect(document.paths["/api/v1/documents/upload-url"].post).toBeTruthy();
    expect(
      document.paths["/api/v1/exams/{id}/plan/recalculate"].post.summary
    ).toContain("Reschedule");
    expect(document.components.securitySchemes.bearerAuth.scheme).toBe(
      "bearer"
    );
  });
});
