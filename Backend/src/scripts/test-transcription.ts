import assert from "node:assert/strict";
import {
  __setOpenAiClientForTests,
  extractCandidatesWithLlm,
  normalizeLlmCandidates,
} from "../services/transcriptionLlm.service";
import { extractCandidatesFromTranscript } from "../services/transcription.service";

async function run() {
  const normalized = normalizeLlmCandidates([
    {
      title: "Finalize login flow",
      description: "Ship and verify with QA",
      priority: "high",
      dueDate: "2026-04-20",
      confidence: 0.92,
    },
    {
      title: "",
      description: "invalid",
    },
    {
      title: "Unknown priority maps to medium",
      priority: "whatever",
      confidence: 2,
    },
  ]);
  assert.equal(normalized.length, 2, "should drop invalid title row");
  assert.equal(normalized[0]?.priority, "high");
  assert.equal(normalized[1]?.priority, "medium");
  assert.equal(normalized[1]?.confidence, 1);

  const mockClient = {
    responses: {
      create: async () => ({
        output_text: JSON.stringify([
          {
            title: "Update onboarding copy",
            description: "Refine empty-state text",
            priority: "medium",
            dueDate: null,
            confidence: 0.8,
          },
        ]),
      }),
    },
  } as unknown as import("openai").default;
  __setOpenAiClientForTests(mockClient);
  const llmOut = await extractCandidatesWithLlm("Meeting transcript text");
  assert.equal(llmOut.length, 1, "mocked LLM should return one row");
  assert.equal(llmOut[0]?.title, "Update onboarding copy");

  const serviceOut = await extractCandidatesFromTranscript("Meeting transcript text");
  assert.equal(serviceOut.length, 1, "service should use LLM adapter");

  const empty = await extractCandidatesFromTranscript("   ");
  assert.equal(empty.length, 0, "empty transcript should return no candidates");

  __setOpenAiClientForTests(null);
}

void run()
  .then(() => {
    console.log("transcription extractor tests passed");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
