# Moodessert

Answer 10 questions. An AI reads what you wrote, decides who you really are, and turns your words into a dessert.

GenHacks Open 2026 entry (Open track). Work started 11 Nov 2026.

## Files so far
- `questions.json`: 60-question bilingual bank (48 multiple choice, 12 open-ended)
- `desserts.json`: 16 dessert personalities with copy, rarity and particle hints
- `judge-prompt.md`: the AI judging prompt and guardrails

## Tools used
Claude (code, copy), Gemini (copy polish), Gemini API `gemini-3.5-flash-lite` (live judging), Netlify Functions (hosting). Live at https://moodessert.netlify.app
