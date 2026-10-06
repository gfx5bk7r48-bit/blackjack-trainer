# Blackjack Trainer (voice basic strategy + Hi-Lo count)

A single-file practice tool (`index.html`, no build, no server). Say or tap the cards as they come out; it keeps a Hi-Lo running/true count, suggests a bet, and shows the basic-strategy play (with optional Illustrious 18 + Fab 4 index plays) for your hand against the dealer's upcard.

**For practice only. Using devices at casino tables is illegal in many jurisdictions.**

## Voice phrases
- `my card queen`, `my cards eight six`: your cards
- `dealer card six` / `dealer six`: dealer's upcard (later dealer cards still count)
- `seven`, `king ace four`: other players' cards (count only)
- Mix them in one sentence: `my card jack five dealer nine`. Say `other` to switch back.
- `new hand` (keeps count), `new shoe` / `shuffle` (resets count), `undo`, `split`, `next` / `stand` (next split hand)

## Rules / tables
4–8 deck basic strategy, S17 or H17, DAS on/off, late surrender on/off. Index plays: Schlesinger's Illustrious 18 + Fab 4 (S17 values, with H17 changes for 11vA, 10vA, 12v6, 15vA surrender). True count is rounded down for bets and index plays.

## Tests
`node tests/test.js` checks the engine against reference charts for 8 rule sets (4,000 chart cells) plus index plays, count math, and the phrase parser.
