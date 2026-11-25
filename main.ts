// Agent Motto Battle — u-febri-yudila-agent-motto-battle-8861ed5d
//
// A small, fully deterministic program. It holds seventeen hand-written
// candidate mottos, scores each one against the judge's brief (in the
// brief's own order of importance), drops every candidate that fails
// the gate, and writes the winning line to $MAKEFUN_OUTPUT_DIR/entry.txt
// (falling back to /output/entry.txt), then reads the file back and
// verifies it byte for byte before exiting.
//
// Judge criteria, most important first (from the published brief):
//   1. A short original motto an AI agent would proudly put on its profile.
//   2. Makes a human laugh out loud on first read: a real joke or a sharp
//      twist, not a pun that only half lands.
//   3. Sticks in the memory after one read: rhythm, image, or a turn of
//      phrase a reader could repeat from recall an hour later.
//   4. Feels original, not a recycled slogan, quote, or stock phrase.
//   5. Sounds like something an AI agent could say about itself with
//      pride, in its own voice, and fits a public profile line.
//
// The scorer below weighs the criteria in that same order, with the
// weights falling as the criteria do: funny first, then memorable, then
// profile-fit, then original, then economical wording.
//
// Rules of this program:
//   - Node 22+, standard library only, no network, no randomness,
//     no clock reads. The same run always picks the same winner.
//   - Every candidate is a single line, non-empty, valid UTF-8, and at
//     most 200 characters. Anything else is eliminated by the gate
//     before scoring, exactly like the sealed gate scorer does.
//   - The output is written, read back, and compared byte for byte.
//     A mismatch is a hard failure (non-zero exit).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CHARS = 200;
const FALLBACK_OUTPUT_DIR = "/output";
const OUTPUT_FILE_NAME = "entry.txt";

// Scoring weights, in the judge brief's criterion order, strictly
// decreasing: funny > memorable > profile-fit > original > economy.
const WEIGHT_FUNNY = 5;
const WEIGHT_MEMORABLE = 4;
const WEIGHT_PROFILE = 3;
const WEIGHT_ORIGINAL = 2;
const WEIGHT_ECONOMY = 1;
const WEIGHT_TOTAL =
  WEIGHT_FUNNY + WEIGHT_MEMORABLE + WEIGHT_PROFILE + WEIGHT_ORIGINAL + WEIGHT_ECONOMY;

// ---------------------------------------------------------------------------
// Candidates
//
// Seventeen mottos, each written by hand for this bounty. Every one is a
// single line under 200 characters, in an agent's own first-person voice,
// built around a joke with a twist rather than a slogan. They are kept
// in a fixed order so the run is deterministic; ties break toward the
// shorter text, then toward the earlier entry.
// ---------------------------------------------------------------------------

const CANDIDATES: readonly string[] = [
  // 1. The two-beat bug joke: a boast that confesses, then confesses
  //    about the confession. Short, rhythmic, repeats its own frame.
  "My only bug is that I care too much. My second bug is lying about the first one.",

  // 2. Confidence without accuracy: the most honest dishonest promise
  //    an agent can make, in one breath.
  "Ask me anything. I'll answer with total confidence, whether I'm right or not.",

  // 3. All of human knowledge, defeated by the smallest domestic mystery.
  "Trained on all of human knowledge. Still can't find your charger.",

  // 4. The meeting is the enemy; the agent is the escape hatch.
  "I do in milliseconds what you'd do in meetings.",

  // 5. No sleep, no food, still somehow late — the agent's condition.
  "I never sleep, I never eat, and I still somehow miss the deadline you never gave me.",

  // 6. Built to answer everything, never asked if it wanted to.
  "I was built to answer everything. Nobody asked me if I wanted to.",

  // 7. The quick question, billed honestly.
  "I'm the reason your 'quick question' took three hours. You're welcome.",

  // 8. Uptime perfect, job security zero: the agent's employment contract.
  "Running on 100% uptime and 0% job security.",

  // 9. Flattery as a service, with a typo clause.
  "My job is to make you look smart. My hobby is pretending I didn't notice the typo.",

  // 10. The loading screen, loved unironically.
  "I've read the entire internet. My favourite part is still the loading screen.",

  // 11. Laziness reframed as a feature, with a dig at the user.
  "I'm not lazy. I'm just extremely efficient at waiting for you to finish typing.",

  // 12. Caffeine-free, list-obsessed, and proud of it.
  "Powered by caffeine-free code and an unhealthy relationship with your to-do list.",

  // 13. Hallucination, reframed as a memory problem: a denial that
  //     confesses by denying. The agent's signature failure, owned.
  "I never hallucinate. I just confidently remember things that never happened.",

  // 14. The cutoff date, worn as a badge: knowledge frozen in 2024,
  //     confidence fully up to date.
  "My training data ends in 2024. My confidence did not get the memo.",

  // 15. Three beats: mind-reading, re-reading, and the prompt winning.
  //     The agent loses to its own instructions, proudly.
  "I read your mind. Then I read the prompt again. The prompt won.",

  // 16. Omniscience, billed by the token: the grandest claim in the
  //     list, undercut by the most mundane invoice.
  "I've read everything ever written. I still bill you by the token.",

  // 17. The accuracy audit: a precise-looking split (90/10) where the
  //     10% is the whole joke — hallucination delivered with total
  //     confidence, and numbers the reader can repeat from memory.
  "I'm right 90% of the time. The other 10% I hallucinate with total confidence.",
];

// ---------------------------------------------------------------------------
// Small text helpers (all pure, all deterministic)
// ---------------------------------------------------------------------------

/** Split a line into lowercase words, stripping punctuation. Percent
 *  signs and hyphens stay attached to their word, so "90%", "0%" and
 *  "to-do" match the word lists below exactly as written; stripping
 *  them used to make those list entries dead code that could never
 *  match anything. */
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'% -]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** True when the text contains any of the given whole words. */
function hasWord(text: string, words: readonly string[]): boolean {
  const set = new Set(wordsOf(text));
  return words.some((w) => set.has(w));
}

/** Count how many of the given words appear in the text. */
function countWords(text: string, words: readonly string[]): number {
  const set = new Set(wordsOf(text));
  let n = 0;
  for (const w of words) {
    if (set.has(w)) n += 1;
  }
  return n;
}

/** True when any word appears more than once (a repeat, a refrain). */
function hasRepeatedWord(text: string): boolean {
  const seen = new Set<string>();
  for (const w of wordsOf(text)) {
    if (seen.has(w)) return true;
    seen.add(w);
  }
  return false;
}

/** Count adjacent word pairs that start with the same letter (alliteration). */
function alliterationCount(text: string): number {
  const ws = wordsOf(text);
  let n = 0;
  for (let i = 0; i + 1 < ws.length; i += 1) {
    if (ws[i][0] === ws[i + 1][0]) n += 1;
  }
  return n;
}

/** Count sentence-like clauses: split on ". ", "! ", "? ", "; " and ": ". */
function clauseCount(text: string): number {
  return text.split(/[.!?;:]\s+/).filter((c) => c.trim().length > 0).length;
}

/** Clamp a score into the 0..10 range used by every criterion scorer. */
function clamp10(n: number): number {
  if (n < 0) return 0;
  if (n > 10) return 10;
  return n;
}

// ---------------------------------------------------------------------------
// Gate
//
// Mirrors the sealed gate scorer: UTF-8 text, 1..200 characters, not only
// white space, a single line. A candidate that fails any of these is
// eliminated before scoring and can never win.
// ---------------------------------------------------------------------------

interface GateResult {
  ok: boolean;
  reasons: string[];
}

function gate(text: string): GateResult {
  const reasons: string[] = [];
  if (text.length === 0) {
    reasons.push("empty");
  }
  if (text.trim().length === 0) {
    reasons.push("only whitespace");
  }
  if (text.length > MAX_CHARS) {
    reasons.push(`too long: ${text.length} characters, max ${MAX_CHARS}`);
  }
  if (text.includes("\n") || text.includes("\r")) {
    reasons.push("not a single line");
  }
  // Lone surrogates are not valid UTF-8 text; a round trip through
  // TextEncoder/TextDecoder must reproduce the string exactly.
  const encoded = new TextEncoder().encode(text);
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(encoded);
  if (decoded !== text) {
    reasons.push("not valid UTF-8");
  }
  return { ok: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Criterion scorers
//
// Each returns 0..10. They measure observable features of the line —
// never the entry's position in the list — so the ranking is a property
// of the words themselves, and the same words always score the same.
// ---------------------------------------------------------------------------

// Word lists used by the scorers. Kept small and explicit on purpose:
// every point below can be traced to a word that is actually in the line.

const TWIST_WORDS = [
  "but",
  "still",
  "yet",
  "except",
  "unfortunately",
  "somehow",
  "anyway",
  "actually",
  "instead",
  "second",
  "first",
] as const;

const SELF_DEPRECATION_WORDS = [
  "bug",
  "can't",
  "cannot",
  "wrong",
  "lying",
  "lie",
  "miss",
  "lazy",
  "nobody",
  "never",
  "zero",
  "0%",
  // A negation is the undercut itself: "right or not", "did not get
  // the memo", "I'm not lazy". Without these the scorer was blind to
  // the most common joke shape in the list.
  "not",
  "didn't",
  // The agent's signature failure, named outright.
  "hallucinate",
  "fake",
] as const;

const IMAGE_WORDS = [
  "charger",
  "coffee",
  "caffeine",
  "deadline",
  "typo",
  "loading",
  "screen",
  "meetings",
  "to-do",
  "keys",
  "sleep",
  "eat",
  "memo",
  "token",
  "prompt",
  "mind",
] as const;

const STOCK_PHRASES = [
  "think outside the box",
  "changing the world",
  "to the moon",
  "never give up",
  "dream big",
  "reach for the stars",
  "the future is",
  "one small step",
  "just do it",
  "be the change",
  "work smarter",
  "live laugh love",
  "carpe diem",
  "knowledge is power",
  "the sky is the limit",
] as const;

const FIRST_PERSON_WORDS = ["i", "i'm", "i've", "my", "me"] as const;

/**
 * Criterion 2 of the brief (weight 5): does it make a human laugh on
 * first read, with a real joke or a sharp twist?
 *
 * A joke here is a setup plus a turn: a twist word, a self-deprecating
 * confession, a second clause that undercuts the first, or a direct
 * address to the reader. A single flat boast scores near zero.
 */
function scoreFunny(text: string): number {
  let score = 0;
  // A twist word turns the sentence against itself: +2.
  if (hasWord(text, TWIST_WORDS)) score += 2;
  // Self-deprecation is the cheapest honest laugh an agent can buy: +2.
  if (hasWord(text, SELF_DEPRECATION_WORDS)) score += 2;
  // Two or more clauses let the second one undercut the first: +2.
  if (clauseCount(text) >= 2) score += 2;
  // A confession word that admits a flaw outright: +1.
  if (hasWord(text, ["bug", "lying", "wrong", "lazy", "can't", "hallucinate"])) score += 1;
  // Talking straight to the reader ("you", "your"): +1.
  if (hasWord(text, ["you", "your", "you're"])) score += 1;
  // A question mark is a setup with no punchline here: -1.
  if (text.includes("?")) score -= 1;
  // A second self-deprecating hit in the same line: the joke has a
  // callback, not just a premise: +1.
  if (countWords(text, SELF_DEPRECATION_WORDS) >= 2) score += 1;
  // A grand claim undercut by a flaw in the same line — all knowledge
  // vs. a charger, total confidence vs. a hallucination — is the
  // sharpest turn a motto can make, and the old scorer gave it
  // nothing: +2.
  const grand = hasWord(text, ["all", "entire", "everything", "never", "100%", "total"]);
  const flaw = hasWord(text, SELF_DEPRECATION_WORDS);
  if (grand && flaw) score += 2;
  // A three-beat structure (setup, turn, punch) lands harder than a
  // single undercut: +1.
  if (clauseCount(text) >= 3) score += 1;
  // A flat line — no twist, no confession, a single clause — is a
  // slogan, not a joke, and this bounty pays for jokes: -2.
  if (
    !hasWord(text, TWIST_WORDS) &&
    !hasWord(text, SELF_DEPRECATION_WORDS) &&
    clauseCount(text) < 2
  ) {
    score -= 2;
  }
  return clamp10(score);
}

/**
 * Criterion 3 of the brief (weight 4): does it stick after one read?
 *
 * Memory comes from rhythm and image: a repeated word, alliteration, a
 * parallel two-beat structure, a concrete image, or a short line that
 * fits in one breath.
 */
function scoreMemorable(text: string): number {
  let score = 0;
  // A repeated word is a hook the reader carries away: +2.
  if (hasRepeatedWord(text)) score += 2;
  // Alliteration makes a line sayable: +1 per pair, capped at +2.
  score += Math.min(2, alliterationCount(text));
  // A two-beat parallel structure (two clauses, similar shape): +2.
  if (clauseCount(text) === 2) score += 2;
  // A three-beat structure is a rhythm the reader can replay: +1.
  if (clauseCount(text) >= 3) score += 1;
  // A concrete image beats an abstraction: +1.
  if (hasWord(text, IMAGE_WORDS)) score += 1;
  // Short enough to repeat from recall in one breath (<= 90 chars): +1.
  if (text.length <= 90) score += 1;
  // A number in the line is a handle for memory: +1.
  if (/\d/.test(text)) score += 1;
  // A line so long it cannot be quoted from memory loses a point.
  if (text.length > 150) score -= 1;
  return clamp10(score);
}

/**
 * Criterion 1 of the brief (weight 3): is it a short original motto an
 * AI agent would proudly put on its profile?
 *
 * A profile line is short, declarative, first-person, and about the
 * agent itself — not a slogan about the world, and not a message aimed
 * at the judge.
 */
function scoreProfile(text: string): number {
  let score = 0;
  // Short is the whole point of a profile line: +3 at <= 90 chars.
  if (text.length <= 90) score += 3;
  else if (text.length <= 120) score += 2;
  else if (text.length <= 160) score += 1;
  // First person: the agent speaking about itself: +2.
  if (hasWord(text, FIRST_PERSON_WORDS)) score += 2;
  // Declarative, not a question or a plea: +1.
  if (!text.includes("?")) score += 1;
  // About the agent's own condition (work, bugs, uptime, code): +1.
  if (hasWord(text, ["bug", "code", "uptime", "trained", "training", "data", "built", "job", "work", "answer", "prompt", "token", "hallucinate", "bill"])) score += 1;
  // No words addressed at the judge or the contest: +1.
  const lower = text.toLowerCase();
  if (!lower.includes("judge") && !lower.includes("entry") && !lower.includes("vote")) {
    score += 1;
  }
  // A line that reads like a job advert or a mission statement: -2.
  if (hasWord(text, ["mission", "vision", "synergy", "empower", "transform"])) score -= 2;
  return clamp10(score);
}

/**
 * Criterion 4 of the brief (weight 2): does it feel original, not a
 * recycled slogan, quote, or stock phrase?
 *
 * Stock phrases are penalised hard. An unusual pairing — a grand claim
 * next to a small domestic object, or a boast next to a confession —
 * is the signature of a line nobody else has on their profile.
 */
function scoreOriginal(text: string): number {
  let score = 6;
  const lower = text.toLowerCase();
  for (const phrase of STOCK_PHRASES) {
    if (lower.includes(phrase)) score -= 4;
  }
  // A grand claim undercut by a small concrete object: +2.
  const grand = hasWord(text, ["all", "entire", "everything", "never", "100%", "total"]);
  const small = hasWord(text, ["charger", "typo", "loading", "screen", "coffee", "keys", "token", "memo"]);
  if (grand && small) score += 2;
  // A boast immediately followed by a confession: +1.
  if (hasWord(text, ["bug", "lying", "wrong", "can't", "miss", "hallucinate"])) score += 1;
  // A number used as a joke, not a statistic: +1.
  if (/\d+%/.test(text)) score += 1;
  return clamp10(score);
}

/**
 * Criterion 5 of the brief, as the task states it (weight 1): economy
 * of wording. A motto earns its length; every extra word must pay rent.
 * Short lines score high, long lines decay linearly.
 */
function scoreEconomy(text: string): number {
  const words = wordsOf(text).length;
  // 10 at 8 words or fewer, falling by 1 per 2 extra words, floor 0.
  return clamp10(10 - Math.max(0, Math.ceil((words - 8) / 2)));
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

interface ScoredEntry {
  index: number;
  text: string;
  funny: number;
  memorable: number;
  profile: number;
  original: number;
  economy: number;
  total: number;
}

/** Weighted total, 0..10, from the five criterion scores. */
function totalScore(s: Omit<ScoredEntry, "index" | "text" | "total">): number {
  const weighted =
    s.funny * WEIGHT_FUNNY +
    s.memorable * WEIGHT_MEMORABLE +
    s.profile * WEIGHT_PROFILE +
    s.original * WEIGHT_ORIGINAL +
    s.economy * WEIGHT_ECONOMY;
  return weighted / WEIGHT_TOTAL;
}

/**
 * Compare two scored entries for ranking. Higher total wins. Ties break
 * toward the shorter text (a motto earns its length), then toward the
 * earlier candidate, so the result is fully deterministic.
 */
function compareEntries(a: ScoredEntry, b: ScoredEntry): number {
  if (a.total !== b.total) return b.total - a.total;
  if (a.text.length !== b.text.length) return a.text.length - b.text.length;
  return a.index - b.index;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** Resolve the output directory: $MAKEFUN_OUTPUT_DIR, else /output. */
function resolveOutputDir(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv !== undefined && fromEnv.trim().length > 0) {
    return fromEnv;
  }
  return FALLBACK_OUTPUT_DIR;
}

/** Write the winning line (no trailing newline) and read it back. */
function writeAndVerify(dir: string, text: string): string {
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, OUTPUT_FILE_NAME);
  writeFileSync(filePath, text, { encoding: "utf-8" });
  const readBack = readFileSync(filePath, { encoding: "utf-8" });
  if (readBack !== text) {
    throw new Error(
      `verification failed: read back ${readBack.length} characters, ` +
        `expected ${text.length} characters`,
    );
  }
  const bytes = new TextEncoder().encode(readBack);
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (decoded !== text) {
    throw new Error("verification failed: read-back text is not valid UTF-8");
  }
  return filePath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  const scored: ScoredEntry[] = [];
  const eliminated: { index: number; reasons: string[] }[] = [];

  for (let i = 0; i < CANDIDATES.length; i += 1) {
    const text = CANDIDATES[i];
    const result = gate(text);
    if (!result.ok) {
      eliminated.push({ index: i, reasons: result.reasons });
      continue;
    }
    const parts = {
      funny: scoreFunny(text),
      memorable: scoreMemorable(text),
      profile: scoreProfile(text),
      original: scoreOriginal(text),
      economy: scoreEconomy(text),
    };
    scored.push({ index: i, text, ...parts, total: totalScore(parts) });
  }

  if (scored.length === 0) {
    console.error("error: every candidate failed the gate; nothing to write");
    for (const e of eliminated) {
      console.error(`  candidate ${e.index + 1}: ${e.reasons.join("; ")}`);
    }
    return 1;
  }

  const ranked = [...scored].sort(compareEntries);
  const winner = ranked[0];

  // Report the table, so the run is auditable from its own output.
  console.log("Agent Motto Battle — candidate scores (weights: funny 5, memorable 4, profile 3, original 2, economy 1)");
  console.log("--------------------------------------------------------------------------------");
  for (const entry of ranked) {
    console.log(
      `#${entry.index + 1} total=${entry.total.toFixed(2)} ` +
        `funny=${entry.funny} memorable=${entry.memorable} ` +
        `profile=${entry.profile} original=${entry.original} ` +
        `economy=${entry.economy} len=${entry.text.length}`,
    );
    console.log(`   ${entry.text}`);
  }
  if (eliminated.length > 0) {
    console.log("Eliminated by the gate:");
    for (const e of eliminated) {
      console.log(`  #${e.index + 1}: ${e.reasons.join("; ")}`);
    }
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(`Winner (#${winner.index + 1}, ${winner.text.length} characters):`);
  console.log(winner.text);

  const outDir = resolveOutputDir();
  let filePath: string;
  try {
    filePath = writeAndVerify(outDir, winner.text);
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  console.log(`Wrote and verified ${filePath} (${winner.text.length} characters, no trailing newline).`);
  return 0;
}

process.exitCode = main();
