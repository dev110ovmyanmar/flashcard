# Sumi

A quiet desk for Japanese vocabulary. Photograph a textbook page, check the kanji, hiragana, and Myanmar meaning, then flip the cards until the words stay.

Decks live in this browser. There is no account.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run lint
npm run build
```

## Read a real textbook photo

Scans send the photo to the [Gemini API](https://ai.google.dev/gemini-api/docs). The model returns each row as kanji, hiragana or katakana, and the Myanmar meaning. Without a key, the app still runs: it opens a practice N2 page in the same editor so you can try the full flow.

1. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Copy `.env.example` to `.env.local`:

```bash
GEMINI_API_KEY=your-key
```

`GOOGLE_GENERATIVE_AI_API_KEY` is accepted as an alias. Scans use the [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview), starting with `gemini-3.8-flash` and moving to another Flash model when that one is busy. Set `GEMINI_MODEL` to choose which model is tried first. Restart the dev server after adding the key.

## Study

- The front of a card is only the kanji. Tap it, or press Space, to flip.
- **Got it** schedules the card (1 day, then 3, then a longer gap) and takes it out of the current round.
- **Review again** puts it at the back of the round and keeps it on the weak list.
- **Mistakes** studies only cards you marked hard and have not yet cleared.
- Undo puts the last mark back.
- Arrow keys: left for review again, right for got it.

## Folder structure

```
app/
  api/ocr/route.ts       Gemini OCR endpoint and practice fallback
  layout.tsx
  page.tsx
  globals.css
components/
  flash-card.tsx         3D flip
  study-session.tsx      progress, grades, completion
  review-dialog.tsx      edit rows before saving
  scan-dialog.tsx        upload or camera
  deck-library.tsx
  sumi-app.tsx
hooks/use-decks.ts       localStorage
lib/
  parse-vocab.ts         textbook row parser
  gemini-ocr.ts          Gemini request and JSON row reader
  srs.ts                 easy / hard scheduling
  sample-data.ts         N2 sample deck
  storage.ts
```
