# AI and Retrieval Evaluation

## Tool regression

`pnpm --dir apps/server ai:regression` validates the fixture and tool names.
Add `--execute` with `AI_REGRESSION_USER_ID` and provider keys to call models and
measure tool-selection accuracy. Keep the fixture updated when tools change.

## Retrieval evaluation

`tests/fixtures/retrieval-eval.json` holds 50 questions across five source
documents, with expected sources and terms.

```bash
pnpm --dir apps/server retrieval:eval            # validate fixture
AI_RETRIEVAL_USER_ID=... pnpm --dir apps/server retrieval:eval --execute
```

The live run queries Qdrant for that user and requires 90% accuracy. The fixture
documents must be uploaded and indexed for that user first.

## Embedding benchmark

`tests/fixtures/embedding-benchmark.json` is a labelled corpus that does not need
a database. With Ollama running:

```bash
EMBEDDING_BENCHMARK_MODELS=bge-m3,multilingual-e5 \
  pnpm --dir apps/server embeddings:benchmark --execute
```

The script reports recall@3 per model and recommends the best model for this
corpus. Use a larger, language-balanced corpus before changing production
embeddings.

## Model gating

Set `LLM_MIN_MODEL_REGRESSION_SCORE` (0–1) and
`LLM_MODEL_REGRESSION_SCORES` (JSON keyed by `provider:model`). Models below the
floor are removed from the fallback chain; unmeasured models remain available.
If every model is below the floor the original chain is kept so the service still
has a fallback.

Example:

```bash
LLM_MIN_MODEL_REGRESSION_SCORE=0.85
LLM_MODEL_REGRESSION_SCORES='{"gemini:gemini-2.5-flash":0.95,"groq:llama-3.3-70b-versatile":0.72}'
```

Re-index documents after changing `OLLAMA_EMBEDDING_MODEL`; the re-index endpoint
or the re-index scheduler will rebuild vectors and record the embedding model.
