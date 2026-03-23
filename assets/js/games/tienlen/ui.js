import { TIEN_LEN_GAME } from "./config.js";
import { escapeHtml, formatSignedNumber, qs, toNumber } from "../../helpers.js";

// Các event cần nhập "chặt có nạn nhân" (matrix) từ phía người chặt.
// Dựa theo code mà bạn đã đặt trong `config.js`.
const MATRIX_EVENT_CODES = new Set(["caseHeoDen", "caseHeoDo", "caseChatChong"]);

const PERPLAYER_EVENT_CODES = new Set(TIEN_LEN_GAME.specialCases.filter((item) => item.type === "perplayer").map((item) => item.code));

const MULTIPLIED_EVENT_CODES = new Set(TIEN_LEN_GAME.specialCases.filter((item) => item.type === "multiplied").map((item) => item.code));

export function getEnabledSpecialCases(rules) {
  return TIEN_LEN_GAME.specialCases.filter((item) => rules.specialCases?.[item.code]?.enabled);
}

export function renderSpecialCaseRuleTemplate(item, rule, playerCount) {
  return `
    <div class="rule-item">
      <div class="rule-item-header">
        <div>
          <div class="rule-item-title">${item.label}</div>  
        </div>
        <div class="form-check form-switch m-0">
          <input class="form-check-input" type="checkbox" data-case-enabled="${item.code}" ${rule.enabled ? "checked" : ""}>
        </div>
      </div>
      <div class="row g-2 align-items-end">
        <div class="col-6 ${item.type === "perplayer" ? "" : ""}">
          <label class="compact-label">Điểm thắng</label>
          <input
            type="number"
            class="form-control"
            ${item.type === "perplayer" ? `data-case-per-player="${item.code}"` : `data-case-win-score="${item.code}"`}
            value="${item.type === "perplayer" ? rule.winScore : rule.winScore}"
          >
        </div>
        <div class="col-6">
          <label class="compact-label">Điểm thua</label>
          <input type="number" class="form-control" data-case-lose-score="${item.code}" value="${rule.loseScore}">
        </div>
        <div class="col-6 ${item.type === "multiplied" ? "" : "d-none"}">
          <label class="compact-label">Kiểu nhân</label>
          <select class="form-select" data-case-multiplier="${item.code}">
            <option value="count" ${rule.multiplierMode === "count" ? "selected" : ""}>x số lần</option>
            <option value="double-count" ${rule.multiplierMode === "double-count" ? "selected" : ""}>x2 x số lần</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

export function recalcPerPlayerCaseScores({ playerCount, root = document }) {
  // Trong refactor event nhóm, `winScore/loseScore` được lưu theo "mỗi người",
  // nên không cần scale lại theo số lượng người chơi ở bước setup.
}

export function applySpecialCasesRulesFromDom({ rules, root = document }) {
  TIEN_LEN_GAME.specialCases.forEach((item) => {
    const enabledInput = qs(`[data-case-enabled="${item.code}"]`, root);
    const winInput = item.type === "perplayer" ? qs(`[data-case-per-player="${item.code}"]`, root) : qs(`[data-case-win-score="${item.code}"]`, root);
    const loseInput = qs(`[data-case-lose-score="${item.code}"]`, root);
    if (!enabledInput || !winInput || !loseInput) return;

    rules.specialCases[item.code].enabled = enabledInput.checked;
    rules.specialCases[item.code].winScore = toNumber(winInput.value, 0);
    rules.specialCases[item.code].loseScore = toNumber(loseInput.value, 0);

    if (item.type === "multiplied") {
      const multiplierSelect = qs(`[data-case-multiplier="${item.code}"]`, root);
      rules.specialCases[item.code].multiplierMode = multiplierSelect?.value || "count";
    }
  });
}

export function renderSpecialCasesForPlayer({ playerId, players = [], caseOptions, selectedCases }) {
  return caseOptions.length
    ? caseOptions
        .map((item) => {
          const matchedCase = selectedCases.find((x) => x.code === item.code);
          let isChecked = !!matchedCase;
          const side = matchedCase?.side || "win";

          // Event "chặt có nạn nhân" -> chỉ nhập phía người chặt + matrix nạn nhân.
          if (MATRIX_EVENT_CODES.has(item.code)) {
            isChecked = matchedCase?.side === "win";
            const victimBreakdown = matchedCase?.victimBreakdown || {};
            const victimList = players.filter((p) => p.id !== playerId);

            return `
              <div class="case-item ${isChecked ? "active" : ""}" data-case-row="${playerId}_${item.code}">
                <div class="case-head">
                  <div>
                    <div class="fw-semibold">${item.label}</div>
                    <div class="mini-note">${item.note}</div>
                  </div>
                  <div class="form-check form-switch m-0">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      data-case-check="${playerId}"
                      data-case-code="${item.code}"
                      ${isChecked ? "checked" : ""}
                    >
                  </div>
                </div>

                <div
                  class="${isChecked ? "" : "d-none"} case-victim-matrix"
                  data-case-victims-wrap="${playerId}_${item.code}"
                >
                  <div class="case-extra mt-2">
                    <label class="compact-label">Chọn nạn nhân</label>
                    <div class="victim-matrix-grid">
                      ${victimList
                        .map((victim) => {
                          const victimCount = toNumber(victimBreakdown?.[victim.id], 0);
                          return `
                            <div class="victim-row">
                              <span class="victim-name">${escapeHtml(victim.name)}</span>
                              <input
                                type="number"
                                class="form-control form-control-sm"
                                min="0"
                                value="${victimCount}"
                                data-case-victim="${victim.id}"
                                data-case-count="${playerId}"
                                data-case-code="${item.code}"
                                data-case-min="0"
                              >
                            </div>
                          `;
                        })
                        .join("")}
                    </div>
                  </div>
                </div>
              </div>
            `;
          }

          // Event dạng perplayer -> chỉ cần chọn phía win (engine sẽ suy ra victims ở calculateRound).
          if (item.type === "perplayer") {
            isChecked = matchedCase?.side === "win";
            return `
              <div class="case-item" data-case-row="${playerId}_${item.code}">
                <div class="case-head">
                  <div>
                    <div class="fw-semibold">${item.label}</div>
                    <div class="mini-note">${item.note}</div>
                  </div>
                  <div class="form-check form-switch m-0">
                    <input
                      class="form-check-input"
                      type="checkbox"
                      data-case-check="${playerId}"
                      data-case-code="${item.code}"
                      ${isChecked ? "checked" : ""}
                    >
                  </div>
                </div>
              </div>
            `;
          }

          // Event multiplied thường -> user chọn win/lose và số lần.
          const appliedCount = matchedCase?.count || 1;
          return `
            <div class="case-item ${isChecked ? "active" : ""}" data-case-row="${playerId}_${item.code}">
              <div class="case-head">
                <div>
                  <div class="fw-semibold">${item.label}</div>
                  <div class="mini-note">${item.note}</div>
                </div>
                <div class="form-check form-switch m-0">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    data-case-check="${playerId}"
                    data-case-code="${item.code}"
                    ${isChecked ? "checked" : ""}
                  >
                </div>
              </div>
              <div class="case-extra mt-2">
                <div class="row g-2 align-items-end">
                  <div class="col-6">
                    <label class="compact-label">Trạng thái</label>
                    <select class="form-select form-select-sm" data-case-side="${playerId}" data-case-code="${item.code}">
                      <option value="win" ${side === "win" ? "selected" : ""}>Win</option>
                      <option value="lose" ${side === "lose" ? "selected" : ""}>Lose</option>
                    </select>
                  </div>
                  <div class="col-6">
                    <label class="compact-label">Số lần áp dụng</label>
                    <input
                      type="number"
                      class="form-control"
                      min="1"
                      value="${appliedCount}"
                      data-case-count="${playerId}"
                      data-case-code="${item.code}"
                      data-case-min="1"
                    >
                  </div>
                </div>
              </div>
            </div>
          `;
        })
        .join("")
    : '<div class="empty-state">Không có case đặc biệt nào đang bật trong setup.</div>';
}

export function calculateTempScoreForPlayer({ playerId, container, state }) {
  const scoreInput = container.querySelector(`[data-temp-score="${playerId}"]`);

  const rankInput = container.querySelector(`[data-rank-input="${playerId}"]`);
  const rank = rankInput?.value;
  const rankScore = rank ? toNumber(state.rules.rankingScores?.[rank], 0) : 0;

  const playerCount = Math.max(toNumber(state.setup?.playerCount, 2), 2);
  const loserCount = Math.max(playerCount - 1, 1);

  // Tính đặc biệt cross-player (perplayer + matrix cần suy ra phía còn lại).
  const specialScoreByPlayer = new Map((state.players || []).map((p) => [p.id, 0]));
  const addTo = (id, delta) => specialScoreByPlayer.set(id, (specialScoreByPlayer.get(id) || 0) + delta);

  // 1) perplayer: nếu ai tick => người đó win, tất cả người còn lại đều bị lose.
  for (const code of PERPLAYER_EVENT_CODES) {
    const rule = state.rules.specialCases?.[code];
    if (!rule || !rule.enabled) continue;

    for (const attacker of state.players || []) {
      const checked = container.querySelector(`[data-case-check="${attacker.id}"][data-case-code="${code}"]`)?.checked;
      if (!checked) continue;

      addTo(attacker.id, toNumber(rule.winScore, 0) * loserCount);
      for (const victim of state.players || []) {
        if (victim.id === attacker.id) continue;
        addTo(victim.id, toNumber(rule.loseScore, 0));
      }
    }
  }

  // 2) matrix: tick từ phía người chặt, phân phối lose theo breakdown nạn nhân.
  for (const code of MATRIX_EVENT_CODES) {
    const rule = state.rules.specialCases?.[code];
    if (!rule || !rule.enabled) continue;

    const multiplier = rule.multiplierMode === "double-count" ? 2 : 1;

    for (const attacker of state.players || []) {
      const checked = container.querySelector(`[data-case-check="${attacker.id}"][data-case-code="${code}"]`)?.checked;
      if (!checked) continue;

      let totalCount = 0;
      const victimCounts = new Map();
      for (const victim of state.players || []) {
        if (victim.id === attacker.id) continue;
        const input = container.querySelector(`[data-case-count="${attacker.id}"][data-case-victim="${victim.id}"][data-case-code="${code}"]`);
        const c = input ? Math.max(0, toNumber(input.value, 0)) : 0;
        victimCounts.set(victim.id, c);
        totalCount += c;
      }

      if (totalCount <= 0) continue;

      addTo(attacker.id, toNumber(rule.winScore, 0) * multiplier * totalCount);
      for (const [victimId, c] of victimCounts.entries()) {
        if (c <= 0) continue;
        addTo(victimId, toNumber(rule.loseScore, 0) * multiplier * c);
      }
    }
  }

  // 3) multiplied thường (không matrix): đọc win/lose + count trực tiếp cho từng người.
  for (const p of state.players || []) {
    for (const item of TIEN_LEN_GAME.specialCases) {
      if (item.type !== "multiplied" || MATRIX_EVENT_CODES.has(item.code)) continue;

      const rule = state.rules.specialCases?.[item.code];
      if (!rule || !rule.enabled) continue;

      const checked = container.querySelector(`[data-case-check="${p.id}"][data-case-code="${item.code}"]`)?.checked;
      if (!checked) continue;

      const sideSelect = container.querySelector(`[data-case-side="${p.id}"][data-case-code="${item.code}"]`);
      const side = sideSelect?.value || "win";

      const countInput = container.querySelector(`[data-case-count="${p.id}"][data-case-code="${item.code}"]:not([data-case-victim])`);
      const count = Math.max(1, toNumber(countInput?.value, 1));
      const multiplier = rule.multiplierMode === "double-count" ? 2 : 1;

      const base = side === "lose" ? rule.loseScore : rule.winScore;
      addTo(p.id, toNumber(base, 0) * multiplier * count);
    }
  }

  const score = rankScore + (specialScoreByPlayer.get(playerId) || 0);
  if (scoreInput) scoreInput.value = formatSignedNumber(score);
}

export function buildRoundSpecialCasesDraftForPlayer({ playerId, container, rules }) {
  const enabledRules = rules.specialCases || {};
  const draft = [];

  // perplayer: chỉ cần tick phía win; engine sẽ tự suy ra victims.
  for (const code of PERPLAYER_EVENT_CODES) {
    const rule = enabledRules[code];
    if (!rule?.enabled) continue;

    const checked = container.querySelector(`[data-case-check="${playerId}"][data-case-code="${code}"]`)?.checked;
    if (!checked) continue;

    draft.push({ code, selected: true, side: "win", count: 1 });
  }

  // matrix: chỉ tick phía người chặt (win) + breakdown nạn nhân.
  for (const code of MATRIX_EVENT_CODES) {
    const rule = enabledRules[code];
    if (!rule?.enabled) continue;

    const checked = container.querySelector(`[data-case-check="${playerId}"][data-case-code="${code}"]`)?.checked;
    if (!checked) continue;

    const victimBreakdown = {};
    let totalCount = 0;

    // Vì hàm này không nhận `state`, ta lấy players từ DOM dựa trên các data-case-victims-wrap bên trong.
    // Tuy nhiên app.js truyền vào container chính là roundDialog đã render sẵn players,
    // nên ta có thể lấy victim bằng việc dò tất cả input matrix thuộc attackerId.
    const countInputs = container.querySelectorAll(`[data-case-count="${playerId}"][data-case-victim][data-case-code="${code}"]`);
    countInputs.forEach((input) => {
      const victimId = input.dataset.caseVictim;
      const count = Math.max(0, toNumber(input.value, 0));
      if (!victimId || count <= 0) return;
      victimBreakdown[victimId] = (victimBreakdown[victimId] || 0) + count;
      totalCount += count;
    });

    if (totalCount > 0) {
      draft.push({ code, selected: true, side: "win", count: totalCount, victimBreakdown });
    }
  }

  // multiplied thường: tick + chọn side + nhập count.
  TIEN_LEN_GAME.specialCases
    .filter((item) => item.type === "multiplied" && !MATRIX_EVENT_CODES.has(item.code))
    .forEach((item) => {
      const rule = enabledRules[item.code];
      if (!rule?.enabled) return;

      const checked = container.querySelector(`[data-case-check="${playerId}"][data-case-code="${item.code}"]`)?.checked;
      if (!checked) return;

      const sideSelect = container.querySelector(`[data-case-side="${playerId}"][data-case-code="${item.code}"]`);
      const side = sideSelect?.value || "win";

      const countInput = container.querySelector(`[data-case-count="${playerId}"][data-case-code="${item.code}"]:not([data-case-victim])`);
      const count = Math.max(1, toNumber(countInput?.value, 1));
      draft.push({ code: item.code, selected: true, side, count });
    });

  return draft;
}

export function renderSpecialCasesSummaryForRoundEntry({ entrySpecialCases, state }) {
  return entrySpecialCases.length
    ? entrySpecialCases
        .map((item) => {
          const gameCase = TIEN_LEN_GAME.specialCases.find((x) => x.code === item.code);
          const label = gameCase?.label || item.code;

          const rule = state.rules.specialCases?.[item.code];
          const multiplier = rule?.multiplierMode === "double-count" ? 2 : 1;
          const base = item.side === "lose" ? rule?.loseScore : rule?.winScore;
          const count = Math.max(1, toNumber(item.count, 1));

          const scoreApplied = typeof item.scoreApplied === "number" ? item.scoreApplied : toNumber(base, 0) * multiplier * count;
          const victimBreakdownText = Object.entries(item.victimBreakdown || {})
            .map(([victimId, count]) => `${state.players.find((p) => p.id === victimId)?.name}: ${count}`)
            .join(", ");

          return `<p class="small mb-0 text-danger">${escapeHtml(label)} ${scoreApplied} (${victimBreakdownText})</p>`;
        })
        .join("")
    : `<span class="case-empty"></span>`;
}
