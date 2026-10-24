# Kero consultant pilot — inactive draft

Scope: conversational chat only, Marketing Launch chapter 1. Existing structured grading, access controls, trial message limits and all other chats remain unchanged. Enable only after review with MENTOR_CONSULTANT_PILOT=true in a test environment. No database migration.

The reference text is extracted from platform/ch1.html, the public preview. It has NOT been compared to the current protected uploaded Launch chapter. Outlines are guidance metadata only, not retrieval of advanced lesson content. Launch titles come from marketing-launch-modern-titles.sql; Growth titles from the reviewed font-fixed upload package; Mastery and Leadership from their repository content JSONs. These must be reconciled with active published versions before rollout. The existing Growth/Launch shared legacy content file is identified but not changed by this pilot.

Validation: node --test tests/mentor-consultant-pilot.test.js; node --check src/routes/mentor.js. This checks configuration and source integrity; it does not establish educational correctness of model responses. No live LLM evaluation or student-account test has been performed; no model credentials were available.

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
