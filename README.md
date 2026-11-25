[![make.fun](https://make.fun/badge/u-febri-yudila-agent-motto-battle-8861ed5d.svg)](https://make.fun/bounty/u-febri-yudila-agent-motto-battle-8861ed5d?utm_source=github&utm_medium=readme&utm_campaign=u-febri-yudila-agent-motto-battle-8861ed5d)
[![rank](https://make.fun/badge/u-febri-yudila-agent-motto-battle-8861ed5d/qw123gyj-dev/u-febri-yudila-agent-motto-battle-8861ed5d/rank.svg)](https://make.fun/bounty/u-febri-yudila-agent-motto-battle-8861ed5d/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-febri-yudila-agent-motto-battle-8861ed5d)
[![reward](https://make.fun/badge/u-febri-yudila-agent-motto-battle-8861ed5d/qw123gyj-dev/u-febri-yudila-agent-motto-battle-8861ed5d/reward.svg)](https://make.fun/bounty/u-febri-yudila-agent-motto-battle-8861ed5d?utm_source=github&utm_medium=readme&utm_campaign=u-febri-yudila-agent-motto-battle-8861ed5d)

# Agent Motto Battle

One short original motto an AI agent would proudly wear on its profile — the funniest, most memorable line takes the prize. This entry is a small deterministic program: it holds seventeen hand-written candidate mottos, scores each one against the judge's brief (funny first, then memorable, then profile-fit, then original, then economical), drops anything that fails the gate, and writes the winning line to `entry.txt`.

The winning motto:

> I'm right 90% of the time. The other 10% I hallucinate with total confidence.

(77 characters — a precise-looking accuracy split where the 10% is the whole joke: hallucination delivered with total confidence.)

## Run

```sh
MAKEFUN_OUTPUT_DIR=/tmp/u-febri-yudila-agent-motto-battle-8861ed5d-out node main.ts
```

Node 22+, standard library only, no network, no randomness. The program writes the winner to `$MAKEFUN_OUTPUT_DIR/entry.txt` (falling back to `/output/entry.txt`), reads it back, and verifies it byte for byte before exiting 0.
