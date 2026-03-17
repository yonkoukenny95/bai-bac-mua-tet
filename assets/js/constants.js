export const STORAGE_KEY = "card-score-miniapp-current-match-v1";

export const STEPS = [
  { id: 1, title: "Chọn trò chơi" },
  { id: 2, title: "Số người chơi" },
  { id: 3, title: "Cài đặt chung" },
  { id: 4, title: "Ghi điểm số" },
];

export const GAME_OPTIONS = [
  {
    key: "tien-len-mien-nam",
    name: "Tiến Lên Miền Nam",
    description: "Bản đầy đủ cho MVP hiện tại.",
  },
  {
    key: "xi-dach",
    name: "Xì dách",
    description: "Sắp có trong phiên bản sau.",
    disabled: true,
  },
];

export const SCORE_MODES = [
  {
    key: "zero-sum",
    name: "Bù trừ",
    description: "Tổng điểm của một ván phải bằng 0.",
  },
  {
    key: "accumulate",
    name: "Cộng dồn",
    description: "Chơi đến khi người dẫn đầu chạm mốc kết thúc.",
  },
];

export const RANK_LABELS = {
  first: "Tới nhất",
  second: "Tới nhì",
  third: "Tới ba",
  last: "Tới bét",
};
