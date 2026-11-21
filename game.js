(() => {
  "use strict";

  // ==================== 配置常量 ====================
  const ASSETS = {
    bg: "./assets/images/bg-beach.png",
    shikiNormal: "./assets/images/shiki-normal.png",
    shikiHit: "./assets/images/shiki-hit.png",
    hammer: "./assets/images/hammer.png",
    bgm: "./assets/audio/BGM14.ogg",
    hitVoices: [
      "./assets/audio/Hit1.ogg",
      "./assets/audio/Hit2.ogg",
      "./assets/audio/Hit3.ogg",
    ],
    winVoice: "./assets/audio/Win.ogg",
    loseVoice: "./assets/audio/Lose.ogg",
  };

  /**
   * 9 个沙洞在背景图（1664×936）上的精确像素测量坐标（cx, cy 为洞口中心 %，w, h 为洞口宽高 %）
   */
  const HOLE_LAYOUT = [
    // 第 1 行（后排，近石碑）
    { cx: 24.04, cy: 51.60, w: 10.34, h: 7.05, row: 1, spriteScale: 1.52 },
    { cx: 49.88, cy: 51.71, w: 10.10, h: 6.84, row: 1, spriteScale: 1.54 },
    { cx: 75.66, cy: 51.60, w: 9.98,  h: 7.05, row: 1, spriteScale: 1.54 },
    // 第 2 行（中排）
    { cx: 23.44, cy: 68.48, w: 11.54, h: 7.91, row: 2, spriteScale: 1.48 },
    { cx: 49.82, cy: 68.48, w: 11.66, h: 7.91, row: 2, spriteScale: 1.48 },
    { cx: 76.32, cy: 68.48, w: 11.30, h: 7.91, row: 2, spriteScale: 1.50 },
    // 第 3 行（前排，近镜头）
    { cx: 21.75, cy: 88.03, w: 13.94, h: 11.11, row: 3, spriteScale: 1.40 },
    { cx: 49.82, cy: 88.03, w: 14.06, h: 11.11, row: 3, spriteScale: 1.40 },
    { cx: 77.76, cy: 88.03, w: 13.94, h: 11.11, row: 3, spriteScale: 1.40 },
  ];

  const DIFFICULTIES = {
    easy: {
      label: "简单",
      duration: 45,
      target: 18,
      maxConcurrent: 2,
      spawnMinMs: 560,
      spawnMaxMs: 920,
      stayMinMs: 950,
      stayMaxMs: 1450,
    },
    normal: {
      label: "普通",
      duration: 45,
      target: 25,
      maxConcurrent: 3,
      spawnMinMs: 420,
      spawnMaxMs: 760,
      stayMinMs: 760,
      stayMaxMs: 1180,
    },
    hard: {
      label: "困难",
      duration: 45,
      target: 35,
      maxConcurrent: 3,
      spawnMinMs: 300,
      spawnMaxMs: 580,
      stayMinMs: 600,
      stayMaxMs: 940,
    },
  };

  const HIT_WORDS = ["ぽかっ!", "ばしっ!", "どかっ!", "ピコッ!"];

  // ==================== 音频管理器 ====================
  class SoundManager {
    constructor() {
      this.bgmEnabled = true;
      this.sfxEnabled = true;
      this.lastHitIndex = -1;

      this.bgm = new Audio(ASSETS.bgm);
      this.bgm.loop = true;
      this.bgm.preload = "auto";
      this.bgm.volume = 0.42;

      this.hitTemplates = ASSETS.hitVoices.map((src) => {
        const a = new Audio(src);
        a.preload = "auto";
        return a;
      });

      this.winAudio = new Audio(ASSETS.winVoice);
      this.winAudio.preload = "auto";

      this.loseAudio = new Audio(ASSETS.loseVoice);
      this.loseAudio.preload = "auto";
    }

    startBgm() {
      if (!this.bgmEnabled) return;
      this.bgm.volume = 0.42;
      const p = this.bgm.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    }

    duckBgm() {
      this.bgm.volume = 0.14;
    }

    restoreBgm() {
      this.bgm.volume = 0.42;
      if (this.bgmEnabled && this.bgm.paused) {
        this.startBgm();
      }
    }

    stopEndVoices() {
      [this.winAudio, this.loseAudio].forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
    }

    toggleBgm() {
      this.bgmEnabled = !this.bgmEnabled;
      if (this.bgmEnabled) {
        this.startBgm();
      } else {
        this.bgm.pause();
      }
      return this.bgmEnabled;
    }

    toggleSfx() {
      this.sfxEnabled = !this.sfxEnabled;
      if (!this.sfxEnabled) {
        this.stopEndVoices();
      }
      return this.sfxEnabled;
    }

    playRandomHit() {
      if (!this.sfxEnabled) return;
      let idx = Math.floor(Math.random() * this.hitTemplates.length);
      if (this.hitTemplates.length > 1 && idx === this.lastHitIndex) {
        idx = (idx + 1 + Math.floor(Math.random() * (this.hitTemplates.length - 1))) % this.hitTemplates.length;
      }
      this.lastHitIndex = idx;

      const clip = this.hitTemplates[idx].cloneNode();
      clip.volume = 0.92;
      const p = clip.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    }

    playResult(isWin) {
      if (!this.sfxEnabled) return;
      this.stopEndVoices();
      this.duckBgm();
      const voice = isWin ? this.winAudio : this.loseAudio;
      voice.volume = 0.98;
      voice.currentTime = 0;
      voice.onended = () => {
        if (this.bgmEnabled) {
          this.bgm.volume = 0.34;
        }
      };
      const p = voice.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    }
  }

  // ==================== DOM 引用 ====================
  const el = {
    stage: document.getElementById("game-stage"),
    sceneBg: document.getElementById("scene-bg"),
    holesLayer: document.getElementById("holes-layer"),
    fxLayer: document.getElementById("fx-layer"),
    hammerCursor: document.getElementById("hammer-cursor"),
    rushBanner: document.getElementById("rush-banner"),

    timePill: document.getElementById("time-pill"),
    timeValue: document.getElementById("time-value"),
    scorePill: document.getElementById("score-pill"),
    scoreValue: document.getElementById("score-value"),
    targetValue: document.getElementById("target-value"),
    goalBadge: document.getElementById("goal-badge"),
    comboPill: document.getElementById("combo-pill"),
    comboValue: document.getElementById("combo-value"),

    btnBgm: document.getElementById("btn-bgm"),
    btnSfx: document.getElementById("btn-sfx"),
    btnRestart: document.getElementById("btn-restart"),

    startOverlay: document.getElementById("start-overlay"),
    diffBtns: Array.from(document.querySelectorAll(".diff-btn")),
    bestRecord: document.getElementById("best-record"),
    btnStart: document.getElementById("btn-start"),

    resultOverlay: document.getElementById("result-overlay"),
    resultCard: document.getElementById("result-card"),
    resultPortrait: document.getElementById("result-portrait"),
    resultEyebrow: document.getElementById("result-eyebrow"),
    resultTitle: document.getElementById("result-title"),
    resultDesc: document.getElementById("result-desc"),
    resHits: document.getElementById("res-hits"),
    resTarget: document.getElementById("res-target"),
    resMaxCombo: document.getElementById("res-max-combo"),
    resAccuracy: document.getElementById("res-accuracy"),
    btnPlayAgain: document.getElementById("btn-play-again"),
    btnBackMenu: document.getElementById("btn-back-menu"),
  };

  // ==================== 游戏状态 ====================
  const sound = new SoundManager();
  const state = {
    running: false,
    difficulty: "normal",
    timeLeft: DIFFICULTIES.normal.duration,
    hits: 0,
    swings: 0,
    combo: 0,
    maxCombo: 0,
    holes: [],
    timerInterval: null,
    spawnTimeout: null,
    hammerHideTimeout: null,
  };

  // ==================== 工具函数 ====================
  function randBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function getBestScore(diffKey) {
    try {
      const val = Number(localStorage.getItem(`whack_shiki_best_${diffKey}`) || 0);
      return Number.isFinite(val) ? val : 0;
    } catch {
      return 0;
    }
  }

  function saveBestScore(diffKey, score) {
    try {
      const prev = getBestScore(diffKey);
      if (score > prev) {
        localStorage.setItem(`whack_shiki_best_${diffKey}`, String(score));
      }
    } catch {
      // 忽略隐私模式存储限制
    }
  }

  function syncStageAspectRatio() {
    const w = el.sceneBg.naturalWidth;
    const h = el.sceneBg.naturalHeight;
    if (w > 0 && h > 0) {
      el.stage.style.setProperty("--stage-aspect", `${w} / ${h}`);
      el.stage.style.setProperty("--stage-ratio", (w / h).toFixed(4));
    }
  }

  // ==================== 9 个沙洞构建 ====================
  function buildHoles() {
    el.holesLayer.innerHTML = "";
    state.holes = HOLE_LAYOUT.map((cfg, index) => {
      const slot = document.createElement("div");
      slot.className = "hole-slot";
      slot.dataset.index = String(index);
      slot.style.left = `${cfg.cx}%`;
      slot.style.top = `${cfg.cy}%`;
      slot.style.width = `${cfg.w}%`;
      slot.style.height = `${cfg.h}%`;
      slot.style.zIndex = String(cfg.row + 1);
      slot.style.setProperty("--sprite-scale", String(cfg.spriteScale || 1.45));

      const mask = document.createElement("div");
      mask.className = "mole-mask";

      const actor = document.createElement("div");
      actor.className = "mole-actor";

      const imgNormal = document.createElement("img");
      imgNormal.className = "mole-sprite mole-sprite-normal";
      imgNormal.src = ASSETS.shikiNormal;
      imgNormal.alt = "神山识";
      imgNormal.draggable = false;

      const imgHit = document.createElement("img");
      imgHit.className = "mole-sprite mole-sprite-hit";
      imgHit.src = ASSETS.shikiHit;
      imgHit.alt = "被砸中的神山识";
      imgHit.draggable = false;

      actor.appendChild(imgNormal);
      actor.appendChild(imgHit);
      mask.appendChild(actor);

      const hitArea = document.createElement("button");
      hitArea.type = "button";
      hitArea.className = "hole-hitarea";
      hitArea.setAttribute("aria-label", `沙洞 ${index + 1}`);
      hitArea.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        handleStagePointerDown(e, index);
      });

      slot.appendChild(mask);
      slot.appendChild(hitArea);
      el.holesLayer.appendChild(slot);

      return {
        index,
        cfg,
        slot,
        active: false,
        hit: false,
        hideTimer: null,
      };
    });
  }

  // ==================== HUD 更新 ====================
  function updateHud() {
    const diff = DIFFICULTIES[state.difficulty];
    el.timeValue.textContent = String(state.timeLeft);
    el.scoreValue.textContent = String(state.hits);
    el.targetValue.textContent = String(diff.target);
    el.comboValue.textContent = String(state.combo);

    const isCleared = state.hits >= diff.target;
    el.scorePill.classList.toggle("is-cleared", isCleared);
    el.goalBadge.hidden = !isCleared;

    const isUrgent = state.running && state.timeLeft <= 10;
    el.timePill.classList.toggle("is-urgent", isUrgent);
    el.rushBanner.hidden = !(state.running && state.timeLeft <= 15);

    el.comboPill.classList.toggle("is-hot", state.combo >= 3);
  }

  function updateBestRecordLabel() {
    const best = getBestScore(state.difficulty);
    el.bestRecord.textContent = `当前难度最高纪录：${best} 次`;
  }

  // ==================== 锤子与视觉特效 ====================
  function positionHammer(clientX, clientY, isTouch) {
    const rect = el.stage.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    el.hammerCursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    el.hammerCursor.classList.add("is-visible");

    if (isTouch) {
      clearTimeout(state.hammerHideTimeout);
      state.hammerHideTimeout = setTimeout(() => {
        el.hammerCursor.classList.remove("is-visible");
      }, 260);
    }
  }

  function triggerHammerSwing() {
    el.hammerCursor.classList.remove("is-swinging");
    void el.hammerCursor.offsetWidth;
    el.hammerCursor.classList.add("is-swinging");
  }

  function spawnHitFx(xPct, yPct, combo) {
    const burst = document.createElement("div");
    burst.className = "hit-burst";
    burst.style.left = `${xPct}%`;
    burst.style.top = `${yPct}%`;
    el.fxLayer.appendChild(burst);
    setTimeout(() => burst.remove(), 360);

    const label = document.createElement("div");
    label.className = "hit-float";
    const word = HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)];
    label.textContent = combo >= 3 ? `${word} +1 (${combo}连击!)` : `${word} +1`;
    label.style.left = `${xPct}%`;
    label.style.top = `${Math.max(12, yPct - 6)}%`;
    el.fxLayer.appendChild(label);
    setTimeout(() => label.remove(), 650);
  }

  function spawnMissFx(xPct, yPct) {
    const puff = document.createElement("div");
    puff.className = "sand-puff";
    puff.style.left = `${xPct}%`;
    puff.style.top = `${yPct}%`;
    el.fxLayer.appendChild(puff);
    setTimeout(() => puff.remove(), 340);
  }

  // ==================== 出洞与判定逻辑 ====================
  function clearHoleTimers() {
    state.holes.forEach((h) => {
      clearTimeout(h.hideTimer);
      h.hideTimer = null;
      h.active = false;
      h.hit = false;
      h.slot.classList.remove("is-up", "is-hit");
    });
  }

  function hideHole(hole) {
    clearTimeout(hole.hideTimer);
    hole.hideTimer = null;
    hole.active = false;
    hole.hit = false;
    hole.slot.classList.remove("is-up", "is-hit");
  }

  function scheduleNextSpawn() {
    if (!state.running) return;
    const diff = DIFFICULTIES[state.difficulty];
    // 随剩余时间推进，节奏平滑加快（最后15秒加速至约 0.76x 间隔）
    const elapsedRatio = 1 - state.timeLeft / diff.duration;
    const speedFactor = Math.max(0.74, 1 - elapsedRatio * 0.26);

    const delay = randBetween(
      Math.round(diff.spawnMinMs * speedFactor),
      Math.round(diff.spawnMaxMs * speedFactor)
    );

    state.spawnTimeout = setTimeout(() => {
      if (!state.running) return;
      popRandomShiki(speedFactor);
      scheduleNextSpawn();
    }, delay);
  }

  function popRandomShiki(speedFactor) {
    const diff = DIFFICULTIES[state.difficulty];
    const activeCount = state.holes.filter((h) => h.active).length;
    if (activeCount >= diff.maxConcurrent) return;

    const candidates = state.holes.filter((h) => !h.active);
    if (candidates.length === 0) return;

    const hole = candidates[Math.floor(Math.random() * candidates.length)];
    hole.active = true;
    hole.hit = false;
    hole.slot.classList.remove("is-hit");
    hole.slot.classList.add("is-up");

    const stayMs = randBetween(
      Math.round(diff.stayMinMs * speedFactor),
      Math.round(diff.stayMaxMs * speedFactor)
    );

    hole.hideTimer = setTimeout(() => {
      if (hole.active && !hole.hit) {
        // 漏掉未砸中会中断连击
        state.combo = 0;
        updateHud();
      }
      hideHole(hole);
    }, stayMs);
  }

  function handleStagePointerDown(e, holeIndex) {
    if (!state.running) return;
    const isTouch = e.pointerType === "touch";
    positionHammer(e.clientX, e.clientY, isTouch);
    triggerHammerSwing();

    state.swings += 1;

    const rect = el.stage.getBoundingClientRect();
    const clickXPct = ((e.clientX - rect.left) / rect.width) * 100;
    const clickYPct = ((e.clientY - rect.top) / rect.height) * 100;

    if (typeof holeIndex === "number") {
      const hole = state.holes[holeIndex];
      if (hole && hole.active && !hole.hit) {
        hole.hit = true;
        clearTimeout(hole.hideTimer);
        hole.slot.classList.add("is-hit");

        state.hits += 1;
        state.combo += 1;
        if (state.combo > state.maxCombo) {
          state.maxCombo = state.combo;
        }

        sound.playRandomHit();
        spawnHitFx(hole.cfg.cx, hole.cfg.cy - hole.cfg.h * 0.9, state.combo);
        updateHud();

        // 展示被砸大哭表情片刻后缩回沙洞
        hole.hideTimer = setTimeout(() => {
          hideHole(hole);
        }, 380);
        return;
      }
    }

    // 空砸
    state.combo = 0;
    spawnMissFx(clickXPct, clickYPct);
    updateHud();
  }

  // ==================== 游戏流程控制 ====================
  function startGame() {
    const diff = DIFFICULTIES[state.difficulty];
    clearInterval(state.timerInterval);
    clearTimeout(state.spawnTimeout);
    clearHoleTimers();
    el.fxLayer.innerHTML = "";
    sound.stopEndVoices();

    state.running = true;
    state.timeLeft = diff.duration;
    state.hits = 0;
    state.swings = 0;
    state.combo = 0;
    state.maxCombo = 0;

    el.startOverlay.hidden = true;
    el.resultOverlay.hidden = true;
    el.btnRestart.hidden = false;
    el.stage.classList.add("is-playing");

    updateHud();
    sound.restoreBgm();

    // 开局立刻先钻出一个，零冷场等待
    setTimeout(() => {
      if (state.running) popRandomShiki(1);
    }, 260);
    scheduleNextSpawn();

    state.timerInterval = setInterval(() => {
      if (!state.running) return;
      state.timeLeft -= 1;
      updateHud();

      if (state.timeLeft <= 0) {
        finishGame();
      }
    }, 1000);
  }

  function finishGame() {
    state.running = false;
    clearInterval(state.timerInterval);
    clearTimeout(state.spawnTimeout);
    clearHoleTimers();

    el.stage.classList.remove("is-playing");
    el.hammerCursor.classList.remove("is-visible");
    el.rushBanner.hidden = true;
    el.timePill.classList.remove("is-urgent");

    const diff = DIFFICULTIES[state.difficulty];
    const isWin = state.hits >= diff.target;
    const accuracy = state.swings > 0 ? Math.round((state.hits / state.swings) * 100) : 0;

    saveBestScore(state.difficulty, state.hits);
    updateBestRecordLabel();

    el.resultCard.classList.toggle("is-win", isWin);
    el.resultCard.classList.toggle("is-lose", !isWin);
    el.resultPortrait.src = isWin ? ASSETS.shikiHit : ASSETS.shikiNormal;
    el.resultEyebrow.textContent = isWin ? "STAGE CLEAR" : "TIME UP";
    el.resultTitle.textContent = isWin ? "挑战胜利！" : "差一点点！";
    el.resultDesc.textContent = isWin
      ? `太棒了！你在 ${diff.duration} 秒内成功击中神山识 ${state.hits} 次，达成了 ${diff.label} 难度目标！`
      : `本局击中 ${state.hits} 次，距离目标 ${diff.target} 次还差 ${diff.target - state.hits} 次，再试一次吧！`;

    el.resHits.textContent = String(state.hits);
    el.resTarget.textContent = String(diff.target);
    el.resMaxCombo.textContent = `${state.maxCombo}x`;
    el.resAccuracy.textContent = `${accuracy}%`;

    el.resultOverlay.hidden = false;
    sound.playResult(isWin);
  }

  function backToMenu() {
    state.running = false;
    clearInterval(state.timerInterval);
    clearTimeout(state.spawnTimeout);
    clearHoleTimers();
    sound.stopEndVoices();
    sound.restoreBgm();

    el.stage.classList.remove("is-playing");
    el.hammerCursor.classList.remove("is-visible");
    el.resultOverlay.hidden = true;
    el.startOverlay.hidden = false;
    el.btnRestart.hidden = true;
    el.rushBanner.hidden = true;
    el.timePill.classList.remove("is-urgent");

    const diff = DIFFICULTIES[state.difficulty];
    state.timeLeft = diff.duration;
    state.hits = 0;
    state.combo = 0;
    updateHud();
    updateBestRecordLabel();
  }

  // ==================== 事件绑定 ====================
  function bindEvents() {
    el.sceneBg.addEventListener("load", syncStageAspectRatio);
    if (el.sceneBg.complete) {
      syncStageAspectRatio();
    }

    el.stage.addEventListener("pointermove", (e) => {
      if (!state.running || e.pointerType === "touch") return;
      positionHammer(e.clientX, e.clientY, false);
    });

    el.stage.addEventListener("pointerleave", () => {
      el.hammerCursor.classList.remove("is-visible");
    });

    el.stage.addEventListener("pointerdown", (e) => {
      if (!state.running) return;
      handleStagePointerDown(e, null);
    });

    el.diffBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.diff;
        if (!DIFFICULTIES[key]) return;
        state.difficulty = key;
        el.diffBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
        state.timeLeft = DIFFICULTIES[key].duration;
        updateHud();
        updateBestRecordLabel();
      });
    });

    el.btnStart.addEventListener("click", startGame);
    el.btnPlayAgain.addEventListener("click", startGame);
    el.btnRestart.addEventListener("click", startGame);
    el.btnBackMenu.addEventListener("click", backToMenu);

    el.btnBgm.addEventListener("click", () => {
      const enabled = sound.toggleBgm();
      el.btnBgm.setAttribute("aria-pressed", String(enabled));
      el.btnBgm.querySelector(".btn-text").textContent = enabled ? "BGM 开" : "BGM 关";
    });

    el.btnSfx.addEventListener("click", () => {
      const enabled = sound.toggleSfx();
      el.btnSfx.setAttribute("aria-pressed", String(enabled));
      el.btnSfx.querySelector(".btn-text").textContent = enabled ? "语音 开" : "语音 关";
    });
  }

  // ==================== 初始化 ====================
  buildHoles();
  bindEvents();
  updateHud();
  updateBestRecordLabel();
})();
