# Moodessert

Pick your MBTI, answer five odd little questions, and watch your answers bake into the dessert you are.

GenHacks Open 2026 entry (Open track). Live at https://moodessert.netlify.app

## How it works
1. You pick your MBTI. It is trusted, never second-guessed. Never took the test? Four quick taps stand in for it.
2. You can add your star sign. It gets its own line on the card.
3. Each type has its own five questions. If none of the answers fits, you write your own sentence and the AI places it. Your answers put you in one of four flavours of that type's dessert: 16 desserts, 64 results.
4. The words from your answers fall into a bowl, burst into particles, and rise into a 3D point-cloud of your dessert.
5. The card shows your flavour, your branch, a line of praise, and one line written for you by the AI from what you answered.

## Files
- `index.html`: the whole app (home, MBTI pick, questions, result card)
- `bake.js`: the reveal animation, Three.js r160, 16 desserts built in code with no image or model files (`demo.html` shows them all; notes in `docs/bake-note.md`)
- `quiz.json`: the bilingual question bank the app loads. Built by `node tools/build-quiz.mjs` from `docs/questions-v2-draft.md` (Chinese), `docs/questions-v2-en.md` (English) and `desserts.json`
- `api/judge.js` + `netlify/functions/judge.js`: serverless function that asks Gemini for the personal line and the falling words. The key lives only in the `GEMINI_API_KEY` environment variable
- `netlify.toml`: hosting config

## Tools used
Claude (code, copy, 3D particle desserts), Gemini (copy polish), Gemini API `gemini-3.5-flash-lite` (personal line on the result card), Three.js, Netlify Functions (hosting).
