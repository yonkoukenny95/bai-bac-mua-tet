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
      code: "toiTrang",
      label: "Tới trắng",
      note: "Ví dụ: 6 đôi, 4 heo, 5 đôi liền...",
      defaultScore: 4,
      type: "perplayer",
    },
    {
      code: "thuaTrang",
      label: "Thua trắng",
      note: "Phạt người thua trắng",
      defaultScore: -4,
      type: "fixed",
    },
    {
      code: "gietNgop",
      label: "Giết ngộp",
      note: "Tới nhất mà không cho đối thủ đánh lá nào",
      defaultScore: 4,
      type: "multiplied",
    },
    {
      code: "chetNgop",
      label: "Chết ngộp",
      note: "Khi có người tới nhất mà vẫn không đánh được lá nào",
      defaultScore: -4,
      type: "fixed",
    },
    {
      code: "chatHeoDen",
      label: "Chặt heo đen/Giết ngộp heo đen",
      note: "Điểm thưởng cho người chặt",
      defaultScore: 1,
      type: "multiplied",
    },
    {
      code: "thuiHeoDen",
      label: "Thúi/Bị chặt heo đen",
      note: "Điểm phạt cho người bị thúi",
      defaultScore: -1,
      type: "multiplied",
    },
    {
      code: "chatHeoDo",
      label: "Chặt heo đỏ/Giết ngộp heo đỏ",
      note: "Điểm thưởng cho người chặt",
      defaultScore: 2,
      type: "multiplied",
    },
    {
      code: "thuiHeoDo",
      label: "Thúi/Bị chặt heo đỏ",
      note: "Điểm phạt cho người bị thúi",
      defaultScore: -2,
      type: "multiplied",
    },
    {
      code: "giepNgopTuQuy",
      label: "Giết ngộp tứ quý",
      note: "Điểm thưởng cho người giết ngộp tứ quý",
      defaultScore: 2,
      type: "multiplied",
    },
    {
      code: "thuiTuQuy",
      label: "Thúi tứ quý",
      note: "Điểm phạt cho người thúi tứ quý",
      defaultScore: -2,
      type: "multiplied",
    },
    {
      code: "gietNgopBaDoiThong",
      label: "Giết ngộp 3 đôi thông",
      note: "Điểm thưởng cho người giết ngộp 3 đôi thông",
      defaultScore: 2,
      type: "multiplied",
    },
    {
      code: "thuiBaDoiThong",
      label: "Thúi 3 đôi thông",
      note: "Điểm phạt cho người thúi 3 đôi thông",
      defaultScore: -2,
      type: "multiplied",
    },
    {
      code: "chatChong",
      label: "Chặt chồng",
      note: "Khi chặt chồng 3 đôi thông hoặc tứ quý đối với đối thủ khác",
      defaultScore: 2,
      type: "multiplied",
    },
    {
      code: "biChatChong",
      label: "Bị chặt chồng",
      note: "Khi bị đối thủ khác chặt chồng 3 đôi thông hoặc tứ quý",
      defaultScore: -2,
      type: "multiplied",
    },
    {
      code: "toiBaBich",
      label: "Tới nhất ba bích",
      note: "Tới nhất mà lá bài cuối cùng là ba bích",
      defaultScore: 4,
      type: "perplayer",
    },
    {
      code: "thuaBaBich",
      label: "Thua ba bích",
      note: "Phạt người thua mà người tới nhất lá bài cuối cùng là ba bích",
      defaultScore: -4,
      type: "fixed",
    },
  ],
};

export function createDefaultRules(playerCount = 4) {
  const cases = {};
  for (const item of TIEN_LEN_GAME.specialCases) {
    cases[item.code] = {
      enabled: true,
      score: item.type === "perplayer" ? item.defaultScore * Math.max(playerCount - 1, 1) : item.defaultScore,
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
    //Chỉ cập nhật lại điểm của các trường hợp có kiểu "perplayer", các trường hợp khác giữ nguyên điểm đã cài đặt
    if (item.type === "perplayer") {
      cases[item.code] = {
        enabled: true,
        score: item.defaultScore * Math.max(playerCount - 1, 1),
        type: item.type,
        multiplierMode: item.type === "multiplied" ? "count" : "fixed",
      };
    } else {
      cases[item.code] = {
        enabled: true,
        score: item.score || item.defaultScore,
        type: item.type,
        multiplierMode: item.type === "multiplied" ? "count" : "fixed",
      };
    }
  }

  return {
    rankingScores: { ...TIEN_LEN_GAME.rankingDefaults },
    specialCases: cases,
  };
}
