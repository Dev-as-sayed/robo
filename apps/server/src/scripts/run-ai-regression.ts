import { readFile } from "node:fs/promises";
import path from "node:path";
import { runAgent } from "../modules/ai/agent";
import { buildTools } from "../modules/ai/tools";
import { getChatModels } from "../modules/ai/llm-router";

interface RegressionCase {
  id: string;
  utterance: string;
  expectedTool?: string;
  expectedArgs?: Record<string, unknown>;
  expectNoTools?: boolean;
}

function looseMatch(expected: unknown, actual: unknown): boolean {
  if (typeof expected === "string" && typeof actual === "string") {
    return actual.toLowerCase().includes(expected.toLowerCase());
  }
  if (typeof expected === "number" || typeof expected === "boolean") {
    return expected === actual;
  }
  if (expected && actual && typeof expected === "object" && typeof actual === "object") {
    return Object.entries(expected as Record<string, unknown>).every(([key, value]) =>
      looseMatch(value, (actual as Record<string, unknown>)[key])
    );
  }
  return expected === actual;
}

async function loadCases(): Promise<RegressionCase[]> {
  const file = path.join(process.cwd(), "tests/fixtures/ai-regression.json");
  const parsed = JSON.parse(await readFile(file, "utf8")) as RegressionCase[];
  return parsed;
}

async function main(): Promise<void> {
  const cases = await loadCases();
  const execute = process.argv.includes("--execute");
  const userId = process.env.AI_REGRESSION_USER_ID;
  const timezone = process.env.AI_REGRESSION_TIMEZONE ?? "UTC";
  const locale = process.env.AI_REGRESSION_LOCALE ?? "en";

  const tools = buildTools({
    userId: userId ?? "dry-run-user",
    conversationId: "dry-run",
    timezone,
    locale,
    now: new Date(),
  });
  const toolNames = new Set(tools.map(tool => tool.name));

  const structural = cases
    .filter(item => item.expectedTool)
    .filter(item => !toolNames.has(item.expectedTool!));

  console.log(
    `${cases.length} cases, ${toolNames.size} tools, ` +
      (execute ? "live run" : "dry run (pass --execute to call models)")
  );

  if (structural.length > 0) {
    console.error(
      "Unknown expected tools:",
      structural.map(item => `${item.id}:${item.expectedTool}`).join(", ")
    );
    process.exitCode = 1;
    return;
  }

  if (!execute) {
    console.log("Fixtures and tool names are valid. No model calls were made.");
    return;
  }

  if (!userId) {
    console.error("AI_REGRESSION_USER_ID is required with --execute.");
    process.exitCode = 1;
    return;
  }

  if (getChatModels("agent_tools").length === 0) {
    console.error("No agent model is configured.");
    process.exitCode = 1;
    return;
  }

  let passed = 0;
  const failures: string[] = [];

  for (const item of cases) {
    const result = await runAgent({
      userId,
      conversationId: `regression-${item.id}-${Date.now()}`,
      content: item.utterance,
      history: [],
      user: { name: "Regression", locale, timezone },
      task: "agent_tools",
    });

    let ok = true;
    if (item.expectNoTools) {
      ok = result.toolCalls.length === 0;
    } else if (item.expectedTool) {
      const call = result.toolCalls.find(candidate => candidate.name === item.expectedTool);
      ok = Boolean(call);
      if (call && item.expectedArgs) {
        ok = Object.entries(item.expectedArgs).every(([key, value]) =>
          looseMatch(value, (call.args as Record<string, unknown>)?.[key])
        );
      }
    }

    if (ok) {
      passed += 1;
    } else {
      failures.push(
        `${item.id}: expected ${item.expectNoTools ? "no tools" : item.expectedTool}, got ${result.toolCalls.map(call => call.name).join(", ") || "none"}`
      );
    }
  }

  console.log(`${passed}/${cases.length} AI regression cases passed`);
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
