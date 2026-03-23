import { RANK_LABELS } from '../constants.js';
import { computeRanks, getRankOptions, toNumber } from '../helpers.js';

export function calculateRound(match, roundDraft) {
  const loserCount = Math.max(toNumber(match.setup?.playerCount, 2) - 1, 1);

  // Accumulator theo từng player (cần để suy ra perplayer/matrix cross-player).
  const accByPlayer = new Map();
  for (const entry of roundDraft.entries) {
    const rankScore = entry.rank ? toNumber(match.rules.rankingScores?.[entry.rank], 0) : 0;
    const baseScore = toNumber(entry.baseScore, 0);

    accByPlayer.set(entry.playerId, {
      playerId: entry.playerId,
      rank: entry.rank || null,
      rankLabel: entry.rank ? RANK_LABELS[entry.rank] : '',
      baseScore,
      rankScore,
      specialCases: [],
      totalRoundScore: rankScore + baseScore,
    });
  }

  const applyMultiplier = (rule) => (rule.multiplierMode === 'double-count' ? 2 : 1);

  for (const entry of roundDraft.entries) {
    const attackerId = entry.playerId;
    const attackerAcc = accByPlayer.get(attackerId);
    if (!attackerAcc) continue;

    for (const draftCase of entry.specialCases || []) {
      if (!draftCase?.selected) continue;

      const rule = match.rules.specialCases?.[draftCase.code];
      if (!rule || !rule.enabled) continue;

      const side = draftCase.side === 'lose' ? 'lose' : 'win';
      const count = Math.max(1, toNumber(draftCase.count, 1));

      // Matrix: winner/attacker tick => distribute lose to specific victims.
      if (rule.type === 'multiplied' && draftCase.victimBreakdown) {
        if (side !== 'win') continue; // UI chỉ cho nhập phía win ở matrix

        const multiplier = applyMultiplier(rule);
        const attackerAdd = toNumber(rule.winScore, 0) * multiplier * count;
        attackerAcc.totalRoundScore += attackerAdd;
        attackerAcc.specialCases.push({
          code: draftCase.code,
          side: 'win',
          count,
          victimBreakdown: draftCase.victimBreakdown,
          scoreApplied: attackerAdd,
        });

        const breakdown = draftCase.victimBreakdown || {};
        for (const [victimId, victimCountRaw] of Object.entries(breakdown)) {
          const victimAcc = accByPlayer.get(victimId);
          if (!victimAcc) continue;
          const victimCount = Math.max(0, toNumber(victimCountRaw, 0));
          if (victimCount <= 0) continue;

          const victimAdd = toNumber(rule.loseScore, 0) * multiplier * victimCount;
          victimAcc.totalRoundScore += victimAdd;
          // Không ghi `specialCases` phía victim để tránh double-count khi rebuild/edit.
        }

        continue;
      }

      // Perplayer: win tick => attacker win scaled by (playerCount-1), victims get lose.
      if (rule.type === 'perplayer') {
        if (side === 'win') {
          const attackerAdd = toNumber(rule.winScore, 0) * loserCount * count;
          attackerAcc.totalRoundScore += attackerAdd;
          attackerAcc.specialCases.push({
            code: draftCase.code,
            side: 'win',
            count,
            scoreApplied: attackerAdd,
          });

          for (const victim of match.players || []) {
            if (victim.id === attackerId) continue;
            const victimAcc = accByPlayer.get(victim.id);
            if (!victimAcc) continue;

            const victimAdd = toNumber(rule.loseScore, 0) * count;
            victimAcc.totalRoundScore += victimAdd;
            // Không ghi `specialCases` phía victim để tránh double-count khi rebuild/edit.
          }
        } else {
          // Cho phép tick lose trực tiếp (vẫn có ích nếu bạn muốn nhập tay).
          const attackerAdd = toNumber(rule.loseScore, 0) * count;
          attackerAcc.totalRoundScore += attackerAdd;
          attackerAcc.specialCases.push({
            code: draftCase.code,
            side: 'lose',
            count,
            scoreApplied: attackerAdd,
          });
        }

        continue;
      }

      // Normal case (multiplied, không matrix): apply đúng side cho chính người tick.
      if (rule.type === 'multiplied') {
        const multiplier = applyMultiplier(rule);
        const base = side === 'lose' ? rule.loseScore : rule.winScore;
        const applied = toNumber(base, 0) * multiplier * count;
        attackerAcc.totalRoundScore += applied;
        attackerAcc.specialCases.push({
          code: draftCase.code,
          side,
          count,
          scoreApplied: applied,
        });
      }
    }
  }

  const entries = Array.from(accByPlayer.values());
  const totalSum = entries.reduce((sum, item) => sum + item.totalRoundScore, 0);
  return { entries, totalSum };
}

export function validateRound(match, roundResult) {
  const errors = [];
  const expectedRanks = getRankOptions(match.setup.playerCount);
  const selectedRanks = roundResult.entries.map((item) => item.rank).filter(Boolean);

  if (selectedRanks.length !== expectedRanks.length) {
    errors.push('Mỗi người chơi cần có một thứ hạng hợp lệ cho ván này.');
  }

  for (const rank of expectedRanks) {
    const count = selectedRanks.filter((item) => item === rank).length;
    if (count !== 1) {
      errors.push(`Thứ hạng "${RANK_LABELS[rank]}" phải được chọn đúng 1 lần.`);
    }
  }

  if (match.scoreMode === 'zero-sum' && roundResult.totalSum !== 0) {
    errors.push(`Ván bù trừ đang lệch ${roundResult.totalSum > 0 ? '+' : ''}${roundResult.totalSum}. Tổng điểm phải bằng 0.`);
  }

  return errors;
}

export function applyRound(match, roundResult, metadata) {
  const nextPlayers = match.players.map((player) => {
    const entry = roundResult.entries.find((item) => item.playerId === player.id);
    return entry
      ? { ...player, totalScore: player.totalScore + entry.totalRoundScore }
      : player;
  });

  const updatedMatch = {
    ...match,
    players: nextPlayers,
    rounds: [...match.rounds, {
      id: metadata.id,
      roundNumber: match.rounds.length + 1,
      createdAt: metadata.createdAt,
      entries: roundResult.entries,
      totalSum: roundResult.totalSum,
      note: metadata.note || ''
    }]
  };

  if (updatedMatch.scoreMode === 'accumulate') {
    const maxScore = Math.max(...updatedMatch.players.map((player) => player.totalScore));
    if (maxScore >= updatedMatch.setup.targetScore) {
      updatedMatch.status = {
        ...updatedMatch.status,
        thresholdReached: true,
        thresholdReachedAtRound: updatedMatch.rounds.length
      };
    }
  }

  updatedMatch.standings = computeRanks(updatedMatch.players);
  return updatedMatch;
}
