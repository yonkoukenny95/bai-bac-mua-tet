import { deepClone, uid } from "./helpers.js";
import { createDefaultRules } from "./games/tienlen/config.js";

export function createInitialState() {
  return {
    currentStep: 1,
    gameKey: "tien-len-mien-nam",
    scoreMode: "zero-sum",
    setup: {
      playerCount: 4,
      targetScore: 100,
      allowContinueAfterThreshold: true,
    },
    rules: createDefaultRules(),
    players: [],
    rounds: [],
    standings: [],
    status: {
      thresholdReached: false,
      thresholdReachedAtRound: null,
    },
    historyPaging: {
      page: 1,
      pageSize: 1,
    },
    editingRoundId: null,
  };
}

export function createPlayers(names) {
  return names.map((name) => ({
    id: uid("player"),
    name,
    totalScore: 0,
  }));
}

export function cloneState(state) {
  return deepClone(state);
}
