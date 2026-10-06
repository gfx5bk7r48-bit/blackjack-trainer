// Run: node tests/test.js
// Loads the strategy/count/parser core straight out of index.html (between the BJ-CORE markers)
// and checks it against reference charts typed from Wizard of Odds' 4-8 deck basic strategy
// (https://wizardofodds.com/games/blackjack/strategy/4-decks/) and the Hi-Lo Illustrious 18 / Fab 4.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = /\/\*BJ-CORE-START\*\/([\s\S]*?)\/\*BJ-CORE-END\*\//.exec(html);
if (!m) throw new Error('core markers not found');
const sandbox = { module: { exports: {} } };
vm.runInNewContext(m[1], sandbox);
const C = sandbox.module.exports;

let pass = 0, fail = 0; const fails = [];
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) pass++; else { fail++; fails.push(`${msg}\n    expected ${e}\n    got      ${a}`); }
}

const UPS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
const row = s => s.trim().split(/\s+/);

// ---------------- Reference charts ----------------
// Base: 4-8 decks, S17, DAS, no surrender.
function baseChart() {
  return {
    hard: {
      5: row('H H H H H H H H H H'), 6: row('H H H H H H H H H H'), 7: row('H H H H H H H H H H'), 8: row('H H H H H H H H H H'),
      9: row('H D D D D H H H H H'),
      10: row('D D D D D D D D H H'),
      11: row('D D D D D D D D D H'),
      12: row('H H S S S H H H H H'),
      13: row('S S S S S H H H H H'),
      14: row('S S S S S H H H H H'),
      15: row('S S S S S H H H H H'),
      16: row('S S S S S H H H H H'),
      17: row('S S S S S S S S S S'), 18: row('S S S S S S S S S S'), 19: row('S S S S S S S S S S'),
      20: row('S S S S S S S S S S'), 21: row('S S S S S S S S S S')
    },
    soft: { // A,2 .. A,9
      13: row('H H H D D H H H H H'),
      14: row('H H H D D H H H H H'),
      15: row('H H D D D H H H H H'),
      16: row('H H D D D H H H H H'),
      17: row('H D D D D H H H H H'),
      18: row('S Ds Ds Ds Ds S S H H H'),
      19: row('S S S S S S S S S S'),
      20: row('S S S S S S S S S S')
    },
    pair: {
      2: row('P P P P P P H H H H'),
      3: row('P P P P P P H H H H'),
      4: row('H H H P P H H H H H'),
      5: row('D D D D D D D D H H'),
      6: row('P P P P P H H H H H'),
      7: row('P P P P P P H H H H'),
      8: row('P P P P P P P P P P'),
      9: row('P P P P P S P P S S'),
      10: row('S S S S S S S S S S'),
      11: row('P P P P P P P P P P')
    }
  };
}
const idx = up => UPS.indexOf(up);
function chartFor(r) {
  const c = baseChart();
  if (!r.das) { // no double after split
    c.pair[2] = row('H H P P P P H H H H');
    c.pair[3] = row('H H P P P P H H H H');
    c.pair[4] = row('H H H H H H H H H H');
    c.pair[6] = row('H P P P P H H H H H');
  }
  if (r.ls) { // late surrender (both rule sets)
    c.hard[15][idx('10')] = 'Rh';
    c.hard[16][idx('9')] = 'Rh'; c.hard[16][idx('10')] = 'Rh'; c.hard[16][idx('A')] = 'Rh';
  }
  if (r.h17) { // Wizard: modifications if the dealer hits soft 17
    c.hard[11][idx('A')] = 'D';
    c.soft[18][idx('2')] = 'Ds';
    c.soft[19][idx('6')] = 'Ds';
    if (r.ls) {
      c.hard[15][idx('A')] = 'Rh';
      c.hard[17][idx('A')] = 'Rs';
      c.pair[8][idx('A')] = 'Rp';
    }
  }
  return c;
}
const norm = code => code === 'R' ? 'Rh' : code;

// two-card non-pair hands for each hard total
const HARD_HANDS = { 5: ['2', '3'], 6: ['2', '4'], 7: ['2', '5'], 8: ['3', '5'], 9: ['2', '7'], 10: ['3', '7'], 11: ['2', '9'],
  12: ['2', '10'], 13: ['3', '10'], 14: ['4', '10'], 15: ['5', '10'], 16: ['6', '10'], 17: ['7', '10'], 18: ['8', '10'],
  19: ['9', '10'], 20: ['9', 'A', 'K'] /*3-card hard 20*/, 21: ['5', '6', 'K'] };
const SOFT_HANDS = { 13: ['A', '2'], 14: ['A', '3'], 15: ['A', '4'], 16: ['A', '5'], 17: ['A', '6'], 18: ['A', '7'], 19: ['A', '8'], 20: ['A', '9'] };
const PAIR_HANDS = { 2: ['2', '2'], 3: ['3', '3'], 4: ['4', '4'], 5: ['5', '5'], 6: ['6', '6'], 7: ['7', '7'], 8: ['8', '8'], 9: ['9', '9'], 10: ['10', 'K'], 11: ['A', 'A'] };

const CONFIGS = [];
for (const h17 of [false, true]) for (const das of [true, false]) for (const ls of [false, true]) CONFIGS.push({ h17, das, ls });

let chartCells = 0;
for (const r of CONFIGS) {
  const name = `${r.h17 ? 'H17' : 'S17'} ${r.das ? 'DAS' : 'noDAS'} ${r.ls ? 'LS' : 'noLS'}`;
  const ref = chartFor(r);
  for (const [t, cards] of Object.entries(HARD_HANDS)) {
    UPS.forEach((up, i) => {
      // raw total lookup (ignores card count) so 3-card 20/21 rows still test the table
      eq(norm(C.rawHard(+t, C.cardValue(up), r)), ref.hard[t][i], `[${name}] hard ${t} vs ${up}`); chartCells++;
      if (cards.length === 2) { eq(norm(C.rawAction(cards, up, r)), ref.hard[t][i], `[${name}] hand ${cards} vs ${up}`); chartCells++; }
    });
  }
  for (const [t, cards] of Object.entries(SOFT_HANDS)) UPS.forEach((up, i) => { eq(norm(C.rawAction(cards, up, r)), ref.soft[t][i], `[${name}] soft ${cards} vs ${up}`); chartCells++; });
  for (const [p, cards] of Object.entries(PAIR_HANDS)) UPS.forEach((up, i) => { eq(norm(C.rawAction(cards, up, r)), ref.pair[p][i], `[${name}] pair ${cards} vs ${up}`); chartCells++; });
}

// ---------------- Final decisions (availability rules) ----------------
const R = (o = {}) => Object.assign({ h17: false, das: true, ls: false, dev: false, canSplitMore: true }, o);
const D = (cards, up, r, tc, split) => { const d = C.decide({ cards, split: !!split }, up, r, tc); return d && d.action; };

eq(D(['10', '6'], '10', R(), 0), 'HIT', '16v10 basic hit');
eq(D(['10', '6'], '10', R({ ls: true }), 0), 'SURRENDER', '16v10 LS surrender');
eq(D(['10', '4', '2'], '10', R({ ls: true }), 0), 'HIT', '3-card 16v10 cannot surrender -> hit');
eq(D(['5', '6'], '6', R()), 'DOUBLE', '11v6 double');
eq(D(['5', '3', '3'], '6', R()), 'HIT', '3-card 11v6 -> hit (no double)');
eq(D(['A', '7'], '3', R()), 'DOUBLE', 'A7v3 double');
eq(D(['A', '3', '4'], '3', R()), 'STAND', '3-card soft 18 v3 -> stand (Ds)');
eq(D(['A', '7'], '9', R()), 'HIT', 'A7v9 hit');
eq(D(['8', '8'], '10', R()), 'SPLIT', '88v10 split');
eq(D(['8', '3'], '6', R(), null, true), 'DOUBLE', 'split hand 11v6 with DAS -> double');
eq(D(['8', '3'], '6', R({ das: false }), null, true), 'HIT', 'split hand 11v6 no DAS -> hit');
eq(D(['8', '8'], 'A', R({ h17: true, ls: true })), 'SURRENDER', 'H17 LS 88vA surrender');
eq(D(['8', '8'], 'A', R({ h17: true })), 'SPLIT', 'H17 noLS 88vA split');
eq(D(['10', '7'], 'A', R({ h17: true, ls: true })), 'SURRENDER', 'H17 LS 17vA surrender');
eq(D(['10', '5', '2'], 'A', R({ h17: true, ls: true })), 'STAND', 'H17 LS 3-card 17vA stand');
eq(D(['A', 'K'], '10', R()), 'BLACKJACK', 'blackjack');
eq(D(['A', 'K'], '10', R(), null, true), 'STAND', 'split A + K = 21 stand, not BJ');
eq(D(['10', '6', '9'], '10', R()), 'BUST', 'bust');
eq(D(['8', '8'], '6', R({ canSplitMore: false })), 'STAND', '88v6 max hands -> hard 16 stand');
eq(D(['A', 'A'], '6', R({ canSplitMore: false })), 'HIT', 'AA no resplit -> soft 12 hit');
eq(D(['5', '5'], '9', R()), 'DOUBLE', '55v9 double as 10');
eq(D(['10', 'Q'], '6', R()), 'STAND', 'TT v6 stand');
eq(D(['6', '10'], '9', R({ ls: true }), null, true), 'HIT', 'split hand 16v9 LS -> no surrender after split, hit');
eq(C.decide({ cards: ['10'] }, '6', R(), 0), null, 'one card -> no advice');
eq(C.decide({ cards: ['10', '6'] }, null, R(), 0), null, 'no upcard -> no advice');

// ---------------- Index plays ----------------
const RD = (o = {}) => R(Object.assign({ dev: true }, o));
// Illustrious 18 (S17): [cards, up, index, play]
const I18_S17 = [
  [['10', '6'], '10', 0, 'STAND'], [['10', '5'], '10', 4, 'STAND'], [['6', '4'], '10', 4, 'DOUBLE'],
  [['10', '2'], '3', 2, 'STAND'], [['10', '2'], '2', 3, 'STAND'], [['7', '4'], 'A', 1, 'DOUBLE'],
  [['5', '4'], '2', 1, 'DOUBLE'], [['6', '4'], 'A', 4, 'DOUBLE'], [['5', '4'], '7', 3, 'DOUBLE'],
  [['10', '6'], '9', 5, 'STAND'], [['10', '3'], '2', -1, 'STAND'], [['10', '2'], '4', 0, 'STAND'],
  [['10', '2'], '5', -2, 'STAND'], [['10', '2'], '6', -1, 'STAND'], [['10', '3'], '3', -2, 'STAND'],
  [['10', 'K'], '5', 5, 'SPLIT'], [['10', 'K'], '6', 4, 'SPLIT']
];
for (const [cards, up, i, play] of I18_S17) {
  eq(D(cards, up, RD(), i), play, `I18 S17 ${cards} v${up} at TC ${i} -> ${play}`);
  const below = play === 'SPLIT' ? 'STAND' : 'HIT';
  eq(D(cards, up, RD(), i - 1), below, `I18 S17 ${cards} v${up} at TC ${i - 1} -> ${below}`);
}
// H17 changes: 11vA -1, 10vA +3, 12v6 -3
eq(D(['7', '4'], 'A', RD({ h17: true }), -1), 'DOUBLE', 'H17 11vA double at -1');
eq(D(['7', '4'], 'A', RD({ h17: true }), -2), 'HIT', 'H17 11vA hit at -2');
eq(D(['6', '4'], 'A', RD({ h17: true }), 3), 'DOUBLE', 'H17 10vA double at +3');
eq(D(['6', '4'], 'A', RD({ h17: true }), 2), 'HIT', 'H17 10vA hit at +2');
eq(D(['10', '2'], '6', RD({ h17: true }), -3), 'STAND', 'H17 12v6 stand at -3');
eq(D(['10', '2'], '6', RD({ h17: true }), -4), 'HIT', 'H17 12v6 hit at -4');
// Multi-card: 16v10 stand index applies; double indices fall back to hit
eq(D(['10', '4', '2'], '10', RD(), 0), 'STAND', '3-card 16v10 stand at 0');
eq(D(['2', '3', '4'], '2', RD(), 3), 'HIT', '3-card 9v2 TC+3 -> hit (cannot double)');
// Fab 4 surrenders (LS on)
eq(D(['10', '4'], '10', RD({ ls: true }), 3), 'SURRENDER', 'Fab4 14v10 +3');
eq(D(['10', '4'], '10', RD({ ls: true }), 2), 'HIT', 'Fab4 14v10 +2 hit');
eq(D(['10', '5'], '10', RD({ ls: true }), 0), 'SURRENDER', 'Fab4 15v10 0');
eq(D(['10', '5'], '10', RD({ ls: true }), -1), 'HIT', 'Fab4 15v10 -1 hit');
eq(D(['10', '5'], '9', RD({ ls: true }), 2), 'SURRENDER', 'Fab4 15v9 +2');
eq(D(['10', '5'], '9', RD({ ls: true }), 1), 'HIT', 'Fab4 15v9 +1 hit');
eq(D(['10', '5'], 'A', RD({ ls: true }), 1), 'SURRENDER', 'Fab4 15vA +1 (S17)');
eq(D(['10', '5'], 'A', RD({ ls: true }), 0), 'HIT', 'Fab4 15vA 0 hit (S17)');
eq(D(['10', '5'], 'A', RD({ ls: true, h17: true }), -1), 'SURRENDER', 'Fab4 15vA -1 (H17)');
eq(D(['10', '5'], 'A', RD({ ls: true, h17: true }), -2), 'HIT', 'Fab4 15vA -2 hit (H17)');
eq(D(['10', '6'], '10', RD({ ls: true }), -5), 'SURRENDER', '16v10 with LS surrenders at any count');
eq(D(['10', '6'], '10', RD({ ls: true }), 5), 'SURRENDER', '16v10 with LS surrenders at high count');
eq(D(['8', '8'], '10', RD(), 6), 'SPLIT', '88v10 never affected by 16v10 index');
eq(D(['10', '6'], '10', R(), 6), 'HIT', 'index plays off -> basic');
eq(C.insurance('A', RD(), 3), true, 'insurance at +3');
eq(C.insurance('A', RD(), 2), false, 'no insurance at +2');
eq(C.insurance('10', RD(), 5), null, 'insurance only vs ace');

// ---------------- Count / shoe math ----------------
eq(C.RANKS.map(C.hiLo), [-1, 1, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1], 'Hi-Lo tags A..K');
eq(['3', '5', 'K', '7', 'Q', 'A', '8', '5', '4', '2'].reduce((s, r) => s + C.hiLo(r), 0), 2, 'Wizard Hi-Lo example = +2');
const S6 = { decks: 6, pen: 75, burn: 6 };
let st = C.shoeStats(S6, 6, 0);
eq(st.remaining, 306, '6 decks minus 6 burn = 306 cards');
eq(+st.decksLeft.toFixed(4), 5.8846, 'decks left with burn');
eq(st.tcFloor, 1, 'TC floor 6/5.88');
st = C.shoeStats(S6, 8, 98);
eq(st.decksLeft, 4, '98 seen + 6 burn -> 4.0 decks left');
eq(st.tc, 2, 'TC = 8/4');
eq(C.shoeStats(S6, -3, 98).tcFloor, -1, 'TC -0.75 floors to -1');
eq(C.shoeStats(S6, 0, 227).penReached, false, 'pen not reached at 233/312');
eq(C.shoeStats(S6, 0, 228).penReached, true, 'pen reached at 234/312 (75%)');
eq(C.shoeStats({ decks: 6, pen: 75, burn: 0 }, 6, 0).decksLeft, 6, 'no burn -> 6 decks');
eq(isFinite(C.shoeStats(S6, 5, 400).tc), true, 'TC finite when shoe exhausted');
const ramp = C.parseRamp('2,4,6,8');
eq([-3, 0, 1, 2, 3, 4, 5, 9].map(t => C.betUnits(t, ramp)), [1, 1, 1, 2, 4, 6, 8, 8], 'bet ramp');
eq(C.parseRamp('garbage'), [2, 4, 6, 8], 'bad ramp -> default');

// ---------------- Phrase parser ----------------
const P = t => C.parsePhrase(t, 'other').map(e => e.type === 'card' ? `${e.owner}:${e.rank}` : `cmd:${e.cmd}`);
const PT = [
  ['my card queen', ['me:Q']],
  ['My card 8', ['me:8']],
  ['dealer card 6', ['dealer:6']],
  ['dealer six', ['dealer:6']],
  ["Dealer's card is a Jack.", ['dealer:J']],
  ['seven', ['other:7']],
  ['king ace ten 5', ['other:K', 'other:A', 'other:10', 'other:5']],
  ['my card for', ['me:4']],
  ['dealer card to', ['dealer:2']],
  ['too', ['other:2']],
  ['ate', ['other:8']],
  ['won', []],
  ['one', []],
  ['dealer card 1', []],
  ['new hand', ['cmd:newHand']],
  ['new shoe', ['cmd:newShoe']],
  ['New show', ['cmd:newShoe']],
  ['shuffle', ['cmd:newShoe']],
  ['undo', ['cmd:undo']],
  ['undo undo', ['cmd:undo', 'cmd:undo']],
  ['my cards queen 6 dealer card 6', ['me:Q', 'me:6', 'dealer:6']],
  ['new hand my card jack dealer 5', ['cmd:newHand', 'me:J', 'dealer:5']],
  ['my card queen other seven nine', ['me:Q', 'other:7', 'other:9']],
  ['26', ['other:2', 'other:6']],
  ['106', ['other:10', 'other:6']],
  ['eights', ['other:8']],
  ["8's", ['other:8']],
  ['10s', ['other:10']],
  ['split', ['cmd:split']],
  ['double down', ['cmd:double']],
  ['hit me seven', ['cmd:hit', 'me:7']],
  ['stand', ['cmd:stand']],
  ['next', ['cmd:next']],
  ['next hand', ['cmd:nextHand']],
  ['up card nine', ['dealer:9']],
  ['I have a queen and a six', ['me:Q', 'me:6']],
  ['face card', ['other:10']],
  ['MY CARD ACE', ['me:A']],
  ['three tree', ['other:3', 'other:3']],
  ['dealer card nine my card king seven', ['dealer:9', 'me:K', 'me:7']],
];
for (const [t, exp] of PT) eq(P(t), exp, `parse "${t}"`);
eq(C.parsePhrase('queen', 'me')[0].owner, 'me', 'default owner param respected');


// ---------------- Split workflow (state machine) ----------------
{
  const SET = (o = {}) => Object.assign({ decks: 8, pen: 75, burn: 6, h17: false, das: true, ls: false, dev: false, maxHands: 4, hitSplitAces: false, resplitAces: false }, o);
  function session(settings) {
    let G = C.freshState(); const H = [];
    const say = (text, s = settings) => { for (const e of C.parsePhrase(text, 'other')) G = C.step(G, H, e, s).G; return G; };
    const adv = (i = G.active) => C.handAdvice(G, i, settings, 0);
    const act = (i = G.active) => { const a = adv(i); return a.state === 'advice' ? a.d.action : a.state.toUpperCase(); };
    return { say, adv, act, get G() { return G; }, H };
  }
  // pair split, DAS double advice, double auto-advance, resplit
  let t = session(SET());
  t.say('my cards eight eight dealer six');
  eq(t.act(), 'SPLIT', 'split flow: 8,8 v6 -> SPLIT');
  t.say('split');
  eq(t.G.hands.map(h => h.cards), [['8'], ['8']], 'split creates 2 hands with one 8 each');
  eq(t.G.active, 0, 'split: Hand 1 active');
  eq(t.adv().state, 'waiting', 'Hand 1 waits for 2nd card');
  t.say('my card three');
  eq(t.G.hands[0].cards, ['8', '3'], "'my card' goes to active hand");
  eq(t.act(), 'DOUBLE', 'Hand 1: 11 v6 -> DOUBLE (DAS)');
  t.say('double');
  eq(t.adv().state, 'doubling', 'double marks hand as doubling');
  eq(t.G.active, 0, 'no advance until double card arrives');
  t.say('my card ten');
  eq([t.G.hands[0].done, t.G.hands[0].status, t.G.active], [true, 'doubled', 1], 'double card ends Hand 1 and advances to Hand 2');
  t.say('my card eight');
  eq(t.act(), 'SPLIT', 'Hand 2: 8,8 -> SPLIT again');
  t.say('split');
  eq(t.G.hands.map(h => h.cards), [['8', '3', '10'], ['8'], ['8']], 'resplit inserts Hand 3 right after current');
  eq(t.G.active, 1, 'resplit keeps current hand active');
  t.say('my card five');
  eq(t.act(), 'STAND', 'Hand 2: 13 v6 -> STAND');
  t.say('stand');
  eq([t.G.hands[1].status, t.G.active], ['stand', 2], "'stand' finishes Hand 2 -> Hand 3");
  t.say('my card two');
  eq(t.act(), 'DOUBLE', 'Hand 3: 10 v6 -> DOUBLE');
  eq(t.adv(0).state, 'done', 'summary: Hand 1 done');
  t.say('hit');
  eq(t.G.active, 2, "'hit' does not advance");
  t.say('my card ace');
  eq([t.G.hands[2].status, C.allDone(t.G)], ['21', true], 'Hand 3 hits 21 (8,2,A) -> done, all hands done');
  t.say('dealer ten');
  eq(t.G.dealer, ['6', '10'], 'dealer cards still tracked after split');
  t.say('my card queen');
  eq([t.G.hands.length, t.G.hands[0].cards, t.G.dealer], [1, ['Q'], []], 'card after all hands done starts a new round');
  // undo reverses: new round, card, dealer, 21-advance, hit no-op, splits
  t.say('undo'); eq([t.G.hands.length, t.G.dealer], [3, ['6', '10']], 'undo reverses auto new round');
  t.say('undo'); t.say('undo');
  eq([t.G.active, t.G.hands[2].cards, t.G.hands[2].done], [2, ['8', '2'], false], 'undo reverses 21 auto-finish');
  t.say('undo'); t.say('undo'); t.say('undo');
  eq([t.G.active, t.G.hands[1].done, t.G.hands[1].cards], [1, false, ['8']], 'undo reverses stand/advance and card');
  t.say('undo');
  eq(t.G.hands.map(h => h.cards), [['8', '3', '10'], ['8', '8']], 'undo reverses resplit');
  t.say('undo'); t.say('undo');
  eq([t.G.active, t.G.hands[0].done, t.G.hands[0].doubled], [0, false, true], 'undo reverses double-card advance');
  t.say('undo'); t.say('undo'); t.say('undo');
  eq([t.G.hands.length, t.G.hands[0].cards], [1, ['8', '8']], 'undo reverses the original split');
  eq(t.G.rc, C.hiLo('8') * 2 + C.hiLo('6'), 'running count restored by undo');

  // bust auto-advances; DAS off -> no double after split
  t = session(SET({ das: false }));
  t.say('my card nine nine dealer card five split');
  t.say('my card two');
  eq(t.act(), 'HIT', 'no DAS: split 9,2 (11) v5 -> HIT');
  t.say('my card three');
  eq(t.G.active, 0, 'hit card (14) stays on Hand 1');
  t.say('my card king');
  eq([t.G.hands[0].status, t.G.active], ['bust', 1], 'bust auto-advances');
  t.say('my card seven');
  eq(t.act(), 'STAND', 'Hand 2: 16 v5 STAND');
  t.say('next');
  eq(C.allDone(t.G), true, "'next' on last hand finishes it");
  t.say('next');
  eq(t.G.hands[1].status, 'stand', "extra 'next' is ignored");

  // surrender not allowed after split
  t = session(SET({ ls: true }));
  t.say('my card eight eight dealer ten split my card eight');
  eq(t.act(), 'SPLIT', 'Hand 1: 8,8 v10 -> resplit allowed');
  t.say('next my card queen');
  eq(t.G.active, 1, 'next moves to Hand 2');
  eq(t.act(), 'STAND', 'Hand 2: 8,Q (18) v10 STAND');
  t = session(SET({ ls: true }));
  t.say('my card eight eight dealer ten split my card six');
  eq(t.act(), 'HIT', 'split hand 14 v10 with LS -> HIT (no surrender after split)');
  t = session(SET({ ls: true, maxHands: 2 }));
  t.say('my card eight eight dealer six split my card eight');
  eq(t.act(), 'STAND', 'maxHands 2: 8,8 after split can\'t resplit -> hard 16 v6 STAND');
  t.say('split');
  eq(t.G.hands.length, 2, 'split ignored at max hands');

  // split aces: one card each, auto-advance, 21 is not blackjack
  t = session(SET());
  t.say('my card ace ace dealer card nine');
  eq(t.act(), 'SPLIT', 'A,A v9 -> SPLIT');
  t.say('split my card king');
  eq([t.G.hands[0].status, t.G.active, t.G.hands[0].cards], ['21', 1, ['A', 'K']], 'split A + K = 21 (not blackjack), auto-advance');
  t.say('my card five');
  eq([t.G.hands[1].status, C.allDone(t.G)], ['split aces', true], 'split ace gets one card then done');
  t = session(SET());
  t.say('my card ace ace dealer card six split my card ace');
  eq([t.G.hands[0].status, t.G.active], ['split aces', 1], 'resplit aces off: A,A on split ace just finishes');
  t = session(SET({ resplitAces: true }));
  t.say('my card ace ace dealer card six split my card ace');
  eq([t.G.active, t.act()], [0, 'SPLIT'], 'resplit aces on: waits with SPLIT advice');
  t.say('split');
  eq(t.G.hands.map(h => h.cards), [['A'], ['A'], ['A']], 'resplit aces -> 3 hands');
  t = session(SET({ hitSplitAces: true }));
  t.say('my card ace ace dealer card six split my card five');
  eq([t.G.active, t.act()], [0, 'HIT'], 'hit split aces on: A,5 v6 stays, HIT (no double on split aces)');

  // persistence-shaped state survives JSON round-trip
  t = session(SET());
  t.say('my card eight eight dealer six split my card three double');
  const g2 = JSON.parse(JSON.stringify(t.G));
  eq(C.handAdvice(g2, 0, SET(), 0).state, 'doubling', 'state round-trips through JSON (localStorage)');
  eq(P('done'), ['cmd:stand'], "parse 'done' -> stand");
}

// ---------------- Report ----------------
console.log(`Chart cells checked: ${chartCells} across ${CONFIGS.length} rule sets`);
if (fails.length) { console.log(fails.map(f => 'FAIL ' + f).join('\n')); }
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
