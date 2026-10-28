import { readFile } from "node:fs/promises";
import path from "node:path";
import { isRagConfigured, searchDocumentChunks } from "../modules/ai/qdrant";

interface RetrievalCase {
  id: string;
  question: string;
  expectedSource: string;
  expectedTerms: string[];
}

interface RetrievalFixture {
  version: number;
  questions: RetrievalCase[];
}

const TARGET_ACCURACY = 0.9;

function matches(
  item: RetrievalCase,
  results: Awaited<ReturnType<typeof searchDocumentChunks>>
): boolean {
  const sourceMatch = results.some((result) =>
    (result.source ?? "").toLowerCase().includes(item.expectedSource.toLowerCase())
  );
  const text = results.map((result) => result.text.toLowerCase()).join(" ");
  const termMatch = item.expectedTerms.every((term) =>
    text.includes(term.toLowerCase())
  );
  return sourceMatch || termMatch;
}

async function main(): Promise<void> {
  const file = path.join(process.cwd(), "tests/fixtures/retrieval-eval.json");
  const fixture = JSON.parse(await readFile(file, "utf8")) as RetrievalFixture;
  const execute = process.argv.includes("--execute");
  const userId = process.env.AI_RETRIEVAL_USER_ID;

  console.log(
    `${fixture.questions.length} retrieval questions, ` +
      (execute ? "live run" : "dry run (pass --execute to query Qdrant)")
  );

  const ids = new Set(fixture.questions.map((item) => item.id));
  if (ids.size !== fixture.questions.length) {
    throw new Error("Retrieval fixture ids are not unique.");
  }

  if (!execute) {
    console.log("Fixture is valid. No vector queries were made.");
    return;
  }

  if (!userId) {
    throw new Error("AI_RETRIEVAL_USER_ID is required with --execute.");
  }

  if (!isRagConfigured()) {
    throw new Error("QDRANT_URL and embeddings must be configured with --execute.");
  }

  let passed = 0;
  const failures: string[] = [];

  for (const item of fixture.questions) {
    const results = await searchDocumentChunks(userId, item.question, { limit: 6 });
    if (matches(item, results)) {
      passed += 1;
    } else {
      failures.push(
        `${item.id}: expected ${item.expectedSource}; got ${
          results.map((result) => result.source).filter(Boolean).join(", ") || "no passages"
        }`
      );
    }
  }

  const accuracy = passed / fixture.questions.length;
  console.log(`${passed}/${fixture.questions.length} passed (${(accuracy * 100).toFixed(1)}%)`);

  if (failures.length > 0) {
    console.error(failures.join("\n"));
  }

  if (accuracy < TARGET_ACCURACY) {
    console.error(`Below the ${TARGET_ACCURACY * 100}% retrieval target.`);
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
