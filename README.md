# Moodessert

Pick your MBTI, answer five odd little questions, and watch your answers bake into the dessert you are.

GenHacks Open 2026 entry (Open track). Live at https://moodessert.netlify.app

## How it works
1. Two ingredients first: your MBTI picks the cake base (never took the test? four quick taps stand in for it) and your star sign sets the texture. Neither is shown on the card.
2. Five questions written for that base. If none of the answers fits, you write your own sentence.
3. A reading layer tallies which way your answers lean, then asks the model to work like a personality psychologist: find the motive your answers share, the contradiction where they split, and close with praise that follows from both. It must cite your own answers and is not allowed to mention MBTI or star signs.
4. The words from your answers fall into a bowl, burst into particles, and rise into a 3D point-cloud of your dessert: 16 desserts, 64 flavours.

This is a reading of five answers, made for fun. It is not a psychological assessment.

## Files
- `index.html`: the whole app (home, MBTI pick, questions, result card)
- `bake.js`: the reveal animation, Three.js r160, 16 desserts built in code with no image or model files (`demo.html` shows them all; notes in `docs/bake-note.md`)
- `quiz.json`: the bilingual question bank the app loads. Built by `node tools/build-quiz.mjs` from `docs/questions-v2-draft.md` (Chinese), `docs/questions-v2-en.md` (English) and `desserts.json`
- `api/judge.js` + `netlify/functions/judge.js`: serverless function that asks Gemini for the personal line and the falling words. The key lives only in the `GEMINI_API_KEY` environment variable
- `netlify.toml`: hosting config

## Tools used
Claude (code, copy, 3D particle desserts), Gemini (copy polish), Gemini API `gemini-3.5-flash-lite` (personal line on the result card), Three.js, Netlify Functions (hosting).
