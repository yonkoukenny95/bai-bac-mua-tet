import { RANK_LABELS } from '../constants.js';
import { computeRanks, getRankOptions, toNumber } from '../helpers.js';

function calculateSpecialCase(caseCode, selectedCase, rules) {
  const rule = rules.specialCases[caseCode];
  if (!rule || !rule.enabled) return 0;
  const count = Math.max(1, toNumber(selectedCase.count, 1));

  if (rule.type === 'multiplied') {
    return rule.multiplierMode === 'double-count'
      ? toNumber(rule.score) * 2 * count
      : toNumber(rule.score) * count;
  }

  return toNumber(rule.score);
}

export function calculateRound(match, roundDraft) {
  const entries = roundDraft.entries.map((entry) => {
    const rankScore = entry.rank ? toNumber(match.rules.rankingScores[entry.rank], 0) : 0;
    const baseScore = toNumber(entry.baseScore, 0);

    const selectedCases = entry.specialCases
      .filter((item) => item.selected)
      .map((item) => ({
        code: item.code,
        count: Math.max(1, toNumber(item.count, 1)),
        scoreApplied: calculateSpecialCase(item.code, item, match.rules)
      }));

    const specialScore = selectedCases.reduce((sum, item) => sum + item.scoreApplied, 0);
    const totalRoundScore = rankScore + baseScore + specialScore;

    return {
      playerId: entry.playerId,
      rank: entry.rank || null,
      rankLabel: entry.rank ? RANK_LABELS[entry.rank] : '',
      baseScore,
      rankScore,
      specialCases: selectedCases,
      totalRoundScore
    };
  });

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
