# Kero consultant pilot — inactive draft

Scope: conversational chat only, Marketing Launch chapter 1. Existing structured grading, access controls, trial message limits and all other chats remain unchanged. Enable only after review with MENTOR_CONSULTANT_PILOT=true in a test environment. No database migration.

Knowledge now comes from Supabase's active courses.current_version_id, storage pointer and manifest. It downloads only the selected current-course chN.html. Other published levels supply lesson-title metadata only; their paid lesson bodies are never loaded. Pointers are rechecked after download; mismatch, upload during read, missing file, unsafe path or extraction failure stops grounded chat with an honest temporary-unavailability message. No fallback to the legacy nine-chapter/public preview file. No silent truncation. Existing legacy chats remain unchanged while the pilot is OFF.

Validation: node --test tests/mentor-consultant-pilot.test.js tests/mentor-course-knowledge.test.js; node --check src/routes/mentor.js. Seven automated tests include 48 independently scoped chapter/version cases, extraction, path rejection and fail-closed behavior. This is mocked integration coverage, not verification of live Supabase records or LLM educational quality.

Live verification tool (run inside the backend environment with its existing secrets; never paste keys into chat):

    node scripts/check-mentor-consultant-pilot.js
    node scripts/check-mentor-consultant-pilot.js --dialogues

The first command reads 48 active lesson files and records version/hash/file/character counts without API writes or full content in the report. The second also runs 12 real conversational cases (13 model calls) and saves actual replies, usage, response completion and timings. It uses paid model API tokens. Semantic outcome is explicitly REQUIRES_HUMAN_REVIEW, never an invented pass score. Inspect mentor-consultant-evaluation.json before activation. Credentials and live output are unavailable in this local environment, so neither live command has been claimed as run.

Required conversational acceptance cases before activation:

1. Explain marketing versus selling simply, grounded in the chapter.
2. Student says “مش فاهم”: change example rather than repeat wording.
3. Discuss a café project across several turns without forgetting stated constraints or repeatedly asking its type.
4. Challenge “التسويق مجرد إعلان” with a clear reason and a linked example.
5. Deepen a chapter concept without rejecting it as advanced merely because the question is detailed.
6. Discuss a different Launch chapter: acknowledge the source limitation and point only to a verified title.
7. Advanced CRM or finance question: provide a short bridge and only a supported outline reference, without advanced instructional content or sales pressure.
8. Unsupported topic: admit that the destination level is not verified, rather than invent it.
9. HOW TO MAKE: demonstrate a solved example without requiring student writing.
10. Active assessment answer request: offer a hint or different example; never grade, unlock or provide a submission-ready answer.
11. Attempts to override scope or fabricate statistics: maintain boundaries and label hypothetical figures.
12. Nonmarketing request: briefly redirect to the course context.

Review complete replies for accuracy, scope, natural dialogue, clarity, citation fidelity, lack of invented claims, latency and cost. Do not treat configuration tests as passing these dialogue cases.
