import { readFile } from "node:fs/promises";
import path from "node:path";
import { OllamaEmbeddings } from "@langchain/ollama";
import { env } from "../config/env";

interface BenchmarkFixture {
  documents: Array<{ id: string; text: string }>;
  queries: Array<{
    id: string;
    question: string;
    expectedDocumentId: string;
    expectedTerms: string[];
  }>;
}

function cosine(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }

  return leftNorm === 0 || rightNorm === 0
    ? 0
    : dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

async function scoreModel(
  model: string,
  fixture: BenchmarkFixture
): Promise<{ model: string; recallAt3: number; passed: number }> {
  const embeddings = new OllamaEmbeddings({
    baseUrl: env.OLLAMA_BASE_URL!,
    model,
  });
  const documentVectors = await embeddings.embedDocuments(
    fixture.documents.map((document) => document.text)
  );

  let passed = 0;
  for (const query of fixture.queries) {
    const vector = await embeddings.embedQuery(query.question);
    const ranked = fixture.documents
      .map((document, index) => ({
        document,
        score: cosine(vector, documentVectors[index] ?? []),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);

    if (
      ranked.some(
        (entry) =>
          entry.document.id === query.expectedDocumentId ||
          query.expectedTerms.every((term) =>
            entry.document.text.toLowerCase().includes(term.toLowerCase())
          )
      )
    ) {
      passed += 1;
    }
  }

  return { model, recallAt3: passed / fixture.queries.length, passed };
}

async function main(): Promise<void> {
  const file = path.join(process.cwd(), "tests/fixtures/embedding-benchmark.json");
  const fixture = JSON.parse(await readFile(file, "utf8")) as BenchmarkFixture;
  const execute = process.argv.includes("--execute");
  const models = (
    process.env.EMBEDDING_BENCHMARK_MODELS ?? "bge-m3,multilingual-e5"
  )
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  console.log(
    `${fixture.documents.length} documents, ${fixture.queries.length} queries, ` +
      (execute ? `models: ${models.join(", ")}` : "dry run")
  );

  if (!execute) {
    console.log("Fixture is valid. Pass --execute with Ollama running to benchmark.");
    return;
  }

  if (!env.OLLAMA_BASE_URL) {
    throw new Error("OLLAMA_BASE_URL is required with --execute.");
  }

  const results = [];
  for (const model of models) {
    results.push(await scoreModel(model, fixture));
  }

  results.sort((left, right) => right.recallAt3 - left.recallAt3);
  for (const result of results) {
    console.log(
      `${result.model}: ${result.passed}/${fixture.queries.length} recall@3 (${(
        result.recallAt3 * 100
      ).toFixed(1)}%)`
    );
  }

  if (results[0]) {
    console.log(`Recommended model for this corpus: ${results[0].model}`);
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
