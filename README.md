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

Scans use the [Cloud Vision API](https://cloud.google.com/vision/docs/ocr) `DOCUMENT_TEXT_DETECTION` feature, with Japanese and Myanmar language hints. Without a key, the app still runs: it opens a practice N2 page in the same editor so you can try the full flow.

1. Enable Cloud Vision API on a Google Cloud project.
2. Create an API key.
3. Copy `.env.example` to `.env.local`:

```bash
GOOGLE_CLOUD_VISION_API_KEY=your-key
```

`GOOGLE_VISION_API_KEY` is accepted as an alias. Restart the dev server after adding the key.

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
  api/ocr/route.ts       Google Vision endpoint and practice fallback
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
  parse-vocab.ts         row parser for Vision text and word boxes
  srs.ts                 easy / hard scheduling
  sample-data.ts         N2 sample deck
  storage.ts
```
