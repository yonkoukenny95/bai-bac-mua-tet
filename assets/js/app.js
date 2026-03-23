import { GAME_OPTIONS, RANK_LABELS, SCORE_MODES, STEPS } from "./constants.js";
import { applyRound, calculateRound, validateRound } from "./engine/score-engine.js";
import { computeRanks, escapeHtml, formatSignedNumber, getRankOptions, nowIso, qs, qsa, toNumber, trimText, uid } from "./helpers.js";
import { TIEN_LEN_GAME, createDefaultRules, changePlayerCount } from "./games/tienlen/config.js";
import { clearState, loadState, saveState } from "./storage.js";
import { createInitialState, createPlayers } from "./state.js";

let state = loadState() || createInitialState();
state.standings = computeRanks(state.players || []);

const stepperSection = qs("#stepperSection");
const contentSection = qs("#contentSection");
const toastHost = qs("#toastHost");
const roundDialog = qs("#roundDialog");
const summaryDialog = qs("#summaryDialog");
const confirmDialog = qs("#confirmDialog");
const installBtn = qs("#installBtn");
let deferredPrompt = null;

function persist() {
  saveState(state);
}

function updateState(updater) {
  state = updater(state);
  state.standings = computeRanks(state.players || []);
  persist();
  render();
}

function showToast(message) {
  const node = document.createElement("div");
  node.className = "toast-message";
  node.textContent = message;
  toastHost.appendChild(node);
  setTimeout(() => node.remove(), 2600);
}

function renderStepper() {
  stepperSection.innerHTML = `
    <div class="section-title mb-2">Thiết lập trận</div>
    <div class="step-badges">
      ${STEPS.map((step) => {
        const stateClass = state.currentStep === step.id ? "active" : state.currentStep > step.id ? "done" : "";
        return `<div class="step-badge ${stateClass}"><strong>B${step.id}</strong><br>${step.title}</div>`;
      }).join("")}
    </div>
  `;
}

function renderGameStep() {
  contentSection.innerHTML = `
    <section class="section-card">
      <h2 class="section-title">B1 · Chọn thể loại chơi</h2>
      <p class="section-subtitle">Bản hiện tại hoàn chỉnh cho Tiến Lên Miền Nam. Các game khác để sẵn chỗ cho lần mở rộng sau.</p>
      <div class="option-grid two-col">
        ${GAME_OPTIONS.map(
          (game) => `
          <button type="button" class="option-card text-start ${state.gameKey === game.key ? "selected" : ""} ${game.disabled ? "disabled" : ""}" data-game-key="${game.key}" ${game.disabled ? "disabled" : ""}>
            <h3>${game.name}</h3>
            <p>${game.description}</p>
          </button>
        `,
        ).join("")}
      </div>
      <div class="action-row mt-4">
        <button id="nextFromGame" class="btn btn-primary px-4">Tiếp tục</button>
      </div>
    </section>
  `;

  qsa("[data-game-key]").forEach((button) => {
    button.addEventListener("click", () => {
      qsa("[data-game-key]").forEach((x) => x.classList.remove("selected"));
      button.classList.add("selected");
      state.gameKey = button.dataset.gameKey;
    });
  });

  qs("#nextFromGame").addEventListener("click", () => {
    updateState((prev) => ({ ...prev, currentStep: 2 }));
  });
}

function specialCaseRuleTemplate(item, rule) {
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
        <div class="col-6 ${item.type === "perplayer" ? "" : "d-none"}">
          <label class="compact-label">Thắng 1 người</label>
          <input
            type="number"
            class="form-control"
            data-case-per-player="${item.code}"
            value="${rule.score / Math.max(state.setup.playerCount - 1, 1)}"
          >
        </div>
        <div class="col-6">
          <label class="compact-label">Điểm áp dụng</label>
          <input type="number" class="form-control" 
            data-case-score="${item.code}" 
            value="${rule.score}"
            ${item.type === "perplayer" ? "readonly" : ""}
          >
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

function recalcPerPlayerCaseScores() {
  const loserCount = Math.max((state.setup.playerCount || 2) - 1, 1);

  TIEN_LEN_GAME.specialCases
    .filter((item) => item.type === "perplayer")
    .forEach((item) => {
      const perPlayerInput = qs(`[data-case-per-player="${item.code}"]`);
      const totalScoreInput = qs(`[data-case-score="${item.code}"]`);

      if (!perPlayerInput || !totalScoreInput) return;

      const perPlayerScore = toNumber(perPlayerInput.value, 0);
      totalScoreInput.value = perPlayerScore * loserCount;
    });
}

function renderRulesStep() {
  const ranking = state.rules.rankingScores;
  const rankOptions = getRankOptions(state.setup.playerCount);

  contentSection.innerHTML = `
    <section class="section-card">
      <h2 class="section-title">B3 · Chọn kiểu tính điểm và cấu hình luật</h2>
      <div class="option-grid two-col mb-4">
        ${SCORE_MODES.map(
          (mode) => `
          <button type="button" class="option-card text-start ${state.scoreMode === mode.key ? "selected" : ""}" data-score-mode="${mode.key}">
            <h3>${mode.name}</h3>
            <p>${mode.description}</p>
          </button>
        `,
        ).join("")}
      </div>

      <div class="row g-3 mb-4">
        <div class="col-sm-6 ${state.scoreMode === "accumulate" ? "" : "d-none"}" id="targetScoreWrap">
          <label class="compact-label">Mốc kết thúc game</label>
          <input id="targetScoreInput" type="number" class="form-control" min="1" value="${state.setup.targetScore}">
        </div>
      </div>

      <div class="section-title mb-2">Điểm theo thứ hạng</div>
      <div class="row g-3 mb-4">
        <div class="col-3 col-md-3">
          <label class="compact-label">Tới nhất</label>
          <input type="number" class="form-control" id="rankFirst" value="${ranking.first}">
        </div>
        ${
          rankOptions.includes("second")
            ? `
        <div class="col-3 col-md-3">
          <label class="compact-label">Tới nhì</label>
          <input type="number" class="form-control" id="rankSecond" value="${ranking.second}">
        </div>`
            : ""
        }
        ${
          rankOptions.includes("third")
            ? `
        <div class="col-3 col-md-3">
          <label class="compact-label">Tới ba</label>
          <input type="number" class="form-control" id="rankThird" value="${ranking.third}">
        </div>`
            : ""
        }
        <div class="col-3 col-md-3">
          <label class="compact-label">Tới bét</label>
          <input type="number" class="form-control" id="rankLast" value="${ranking.last}">
        </div>
      </div>

      <div class="section-title mb-2">Trường hợp đặc biệt</div>
      <p class="section-subtitle">Bạn có thể bật hoặc tắt từng trường hợp, gán điểm riêng, và chọn kiểu nhân cho case chặt chồng.</p>
      <div class="rule-grid mb-4">
        ${TIEN_LEN_GAME.specialCases.map((item) => specialCaseRuleTemplate(item, state.rules.specialCases[item.code])).join("")}
      </div>

      <div class="action-row">
        <button id="backToPlayers" class="btn btn-outline-secondary px-4">Quay lại</button>
        <button id="resetRules" class="btn btn-outline-dark px-4">Mặc định</button>
        <button id="nextFromRules" class="btn btn-primary px-4">Tiếp tục</button>
      </div>
    </section>
  `;

  qsa("[data-score-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      qsa("[data-score-mode]").forEach((x) => x.classList.remove("selected"));
      button.classList.add("selected");
      if (button.dataset.scoreMode === state.scoreMode) return;
      updateState((prev) => ({ ...prev, scoreMode: button.dataset.scoreMode }));
    });
  });
  recalcPerPlayerCaseScores();
  qsa("[data-case-per-player]").forEach((input) => {
    input.addEventListener("input", () => {
      recalcPerPlayerCaseScores();
    });
  });
  qs("#backToPlayers").addEventListener("click", () => updateState((prev) => ({ ...prev, currentStep: 2 })));
  qs("#resetRules").addEventListener("click", () => {
    updateState((prev) => ({ ...prev, rules: createDefaultRules(state.setup.playerCount), setup: { ...prev.setup, targetScore: 100 } }));
    showToast("Đã đưa cấu hình luật về mặc định.");
  });

  qs("#nextFromRules").addEventListener("click", () => {
    const nextRules = structuredClone(state.rules);
    nextRules.rankingScores.first = toNumber(qs("#rankFirst").value, 0);
    nextRules.rankingScores.second = qs("#rankSecond") ? toNumber(qs("#rankSecond").value, 0) : 0;
    nextRules.rankingScores.third = qs("#rankThird") ? toNumber(qs("#rankThird").value, 0) : 0;
    nextRules.rankingScores.last = toNumber(qs("#rankLast").value, 0);

    TIEN_LEN_GAME.specialCases.forEach((item) => {
      nextRules.specialCases[item.code].enabled = qs(`[data-case-enabled="${item.code}"]`).checked;
      nextRules.specialCases[item.code].score = toNumber(qs(`[data-case-score="${item.code}"]`).value, 0);
      if (item.type === "multiplied") {
        nextRules.specialCases[item.code].multiplierMode = qs(`[data-case-multiplier="${item.code}"]`).value;
      }
    });

    updateState((prev) => ({
      ...prev,
      currentStep: 4,
      scoreMode: qsa("[data-score-mode].selected")[0]?.dataset.scoreMode || prev.scoreMode,
      setup: {
        ...prev.setup,
        targetScore: toNumber(qs("#targetScoreInput")?.value, prev.setup.targetScore),
      },
      rules: nextRules,
    }));
  });
}

function renderPlayerCountStep() {
  const playerCounts = Array.from({ length: TIEN_LEN_GAME.maxPlayers - TIEN_LEN_GAME.minPlayers + 1 }, (_, idx) => TIEN_LEN_GAME.minPlayers + idx);

  const hasSelectedCount = Number.isInteger(state.setup.playerCount) && state.setup.playerCount >= TIEN_LEN_GAME.minPlayers;

  const inputs = hasSelectedCount
    ? Array.from({ length: state.setup.playerCount }, (_, index) => {
        const currentValue = state.players[index]?.name || "";
        return `
          <div class="mb-3">
            <label class="form-label small text-muted mb-1">Người chơi ${index + 1}</label>
            <input
              type="text"
              maxlength="24"
              class="form-control"
              data-player-name="${index}"
              value="${escapeHtml(currentValue)}"
              placeholder="Ví dụ: An"
            >
          </div>
        `;
      }).join("")
    : "";

  contentSection.innerHTML = `
    <section class="card shadow-sm border-0">
      <div class="card-body p-3 p-md-4">
        <h2 class="h5 mb-2">B2 · Thiết lập người chơi</h2>
        <p class="text-muted mb-3">
          Chọn số người chơi rồi nhập tên ngay bên dưới.
        </p>

        <div class="d-flex flex-nowrap gap-2 overflow-auto pb-1 mb-3">
          ${playerCounts
            .map(
              (count) => `
                <button
                  type="button"
                  class="btn ${state.setup.playerCount === count ? "btn-primary" : "btn-outline-secondary"} flex-shrink-0 px-3"
                  data-player-count="${count}"
                >
                  ${count} người
                </button>
              `,
            )
            .join("")}
        </div>

        <div class="collapse ${hasSelectedCount ? "show" : ""}" id="playerNamesCollapse">
          <div class="d-flex align-items-center justify-content-between mb-3">
              <h3 class="h6 mb-0">Nhập tên người chơi</h3>
              <span class="badge text-bg-secondary">${state.setup.playerCount || 0} người</span>
            </div>

            <div class="mb-2">
              ${inputs}
            </div>
        </div>

        <div class="d-flex justify-content-between mt-4">
          <button id="backToGame" class="btn btn-outline-secondary px-4">Quay lại</button>
          <button type="button" class="btn btn-primary" id="startMatchBtn">
            Tiếp theo
          </button>
        </div>
        
      </div>
    </section>
  `;

  qsa("[data-player-count]").forEach((button) => {
    button.addEventListener("click", () => {
      const count = Number(button.dataset.playerCount);
      updateState((prev) => ({
        ...prev,
        rules: changePlayerCount(count),
        setup: {
          ...prev.setup,
          playerCount: count,
        },
      }));
    });
  });

  qs("#backToGame").addEventListener("click", () => updateState((prev) => ({ ...prev, currentStep: 1 })));
  qs("#backToRules")?.addEventListener("click", () => updateState((prev) => ({ ...prev, currentStep: 3 })));

  qs("#collapsePlayerNamesBtn")?.addEventListener("click", () => {
    const collapseElement = document.getElementById("playerNamesCollapse");
    if (!collapseElement) return;

    const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseElement);
    bsCollapse.hide();
  });

  qs("#startMatchBtn")?.addEventListener("click", () => {
    const names = qsa("[data-player-name]").map((input) => trimText(input.value));

    if (names.some((name) => !name)) {
      showToast("Tên người chơi không được để trống.");
      return;
    }

    const dedupe = new Set(names.map((item) => item.toLowerCase()));
    if (dedupe.size !== names.length) {
      showToast("Tên người chơi không được trùng nhau.");
      return;
    }
    updateState((prev) => ({
      ...prev,
      currentStep: 3,
      players: createPlayers(names),
      rounds: [],
      standings: [],
      status: { thresholdReached: false, thresholdReachedAtRound: null },
    }));
  });

  if (hasSelectedCount) {
    const collapseElement = document.getElementById("playerNamesCollapse");
    if (collapseElement) {
      const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseElement, {
        toggle: false,
      });
      bsCollapse.show();

      const firstInput = collapseElement.querySelector('[data-player-name="0"]');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 50);
      }
    }
  }
}

function renderStandingsList(players = state.standings) {
  if (!players.length) {
    return '<div class="empty-state">Chưa có điểm nào được ghi.</div>';
  }

  return `
    <div class="summary-list">
      ${players
        .map(
          (player, index) => `
        <div class="summary-item">
          <div class="d-flex align-items-center gap-3">
            <span class="rank-pill">${index + 1}</span>
            <div>
              <div class="player-name">${escapeHtml(player.name)}</div>
              <div class="player-meta">${index === 0 ? "Đang dẫn đầu" : `Hạng ${index + 1}`}</div>
            </div>
          </div>
          <div class="score-big">${formatSignedNumber(player.totalScore)}</div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderRecentRounds() {
  const rounds = [...state.rounds].reverse();

  if (!rounds.length) {
    return '<div class="empty-state">Chưa có ván nào.</div>';
  }

  const page = state.historyPaging?.page || 1;
  const pageSize = state.historyPaging?.pageSize || 1;
  const totalItems = rounds.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const pagedRounds = rounds.slice(startIndex, startIndex + pageSize);

  return `
    <div class="recent-rounds">
      ${pagedRounds
        .map((round) => {
          return `
            <article class="recent-round">
              <div class="d-flex justify-content-between align-items-center mb-2"> 
                <h4 class="round-title mb-0">Ván ${round.roundNumber}</h4> 
                <button type="button" class="btn btn-sm btn-outline-secondary" data-action="edit-round" data-round-id="${round.id}" > Sửa </button> 
              </div>
              <div class="round-table-wrapper">
                <table class="round-table">
                  <thead>
                    <tr>
                      <th>Tên</th>
                      <th>Điểm</th>
                      <th>Sự kiện</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${round.entries
                      .map((entry) => {
                        const player = state.players.find((item) => item.id === entry.playerId);

                        const specialCases = entry.specialCases.length
                          ? `
                            ${entry.specialCases
                              .map((item) => {
                                const gameCase = TIEN_LEN_GAME.specialCases.find((x) => x.code === item.code);

                                const label = gameCase?.label || item.code;
                                const score = state.rules.specialCases[item.code]?.score || 0;
                                const count = item.count > 1 ? ` x${item.count}` : "";

                                return `<p class="small mb-0 text-danger">${escapeHtml(label)} (${score}) ${count}</p>`;
                              })
                              .join("")}
                        `
                          : `<span class="case-empty"></span>`;

                        return `
                          <tr>
                            <td>
                              <div class="round-player-name">
                                ${escapeHtml(player?.name || "Người chơi")}
                              </div>
                            </td>

                            <td class="round-score ${entry.totalRoundScore > 0 ? "positive" : "negative"}">
                              ${formatSignedNumber(entry.totalRoundScore)}
                            </td>

                            <td class="round-cases">
                            
                              ${entry.rankLabel ? `<span class="rank-badge">${escapeHtml(entry.rankLabel)} (${entry.rankScore})</span> ` : ""}
                              ${specialCases}
                            </td>
                          </tr>
                        `;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
    <div class="history-pagination">
        <button type="button" class="history-page-btn" data-action="history-prev" ${safePage <= 1 ? "disabled" : ""} >
          ← Ván sau
        </button>

        <div class="history-page-info">
          Trang ${safePage}/${totalPages}
        </div>

        <button type="button" class="history-page-btn" data-action="history-next" ${safePage >= totalPages ? "disabled" : ""} >
          Ván trước →
        </button>
      </div>
  `;
}

function bindHistoryPagingEvents(container) {
  if (!container) return;
  const prevBtn = container.querySelector('[data-action="history-prev"]');
  const nextBtn = container.querySelector('[data-action="history-next"]');

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      const currentPage = state.historyPaging?.page || 1;
      if (currentPage > 1) {
        state.historyPaging.page = currentPage - 1;
        renderScoreboardStep();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const rounds = [...state.rounds].reverse();
      const pageSize = state.historyPaging?.pageSize || 1;
      const totalPages = Math.max(1, Math.ceil(rounds.length / pageSize));
      const currentPage = state.historyPaging?.page || 1;

      if (currentPage < totalPages) {
        state.historyPaging.page = currentPage + 1;
        renderScoreboardStep();
      }
    });
  }
}

function renderScoreboardStep() {
  const leader = state.standings[0];
  const thresholdText = state.scoreMode === "accumulate" ? `Mốc kết thúc: ${state.setup.targetScore}` : "Mode bù trừ";

  contentSection.innerHTML = `
    <section class="section-card">
      <div class="scoreboard-top mb-3">
        <div>
          <h2 class="section-title mb-1">Bảng điểm Tiến Lên Miền Nam</h2>
          <p class="section-subtitle mb-0">${state.scoreMode === "zero-sum" ? "Bù trừ" : "Cộng dồn"} · ${thresholdText}</p>
        </div>
        <div class="action-row">
          <button id="editSetupBtn" class="btn btn-outline-secondary">Sửa setup</button>
          <button id="resetMatchBtn" class="btn btn-outline-danger">Reset trận</button>
        </div>
      </div>

      ${state.status.thresholdReached ? '<div class="alert-inline warn mb-3">Đã chạm mốc kết thúc. Bạn vẫn có thể nhập tiếp nếu muốn.</div>' : ""}

      <div class="row g-3">
        <div class="col-lg-6">
          <div class="player-card h-100">
            <div class="section-title mb-2">Tổng kết nhanh</div>
            ${renderStandingsList()}
          </div>
        </div>
        <div class="col-lg-6">
          <div class="player-card h-100">
            <div class="section-title mb-2">Lịch sử ván</div>
            ${renderRecentRounds()}
          </div>
        </div>
      </div>

      <div class="sticky-actions mt-4">
        <div class="action-wrap">
          <button id="addRoundBtn" class="btn btn-primary btn-lg flex-fill">Ghi điểm ván</button>
          <button id="showSummaryBtn" class="btn btn-outline-dark btn-lg flex-fill">Tổng kết điểm</button>
        </div>
      </div>
    </section>
  `;

  qs("#editSetupBtn").addEventListener("click", () => updateState((prev) => ({ ...prev, currentStep: 3 })));
  qs("#resetMatchBtn").addEventListener("click", openResetConfirm);
  qs("#addRoundBtn").addEventListener("click", () => openRoundDialog(null));
  qs("#showSummaryBtn").addEventListener("click", () => openSummaryDialog(false));
  bindHistoryPagingEvents(qs(".history-pagination"));
  qsa('[data-action="edit-round"]', contentSection).forEach((button) => {
    button.addEventListener("click", () => {
      const roundId = button.dataset.roundId;
      openRoundDialog(roundId);
    });
  });
  if (state.status.thresholdReached && !summaryDialog.open) {
    openSummaryDialog(true);
  }
}

function buildRoundDialog(editingRound = null) {
  const rankOptions = getRankOptions(state.setup.playerCount);
  const caseOptions = TIEN_LEN_GAME.specialCases.filter((item) => state.rules.specialCases[item.code]?.enabled);
  const dialogTitle = editingRound ? `Sửa ván ${editingRound.roundNumber}` : `Ghi điểm ván ${state.rounds.length + 1}`;

  const dialogSubtitle = editingRound
    ? "Cập nhật lại thứ hạng và các sự kiện đặc biệt rồi lưu lại."
    : "Chọn thứ hạng và thêm sự kiện đặc biệt nếu có. Điểm tạm tính sẽ tự cập nhật.";

  const entryMap = new Map((editingRound?.entries || []).map((entry) => [entry.playerId, entry]));
  return `
    <div class="dialog-header">
      <div>
        <h3 class="dialog-title">${dialogTitle}</h3>
        <p class="dialog-subtitle">${dialogSubtitle}</p>
      </div>
      <button class="close-btn" id="closeRoundDialog" type="button">×</button>
    </div>
    <form id="roundForm">
      <div class="dialog-body">
        ${state.players
          .map((player) => {
            const existingEntry = entryMap.get(player.id);
            const selectedRank = existingEntry?.rank || "";
            const selectedCases = existingEntry?.specialCases || [];
            const selectedCaseCodes = new Set(selectedCases.map((item) => item.code));
            const hasSpecialCases = selectedCases.length > 0;
            return `
            <section class="round-player-block" data-player-block="${player.id}">
              <div class="round-player-header">
                <div>
                  <div class="player-name">${escapeHtml(player.name)}</div>
                  <div class="player-meta">Tổng hiện tại: ${formatSignedNumber(player.totalScore)}</div>
                </div>
                <div class="badge-soft">${state.scoreMode === "zero-sum" ? "Bù trừ" : "Cộng dồn"}</div>
              </div>

              <div class="mb-3">
                <div class="compact-label">Thứ hạng ván</div>
                <div class="rank-buttons" data-rank-group="${player.id}">
                  ${rankOptions
                    .map(
                      (rank) => `
                        <button
                          type="button"
                          class="rank-btn ${selectedRank === rank ? "active" : ""}"
                          data-rank-btn="${player.id}"
                          data-rank-value="${rank}"
                        >
                          ${RANK_LABELS[rank]}
                        </button>
                      `,
                    )
                    .join("")}
                </div>
                <input type="hidden" data-rank-input="${player.id}" value="${selectedRank}">
              </div>

              <div class="mt-2">
                <div class="form-check form-switch">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    id="specialToggle_${player.id}"
                    data-special-toggle="${player.id}"
                    ${hasSpecialCases ? "checked" : ""}
                  >
                  <label class="form-check-label" for="specialToggle_${player.id}">
                    Thêm sự kiện đặc biệt
                  </label>
                </div>
              </div>           
              <div class="special-cases-wrap collapse ${hasSpecialCases ? "show" : ""} mt-3" data-special-wrap="${player.id}" id="specialWrap_${player.id}">
                <div class="compact-label mb-2">Case đặc biệt</div>
                <div class="case-list">
                  ${
                    caseOptions.length
                      ? caseOptions
                          .map((item) => {
                            const matchedCase = selectedCases.find((x) => x.code === item.code);
                            const isChecked = !!matchedCase;
                            const appliedCount = matchedCase?.count || 1;
                            return `
                                <div class="case-item" data-case-row="${player.id}_${item.code}">
                                  <div class="case-head">
                                    <div>
                                      <div class="fw-semibold">${item.label}</div>
                                      <div class="mini-note">${item.note}</div>
                          </div>
                          <div class="form-check form-switch m-0">
                            <input
                              class="form-check-input"
                              type="checkbox"
                              data-case-check="${player.id}"
                              data-case-code="${item.code}"
                              ${isChecked ? "checked" : ""}
                            >
                          </div>
                        </div>
                        ${
                          item.type === "multiplied"
                            ? `
                          <div class="case-extra mt-2">
                            <label class="compact-label">Số lần áp dụng</label>
                            <input
                              type="number"
                              class="form-control"
                              min="1"
                              value="${appliedCount}"
                              data-case-count="${player.id}"
                              data-case-code="${item.code}"
                            >
                          </div>
                        `
                            : ""
                        }
                      </div>
                    `;
                          })
                          .join("")
                      : '<div class="empty-state">Không có case đặc biệt nào đang bật trong setup.</div>'
                  }
                </div>
              </div>
              <div class="row g-3 mb-2">
                <div class="col-sm-6">
                  <label class="compact-label">Điểm tạm tính</label>
                  <input type="text" class="form-control" data-temp-score="${player.id}" value="0" readonly>
                </div>
              </div>
            </section>
          `;
          })
          .join("")}

        <div class="mt-3">
          <label class="compact-label">Ghi chú ván</label>
          <textarea id="roundNote" rows="3" class="form-control" placeholder="Không bắt buộc">${escapeHtml(editingRound?.note || "")}</textarea>
        </div>
        <div id="roundErrorWrap" class="mt-3"></div>
      </div>
      <div class="dialog-footer">
        <button type="button" class="btn btn-outline-secondary" id="cancelRoundBtn">Đóng</button>
        <button type="submit" class="btn btn-primary">Lưu ván</button>
      </div>
    </form>
  `;
}

function bindSpecialCaseToggles(container = document) {
  const toggles = container.querySelectorAll("[data-special-toggle]");

  toggles.forEach((toggle) => {
    toggle.addEventListener("change", () => {
      const playerId = toggle.dataset.specialToggle;
      const wrap = container.querySelector(`#specialWrap_${playerId}`);
      if (!wrap) return;

      const collapse = bootstrap.Collapse.getOrCreateInstance(wrap, { toggle: false });

      if (toggle.checked) {
        collapse.show();
      } else {
        collapse.hide();

        wrap.querySelectorAll(`[data-case-check="${playerId}"]`).forEach((checkbox) => {
          checkbox.checked = false;
        });

        wrap.querySelectorAll(`[data-case-count="${playerId}"]`).forEach((input) => {
          input.value = 1;
        });

        calculateTempScore(playerId, container);
      }
    });
  });
}

function calculateTempScore(playerId, container) {
  let score = 0;

  // điểm theo thứ hạng
  const rankInput = container.querySelector(`[data-rank-input="${playerId}"]`);
  const rank = rankInput?.value;

  if (rank) {
    const rankScore = state.rules.rankingScores?.[rank] || 0;
    score += Number(rankScore);
  }

  // case đặc biệt
  const checks = container.querySelectorAll(`[data-case-check="${playerId}"]:checked`);

  checks.forEach((checkbox) => {
    const code = checkbox.dataset.caseCode;
    const rule = state.rules.specialCases?.[code];

    if (!rule) return;

    if (rule.type === "fixed") {
      score += Number(rule.score || 0);
    }

    if (rule.type === "multiplied") {
      const countInput = container.querySelector(`[data-case-count="${playerId}"][data-case-code="${code}"]`);

      const count = Number(countInput?.value || 1);
      score += Number(rule.score || 0) * count;
    }
  });

  const scoreInput = container.querySelector(`[data-temp-score="${playerId}"]`);
  if (scoreInput) {
    scoreInput.value = formatSignedNumber(score);
  }
}

function getRoundById(roundId) {
  return state.rounds.find((round) => round.id === roundId) || null;
}

function openRoundDialog(roundId = null) {
  const editingRound = roundId ? getRoundById(roundId) : null;

  roundDialog.dataset.editingRoundId = roundId || "";
  roundDialog.innerHTML = buildRoundDialog(editingRound);

  bindSpecialCaseToggles(roundDialog);

  state.players.forEach((p) => {
    calculateTempScore(p.id, roundDialog);
  });

  roundDialog.showModal();

  qs("#closeRoundDialog", roundDialog).addEventListener("click", () => roundDialog.close());
  qs("#cancelRoundBtn", roundDialog).addEventListener("click", () => roundDialog.close());

  qsa("[data-rank-btn]", roundDialog).forEach((button) => {
    button.addEventListener("click", () => {
      const playerId = button.dataset.rankBtn;
      qsa(`[data-rank-btn="${playerId}"]`, roundDialog).forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      qs(`[data-rank-input="${playerId}"]`, roundDialog).value = button.dataset.rankValue;
      calculateTempScore(playerId, roundDialog);
    });
  });

  qsa("[data-case-check]", roundDialog).forEach((input) => {
    input.addEventListener("change", () => {
      const playerId = input.dataset.caseCheck;
      const key = `${playerId}_${input.dataset.caseCode}`;
      qs(`[data-case-row="${key}"]`, roundDialog)?.classList.toggle("active", input.checked);
      calculateTempScore(playerId, roundDialog);
    });
  });

  qsa("[data-case-count]", roundDialog).forEach((input) => {
    input.addEventListener("input", () => {
      const playerId = input.dataset.caseCount;
      if (!input.value || Number(input.value) < 1) {
        input.value = 1;
      }
      calculateTempScore(playerId, roundDialog);
    });
  });

  qs("#roundForm", roundDialog).addEventListener("submit", handleRoundSubmit);
}

function rebuildMatchFromRounds(baseState, rounds) {
  let nextState = {
    ...baseState,
    rounds: [],
    standings: [],
    status: { thresholdReached: false, thresholdReachedAtRound: null },
    players: baseState.players.map((player) => ({
      ...player,
      totalScore: 0,
      rank: null,
    })),
  };

  rounds.forEach((round) => {
    const result = calculateRound(nextState, {
      entries: round.entries.map((entry) => ({
        playerId: entry.playerId,
        rank: entry.rank,
        baseScore: entry.baseScore || 0,
        specialCases: entry.specialCases.map((item) => ({
          code: item.code,
          selected: true,
          count: item.count || 1,
        })),
      })),
    });

    nextState = applyRound(nextState, result, {
      id: round.id,
      createdAt: round.createdAt,
      note: round.note || "",
    });
  });

  return nextState;
}

function handleRoundSubmit(event) {
  event.preventDefault();

  const editingRoundId = roundDialog.dataset.editingRoundId || null;

  const entries = state.players.map((player) => {
    const rank = qs(`[data-rank-input="${player.id}"]`, roundDialog).value;

    const specialCases = TIEN_LEN_GAME.specialCases
      .filter((item) => state.rules.specialCases[item.code]?.enabled)
      .filter((item) => qs(`[data-case-check="${player.id}"][data-case-code="${item.code}"]`, roundDialog)?.checked)
      .map((item) => ({
        code: item.code,
        selected: true,
        count: toNumber(qs(`[data-case-count="${player.id}"][data-case-code="${item.code}"]`, roundDialog)?.value, 1),
      }));

    return {
      playerId: player.id,
      rank,
      baseScore: 0,
      specialCases,
    };
  });

  const tempState = editingRoundId
    ? rebuildMatchFromRounds(
        state,
        state.rounds.map((round) =>
          round.id === editingRoundId
            ? {
                ...round,
                entries,
                note: trimText(qs("#roundNote", roundDialog).value),
              }
            : round,
        ),
      )
    : null;

  const validationState = editingRoundId
    ? {
        ...state,
        players: tempState.players,
        rounds: tempState.rounds,
        standings: tempState.standings,
        status: tempState.status,
      }
    : state;

  const result = calculateRound(validationState, { entries });
  const errors = validateRound(validationState, result);

  if (errors.length) {
    renderRoundErrors(errors);
    return;
  }

  if (editingRoundId) {
    const updatedRounds = state.rounds.map((round) =>
      round.id === editingRoundId
        ? {
            ...round,
            entries,
            note: trimText(qs("#roundNote", roundDialog).value),
          }
        : round,
    );

    state = rebuildMatchFromRounds(state, updatedRounds);
    persist();
    roundDialog.close();
    render();
    showToast("Đã cập nhật ván.");
    return;
  }

  state = applyRound(state, result, {
    id: uid("round"),
    createdAt: nowIso(),
    note: trimText(qs("#roundNote", roundDialog).value),
  });

  persist();
  roundDialog.close();
  render();
  showToast(`Đã lưu ván ${state.rounds.length}.`);
}

function renderRoundErrors(errors) {
  qs("#roundErrorWrap", roundDialog).innerHTML = `
    <div class="alert-inline error">
      ${errors.map((error) => `<div>${escapeHtml(error)}</div>`).join("")}
    </div>
  `;
}

function buildSummaryContent(autoTriggered) {
  const leader = state.standings[0];
  return `
    <div class="dialog-header">
      <div>
        <h3 class="dialog-title">${autoTriggered ? "Đã chạm mốc kết thúc" : "Tổng kết điểm hiện tại"}</h3>
        <p class="dialog-subtitle">${state.scoreMode === "accumulate" ? `Mốc đã đặt: ${state.setup.targetScore}` : "Mode bù trừ"} · Số ván: ${state.rounds.length}</p>
      </div>
      <button class="close-btn" id="closeSummaryDialog" type="button">×</button>
    </div>
    <div class="dialog-body">
      ${leader ? `<div class="alert-inline info mb-3">Người đang dẫn đầu là <strong>${escapeHtml(leader.name)}</strong> với ${formatSignedNumber(leader.totalScore)} điểm.</div>` : ""}
      ${renderStandingsList()}
    </div>
    <div class="dialog-footer">
      <button id="summaryResetBtn" type="button" class="btn btn-outline-danger">Reset trận</button>
      <button id="summaryContinueBtn" type="button" class="btn btn-outline-secondary">Tiếp tục chơi</button>
    </div>
  `;
}

function openSummaryDialog(autoTriggered) {
  summaryDialog.innerHTML = buildSummaryContent(autoTriggered);
  summaryDialog.showModal();

  qs("#closeSummaryDialog", summaryDialog).addEventListener("click", () => summaryDialog.close());
  qs("#summaryContinueBtn", summaryDialog).addEventListener("click", () => summaryDialog.close());
  qs("#summaryResetBtn", summaryDialog).addEventListener("click", () => {
    summaryDialog.close();
    openResetConfirm();
  });
}

function openResetConfirm() {
  confirmDialog.innerHTML = `
    <div class="dialog-header">
      <div>
        <h3 class="dialog-title">Reset trận hiện tại</h3>
        <p class="dialog-subtitle">Toàn bộ điểm và thiết lập của trận đang chơi sẽ bị xóa khỏi localStorage.</p>
      </div>
      <button class="close-btn" id="closeConfirmDialog" type="button">×</button>
    </div>
    <div class="dialog-body">
      <div class="alert-inline error">Hành động này sẽ đưa app về bước chọn game. Dữ liệu hiện tại không thể khôi phục.</div>
    </div>
    <div class="dialog-footer">
      <button id="cancelResetBtn" type="button" class="btn btn-outline-secondary">Hủy</button>
      <button id="confirmResetBtn" type="button" class="btn btn-danger">Xóa trận</button>
    </div>
  `;

  confirmDialog.showModal();
  qs("#closeConfirmDialog", confirmDialog).addEventListener("click", () => confirmDialog.close());
  qs("#cancelResetBtn", confirmDialog).addEventListener("click", () => confirmDialog.close());
  qs("#confirmResetBtn", confirmDialog).addEventListener("click", () => {
    clearState();
    state = createInitialState();
    confirmDialog.close();
    render();
    showToast("Đã xóa trận hiện tại.");
  });
}

function render() {
  renderStepper();
  if (state.currentStep === 1) renderGameStep();
  if (state.currentStep === 2) renderPlayerCountStep();
  if (state.currentStep === 3) renderRulesStep();
  if (state.currentStep === 4) renderScoreboardStep();
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.classList.remove("d-none");
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add("d-none");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => null);
  });
}

render();
