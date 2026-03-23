export const TIEN_LEN_GAME = {
  key: "tien-len-mien-nam",
  name: "Tiến Lên Miền Nam",
  minPlayers: 2,
  maxPlayers: 4,
  rankingDefaults: {
    first: 2,
    second: 1,
    third: -1,
    last: -2,
  },
  specialCases: [
    {
      code: "caseToiTrang",
      label: "Tới trắng",
      note: "Ví dụ: 6 đôi, 4 heo, 5 đôi liền...",
      defaultWinScore: 4,
      defaultLoseScore: -4,
      type: "perplayer",
    },
    {
      code: "caseGietNgop",
      label: "Giết ngộp",
      note: "Tới nhất mà không cho đối thủ đánh lá nào",
      defaultWinScore: 4,
      defaultLoseScore: -4,
      type: "multiplied",
    },
    {
      code: "caseHeoDen",
      label: "Chặt heo đen",
      note: "Điểm phạt cho người bị chặt heo đen",
      defaultWinScore: 4,
      defaultLoseScore: -4,
      type: "multiplied",
    },
    {
      code: "caseHeoDo",
      label: "Chặt heo đỏ",
      note: "Điểm thưởng cho người chặt heo đỏ",
      defaultWinScore: 4,
      defaultLoseScore: -4,
      type: "multiplied",
    },
    {
      code: "caseTuQuy",
      label: "Giết ngộp tứ quý",
      note: "Điểm thưởng cho người giết ngộp tứ quý",
      defaultWinScore: 4,
      defaultLoseScore: -4,
      type: "multiplied",
    },
    {
      code: "caseBaDoiThong",
      label: "Giết ngộp 3 đôi thông",
      note: "Điểm thưởng cho người giết ngộp 3 đôi thông",
      defaultWinScore: 4,
      defaultLoseScore: -4,
      type: "multiplied",
    },
    {
      code: "caseChatChong",
      label: "Chặt chồng",
      note: "Khi chặt chồng 3 đôi thông hoặc tứ quý đối với đối thủ khác",
      defaultWinScore: 4,
      defaultLoseScore: -4,
      type: "multiplied",
    },
    {
      code: "caseToiBaBich",
      label: "Tới nhất ba bích",
      note: "Tới nhất mà lá bài cuối cùng là ba bích",
      defaultWinScore: 4,
      defaultLoseScore: -4,
      type: "perplayer",
    },
  ],
};

export function createDefaultRules(playerCount = 4) {
  const cases = {};
  for (const item of TIEN_LEN_GAME.specialCases) {
    cases[item.code] = {
      enabled: true,
      // Lưu win/lose theo từng người (không scale sẵn theo số người chơi).
      // Khi tính điểm, engine sẽ tự suy ra cách áp dụng theo `type` và/hoặc breakdown.
      winScore: item.defaultWinScore,
      loseScore: item.defaultLoseScore,
      type: item.type,
      multiplierMode: item.type === "multiplied" ? "count" : "fixed",
    };
  }

  return {
    rankingScores: { ...TIEN_LEN_GAME.rankingDefaults },
    specialCases: cases,
  };
}

export function changePlayerCount(playerCount = 4) {
  const cases = {};
  for (const item of TIEN_LEN_GAME.specialCases) {
    // Với refactor event nhóm, điểm win/lose được lưu theo "mỗi người",
    // nên đổi số người chơi không cần scale trực tiếp ở đây.
    cases[item.code] = {
      enabled: true,
      winScore: item.defaultWinScore,
      loseScore: item.defaultLoseScore,
      type: item.type,
      multiplierMode: item.type === "multiplied" ? "count" : "fixed",
    };
  }

  return {
    rankingScores: { ...TIEN_LEN_GAME.rankingDefaults },
    specialCases: cases,
  };
}
