/**
 * 单词挑战 - 游戏主逻辑
 */

// ============================================
// 音效系统 (Web Audio API)
// ============================================
class SoundManager {
  constructor() {
    this.ctx = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  // 播放音调
  playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // 正确音效 - 上升和弦
  playCorrect() {
    if (!this.ctx) return;
    this.playTone(523.25, 0.15, 'sine', 0.25); // C5
    setTimeout(() => this.playTone(659.25, 0.15, 'sine', 0.25), 80); // E5
    setTimeout(() => this.playTone(783.99, 0.25, 'sine', 0.3), 160); // G5
  }

  // 失败音效 - 下降音
  playWrong() {
    if (!this.ctx) return;
    this.playTone(400, 0.15, 'sine', 0.2);
    setTimeout(() => this.playTone(300, 0.2, 'sine', 0.2), 100);
  }

  // 开始音效 - 上升音阶
  playStart() {
    if (!this.ctx) return;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, 'sine', 0.2), i * 150);
    });
  }

  // 倒计时音效
  playCountdown() {
    this.playTone(880, 0.1, 'sine', 0.2);
  }

  // 最后3秒
  playCountdownFinal() {
    this.playTone(1000, 0.15, 'square', 0.15);
  }

  // 结束音效
  playEnd() {
    if (!this.ctx) return;
    this.playTone(523.25, 0.2, 'sine', 0.2);
    setTimeout(() => this.playTone(440, 0.2, 'sine', 0.2), 200);
    setTimeout(() => this.playTone(349.23, 0.3, 'sine', 0.25), 400);
  }

  // 30秒警告
  playWarning() {
    if (!this.ctx) return;
    this.playTone(600, 0.1, 'sine', 0.15);
    setTimeout(() => this.playTone(600, 0.1, 'sine', 0.15), 150);
  }
}

// ============================================
// 语音合成 (TTS)
// ============================================
class SpeechManager {
  speak(text, lang = 'en-US', rate = 0.8) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = rate;
    utter.pitch = 1;
    utter.volume = 1;

    // 尝试选择英文语音
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
      || voices.find(v => v.lang.startsWith('en-US'))
      || voices.find(v => v.lang.startsWith('en'));
    if (enVoice) utter.voice = enVoice;

    window.speechSynthesis.speak(utter);
  }
}

// ============================================
// 词库管理器
// ============================================
class WordManager {
  constructor() {
    this.library = WORD_LIBRARY;
    this.selectedCategory = null;
    this.selectedPOS = null;
    this.selectedLevel = null;
    this.wrongWords = this.loadWrongWords();
    this.learnedWords = this.loadLearnedWords();
  }

  // 获取所有类别
  getCategories() {
    return Object.keys(this.library);
  }

  // 获取指定类别的词性
  getPOS(category) {
    if (!this.library[category]) return [];
    return Object.keys(this.library[category]);
  }

  // 获取指定类别和词性的级别
  getLevels(category, pos) {
    if (!this.library[category] || !this.library[category][pos]) return [];
    const levels = this.library[category][pos].levels;
    return Object.keys(levels).map(key => ({
      key,
      label: levels[key].label,
      count: levels[key].words.length
    }));
  }

  // 获取单词列表
  getWords(category, pos, level) {
    if (!this.library[category] || !this.library[category][pos]) return [];
    const levelData = this.library[category][pos].levels[level];
    return levelData ? levelData.words : [];
  }

  // 获取所有可选单词（根据当前选择）
  getAllSelectedWords() {
    if (!this.selectedCategory || !this.selectedPOS || !this.selectedLevel) return [];
    return this.getWords(this.selectedCategory, this.selectedPOS, this.selectedLevel);
  }

  // 检查是否为生词
  isUnlearned(word) {
    return !this.learnedWords.has(word.en);
  }

  // 检查是否为错词
  isWrong(word) {
    return this.wrongWords.has(word.en);
  }

  // 记录正确
  markCorrect(word) {
    this.learnedWords.add(word.en);
    this.wrongWords.delete(word.en);
    this.saveData();
  }

  // 记录错误
  markWrong(word) {
    this.wrongWords.add(word.en);
    this.saveData();
  }

  // 保存数据
  saveData() {
    try {
      localStorage.setItem('ec_wrong', JSON.stringify([...this.wrongWords]));
      localStorage.setItem('ec_learned', JSON.stringify([...this.learnedWords]));
    } catch (e) {}
  }

  // 加载错词
  loadWrongWords() {
    try {
      const data = localStorage.getItem('ec_wrong');
      return data ? new Set(JSON.parse(data)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  // 加载已学词
  loadLearnedWords() {
    try {
      const data = localStorage.getItem('ec_learned');
      return data ? new Set(JSON.parse(data)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  // 根据优先级排序单词
  sortWords(words, preferNew, preferWrong) {
    const sorted = [...words];
    if (preferWrong) {
      sorted.sort((a, b) => {
        const aWrong = this.isWrong(a) ? 0 : 1;
        const bWrong = this.isWrong(b) ? 0 : 1;
        return aWrong - bWrong;
      });
    } else if (preferNew) {
      sorted.sort((a, b) => {
        const aNew = this.isUnlearned(a) ? 0 : 1;
        const bNew = this.isUnlearned(b) ? 0 : 1;
        return aNew - bNew;
      });
    }
    return sorted;
  }
}

// ============================================
// 游戏主控制器
// ============================================
class Game {
  constructor() {
    this.sound = new SoundManager();
    this.speech = new SpeechManager();
    this.wordMgr = new WordManager();

    // 游戏状态
    this.isPlaying = false;
    this.isPaused = false;
    this.isTimeMode = true; // true=计时模式, false=计词模式
    this.timeLimit = 7; // 分钟
    this.wordLimit = 10; // 词数
    this.preferNew = false;
    this.preferWrong = false;

    // 运行时状态
    this.currentWords = [];
    this.currentIndex = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.remainingTime = 0; // 秒
    this.timer = null;
    this.warningShown = false;
    this.results = []; // { word, correct }

    // DOM
    this.pages = {
      settings: document.getElementById('settingsPage'),
      countdown: document.getElementById('countdownPage'),
      game: document.getElementById('gamePage'),
      result: document.getElementById('resultPage')
    };

    this.init();
  }

  init() {
    // 初始化音效（需要用户交互）
    document.addEventListener('click', () => this.sound.init(), { once: true });
    document.addEventListener('touchstart', () => this.sound.init(), { once: true });

    // 加载语音列表
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    this.setupSettings();
    this.setupGame();
    this.setupResultPage();
  }

  // ============================================
  // 页面切换
  // ============================================
  showPage(name) {
    Object.values(this.pages).forEach(p => p.classList.remove('active'));
    this.pages[name].classList.add('active');
  }

  // ============================================
  // 结算页面
  // ============================================
  setupResultPage() {
    // 结算页面的按钮事件在 showResults() 中动态绑定
  }

  // ============================================
  // 设置页面
  // ============================================
  setupSettings() {
    // 渲染类别菜单
    this.renderCategories();

    // 时间/数量按钮
    document.querySelectorAll('.time-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.isTimeMode = btn.dataset.mode === 'time';
        if (this.isTimeMode) {
          this.timeLimit = parseInt(btn.dataset.value);
        } else {
          this.wordLimit = parseInt(btn.dataset.value);
        }
        this.updateStartButton();
      });
    });

    // 优先生词
    document.getElementById('preferNew').addEventListener('click', () => {
      this.preferNew = !this.preferNew;
      document.getElementById('preferNew').querySelector('.checkbox').classList.toggle('checked', this.preferNew);
      if (this.preferNew) {
        this.preferWrong = false;
        document.getElementById('preferWrong').querySelector('.checkbox').classList.remove('checked');
      }
    });

    // 优先错词
    document.getElementById('preferWrong').addEventListener('click', () => {
      this.preferWrong = !this.preferWrong;
      document.getElementById('preferWrong').querySelector('.checkbox').classList.toggle('checked', this.preferWrong);
      if (this.preferWrong) {
        this.preferNew = false;
        document.getElementById('preferNew').querySelector('.checkbox').classList.remove('checked');
      }
    });

    // 开始按钮
    document.getElementById('startBtn').addEventListener('click', () => this.startGame());
  }

  renderCategories() {
    const grid = document.getElementById('categoryGrid');
    const categories = this.wordMgr.getCategories();
    grid.innerHTML = categories.map(cat =>
      `<button class="category-btn" data-cat="${cat}">${cat}</button>`
    ).join('');

    grid.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.wordMgr.selectedCategory = btn.dataset.cat;
        this.wordMgr.selectedPOS = null;
        this.wordMgr.selectedLevel = null;
        this.renderPOS();
        this.updateStartButton();
      });
    });
  }

  renderPOS() {
    const section = document.getElementById('posSection');
    const grid = document.getElementById('posGrid');
    const posList = this.wordMgr.getPOS(this.wordMgr.selectedCategory);

    if (!posList.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    grid.innerHTML = posList.map(pos =>
      `<button class="pos-btn" data-pos="${pos}">${pos}</button>`
    ).join('');

    grid.querySelectorAll('.pos-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.wordMgr.selectedPOS = btn.dataset.pos;
        this.wordMgr.selectedLevel = null;
        this.renderLevels();
        this.updateStartButton();
      });
    });

    document.getElementById('levelSection').style.display = 'none';
    document.getElementById('wordCountDisplay').style.display = 'none';
  }

  renderLevels() {
    const section = document.getElementById('levelSection');
    const grid = document.getElementById('levelGrid');
    const levels = this.wordMgr.getLevels(this.wordMgr.selectedCategory, this.wordMgr.selectedPOS);

    if (!levels.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    grid.innerHTML = levels.map(lv =>
      `<button class="level-btn" data-level="${lv.key}">${lv.label} (${lv.count}词)</button>`
    ).join('');

    grid.querySelectorAll('.level-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.wordMgr.selectedLevel = btn.dataset.level;
        this.showWordCount();
        this.updateStartButton();
      });
    });

    document.getElementById('wordCountDisplay').style.display = 'none';
  }

  showWordCount() {
    const words = this.wordMgr.getAllSelectedWords();
    const display = document.getElementById('wordCountDisplay');
    const num = document.getElementById('wordCountNum');
    display.style.display = 'block';
    num.textContent = words.length;
  }

  updateStartButton() {
    const btn = document.getElementById('startBtn');
    const ready = this.wordMgr.selectedCategory && this.wordMgr.selectedPOS && this.wordMgr.selectedLevel;
    btn.disabled = !ready;
    if (ready) {
      const words = this.wordMgr.getAllSelectedWords();
      btn.textContent = `开始挑战 (${words.length}词)`;
    } else {
      btn.textContent = '请先选择词库';
    }
  }

  // ============================================
  // 游戏逻辑
  // ============================================
  async startGame() {
    this.sound.init();
    this.sound.playStart();

    // 在用户手势上下文中请求 iOS 重力感应权限（必须在 click/tap 中调用）
    await this.requestOrientationPermission();

    // 准备单词
    let words = this.wordMgr.getAllSelectedWords();
    words = this.wordMgr.sortWords(words, this.preferNew, this.preferWrong);

    // 如果是计词模式，截取指定数量
    if (!this.isTimeMode) {
      words = words.slice(0, this.wordLimit);
    }

    this.currentWords = words;
    this.currentIndex = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.results = [];
    this.warningShown = false;

    if (this.isTimeMode) {
      this.remainingTime = this.timeLimit * 60;
    } else {
      this.remainingTime = 999; // 计词模式不限时
    }

    // 开始倒计时
    this.startCountdown();
  }

  startCountdown() {
    this.showPage('countdown');
    let count = 3;
    const numEl = document.getElementById('countdownNumber');
    const textEl = document.getElementById('countdownText');

    const tick = () => {
      if (count > 0) {
        numEl.textContent = count;
        numEl.style.animation = 'none';
        numEl.offsetHeight; // 强制重排
        numEl.style.animation = 'countdown-pop 0.5s ease';
        this.sound.playCountdown();
        count--;
        setTimeout(tick, 800);
      } else {
        numEl.textContent = 'GO!';
        numEl.style.animation = 'none';
        numEl.offsetHeight;
        numEl.style.animation = 'countdown-pop 0.5s ease';
        this.sound.playStart();
        setTimeout(() => {
          this.enterGame();
        }, 600);
      }
    };

    setTimeout(tick, 300);
  }

  enterGame() {
    this.isPlaying = true;
    this.isPaused = false;
    this.showPage('game');
    this.updateGameUI();
    this.showCurrentWord();
    this.startTimer();
    this.requestFullscreen();
    this.requestWakeLock();
    // 启动重力感应（权限已在 startGame 中获取）
    this.setupGravitySensor();
  }

  // iOS 13+ 需要请求 DeviceOrientation 权限
  async requestOrientationPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          console.log('DeviceOrientation permission denied');
          this.setupFallbackTouch();
        }
      } catch (e) {
        console.log('DeviceOrientation permission error:', e);
        this.setupFallbackTouch();
      }
    }
  }

  startTimer() {
    this.timer = setInterval(() => {
      if (this.isPaused) return;

      if (this.isTimeMode) {
        this.remainingTime--;
        this.updateTimerDisplay();

        // 30秒警告
        if (this.remainingTime === 30 && !this.warningShown) {
          this.warningShown = true;
          this.showTimeWarning();
          this.sound.playWarning();
        }

        // 最后3秒
        if (this.remainingTime <= 3 && this.remainingTime > 0) {
          this.sound.playCountdownFinal();
        }

        if (this.remainingTime <= 0) {
          this.endGame();
        }
      } else {
        // 计词模式：检查是否已完成所有词
        if (this.currentIndex >= this.currentWords.length) {
          this.endGame();
        }
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const timerEl = document.getElementById('gameTimer');
    const min = Math.floor(this.remainingTime / 60);
    const sec = this.remainingTime % 60;
    timerEl.textContent = `${min}:${sec.toString().padStart(2, '0')}`;

    timerEl.classList.remove('warning', 'danger');
    if (this.remainingTime <= 10) {
      timerEl.classList.add('danger');
    } else if (this.remainingTime <= 30) {
      timerEl.classList.add('warning');
    }
  }

  showTimeWarning() {
    const el = document.getElementById('timeWarning');
    el.style.display = 'block';
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'bounce 0.5s ease';
    setTimeout(() => { el.style.display = 'none'; }, 2000);
  }

  updateGameUI() {
    document.getElementById('gameCorrect').textContent = this.correctCount;
    document.getElementById('gameWrong').textContent = this.wrongCount;

    if (this.isTimeMode) {
      document.getElementById('gameProgress').textContent =
        `${this.currentIndex + 1} / ${this.currentWords.length}`;
    } else {
      document.getElementById('gameProgress').textContent =
        `${this.currentIndex + 1} / ${this.wordLimit}`;
    }
  }

  showCurrentWord() {
    if (this.currentIndex >= this.currentWords.length) {
      this.endGame();
      return;
    }

    const word = this.currentWords[this.currentIndex];
    // 显示中文 + 拼音（猜词者看这面）
    document.getElementById('wordCn').textContent = word.cn;
    document.getElementById('wordPy').textContent = word.py;

    // 隐藏英文区域
    document.getElementById('wordEnGroup').style.display = 'none';

    // 重置卡片状态 - 关键修复动画卡住
    const card = document.getElementById('wordCard');
    card.style.transition = 'none';
    card.style.transform = 'translateY(0) rotate(0) scale(1)';
    card.style.opacity = '1';
    card.classList.remove('swiping-correct', 'swiping-wrong', 'entering');
    void card.offsetHeight; // 强制重排
    card.classList.add('entering');

    this.updateGameUI();
  }

  // 答对/答错后短暂显示英文
  showEnglishBriefly(word, callback) {
    const card = document.getElementById('wordCard');
    const enGroup = document.getElementById('wordEnGroup');
    const cnGroup = document.getElementById('wordCnGroup');

    // 先把卡片动画重置回中心
    card.style.transition = 'none';
    card.style.transform = 'translateY(0) rotate(0) scale(1)';
    card.style.opacity = '1';
    card.classList.remove('swiping-correct', 'swiping-wrong', 'entering');
    void card.offsetHeight;

    // 隐藏中文，显示英文
    cnGroup.style.display = 'none';
    enGroup.style.display = 'flex';
    document.getElementById('wordEn').textContent = word.en;
    document.getElementById('wordIpa').textContent = word.ipa;
    document.getElementById('WordPos').textContent = word.pos;

    // 短暂显示后执行回调
    setTimeout(() => {
      cnGroup.style.display = '';
      enGroup.style.display = 'none';
      callback();
    }, 600);
  }

  // ============================================
  // 重力感应手势
  // ============================================
  setupGravitySensor() {
    this.gravityState = 'idle'; // idle, tilting-down, tilting-up
    this.gravityThreshold = 12; // 倾斜角度阈值（相对于基准位置的差值，降低到12°提高灵敏度）
    this.gravityCooldown = false; // 防抖冷却
    this.gravityBaseline = null; // 基准角度（用于差值检测）
    this.gravityBaselineTime = 0; // 基准设定时间
    this.gravityGestureWindow = 600; // 手势必须在此时间内完成，否则重置基准

    // 监听设备方向
    this._orientationHandler = (event) => {
      if (!this.isPlaying || this.isPaused) return;

      const beta = event.beta;   // 前后倾斜 (-180 ~ 180)
      if (beta === null || beta === undefined) return;

      if (this.gravityCooldown) {
        // 冷却期间持续更新基准，等冷却结束后立刻以当前位置为新基准
        this.gravityBaseline = beta;
        this.gravityBaselineTime = Date.now();
        return;
      }

      // 初始化基准角度：首次读取或冷却后重置
      if (this.gravityBaseline === null) {
        this.gravityBaseline = beta;
        this.gravityBaselineTime = Date.now();
        return;
      }

      // 计算相对于基准的差值（iOS 竖屏模式下 beta 始终为正，
      // 所以不能用绝对值判断，必须用差值）
      const delta = beta - this.gravityBaseline;
      const elapsed = Date.now() - this.gravityBaselineTime;

      // 如果倾斜变化太慢（超过手势窗口），说明是自然晃动，
      // 重置基准到当前位置，避免缓慢积累导致误触发
      if (elapsed > this.gravityGestureWindow && Math.abs(delta) < this.gravityThreshold) {
        this.gravityBaseline = beta;
        this.gravityBaselineTime = Date.now();
        return;
      }

      if (delta > this.gravityThreshold) {
        // 相对基准向下倾斜 → 答对
        console.log(`Gravity: correct (delta=${delta.toFixed(1)}, beta=${beta.toFixed(1)}, baseline=${this.gravityBaseline.toFixed(1)}, elapsed=${elapsed}ms)`);
        this.gravityCooldown = true;
        this.gravityBaseline = null;
        this.handleCorrect();
        setTimeout(() => {
          this.gravityCooldown = false;
        }, 600);
      } else if (delta < -this.gravityThreshold) {
        // 相对基准向上倾斜 → 跳过
        console.log(`Gravity: wrong (delta=${delta.toFixed(1)}, beta=${beta.toFixed(1)}, baseline=${this.gravityBaseline.toFixed(1)}, elapsed=${elapsed}ms)`);
        this.gravityCooldown = true;
        this.gravityBaseline = null;
        this.handleWrong();
        setTimeout(() => {
          this.gravityCooldown = false;
        }, 600);
      }
    };

    // 优先使用 deviceorientationabsolute（Chrome/Android 提供绝对方向）
    if ('ondeviceorientationabsolute' in window) {
      console.log('Using deviceorientationabsolute event');
      window.addEventListener('deviceorientationabsolute', this._orientationHandler, true);
    }
    // 同时也监听普通 deviceorientation（iOS Safari 使用此事件 + requestPermission）
    window.addEventListener('deviceorientation', this._orientationHandler, true);

    // 如果没有重力感应，使用触摸/点击作为后备
    if (!('DeviceOrientationEvent' in window)) {
      this.setupFallbackTouch();
    } else {
      // 检测是否有真实设备方向数据
      let hasRealData = false;
      const testHandler = (e) => {
        if (e.beta !== null || e.gamma !== null) {
          hasRealData = true;
        }
        window.removeEventListener('deviceorientation', testHandler);
      };
      window.addEventListener('deviceorientation', testHandler);
      setTimeout(() => {
        if (!hasRealData) {
          console.log('No gravity sensor, using fallback touch');
          this.setupFallbackTouch();
        }
      }, 1000);
    }
  }

  // 后备触摸手势（无重力感应时使用）
  setupFallbackTouch() {
    // 先移除旧监听器，防止重复绑定
    this.removeFallbackTouch();

    const card = document.getElementById('wordCard');
    let startY = 0;
    let isDragging = false;

    this._fallbackHandlers = {
      onStart: (e) => {
        if (this.isPaused || !this.isPlaying) return;
        isDragging = true;
        const touch = e.touches ? e.touches[0] : e;
        startY = touch.clientY;
        card.style.transition = 'none';
      },
      onMove: (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;
        const deltaY = touch.clientY - startY;

        // 只有实际移动超过阈值才标记为拖拽，避免 dblclick 误触
        if (Math.abs(deltaY) > 10) {
          this._dragActive = true;
        }

        card.style.transform = `translateY(${deltaY}px) rotate(${deltaY * 0.02}deg)`;

        const hintCorrect = document.getElementById('hintCorrect');
        const hintWrong = document.getElementById('hintWrong');
        if (deltaY > 50) {
          hintCorrect.style.opacity = Math.min((deltaY - 50) / 100, 1);
          hintWrong.style.opacity = 0;
        } else if (deltaY < -50) {
          hintWrong.style.opacity = Math.min((-deltaY - 50) / 100, 1);
          hintCorrect.style.opacity = 0;
        } else {
          hintCorrect.style.opacity = 0;
          hintWrong.style.opacity = 0;
        }
      },
      onEnd: (e) => {
        if (!isDragging) return;
        isDragging = false;

        const touch = e.changedTouches ? e.changedTouches[0] : e;
        const deltaY = touch.clientY - startY;

        card.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease';
        document.getElementById('hintCorrect').style.opacity = 0;
        document.getElementById('hintWrong').style.opacity = 0;

        const threshold = 80;
        if (deltaY > threshold) {
          this.handleCorrect();
        } else if (deltaY < -threshold) {
          this.handleWrong();
        } else {
          card.style.transform = 'translateY(0) rotate(0)';
        }

        // 延迟重置 _dragActive，避免 click 事件触发暂停
        setTimeout(() => { this._dragActive = false; }, 50);
      }
    };

    card.addEventListener('touchstart', this._fallbackHandlers.onStart, { passive: true });
    card.addEventListener('touchmove', this._fallbackHandlers.onMove, { passive: false });
    card.addEventListener('touchend', this._fallbackHandlers.onEnd);
    card.addEventListener('mousedown', this._fallbackHandlers.onStart);
    document.addEventListener('mousemove', this._fallbackHandlers.onMove);
    document.addEventListener('mouseup', this._fallbackHandlers.onEnd);
  }

  removeFallbackTouch() {
    if (this._fallbackHandlers) {
      const card = document.getElementById('wordCard');
      card.removeEventListener('touchstart', this._fallbackHandlers.onStart);
      card.removeEventListener('touchmove', this._fallbackHandlers.onMove);
      card.removeEventListener('touchend', this._fallbackHandlers.onEnd);
      card.removeEventListener('mousedown', this._fallbackHandlers.onStart);
      document.removeEventListener('mousemove', this._fallbackHandlers.onMove);
      document.removeEventListener('mouseup', this._fallbackHandlers.onEnd);
      this._fallbackHandlers = null;
    }
  }

  handleCorrect() {
    if (this.currentIndex >= this.currentWords.length) return;
    const word = this.currentWords[this.currentIndex];
    this.correctCount++;
    this.wordMgr.markCorrect(word);
    this.results.push({ word, correct: true });

    this.sound.playCorrect();
    this.speech.speak(word.en);

    const card = document.getElementById('wordCard');
    // 先禁用 transition，设置初始状态
    card.style.transition = 'none';
    card.style.transform = 'translateY(0) rotate(0) scale(1)';
    card.style.opacity = '1';
    card.classList.remove('swiping-wrong', 'entering');
    void card.offsetHeight;
    // 启用 transition 并触发飞出动画
    card.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease';
    card.classList.add('swiping-correct');

    const goNext = () => {
      this.currentIndex++;
      if (!this.isTimeMode && this.currentIndex >= this.wordLimit) {
        this.endGame();
      } else if (this.currentIndex >= this.currentWords.length) {
        this.endGame();
      } else {
        this.showCurrentWord();
      }
    };

    // 飞出动画后短暂显示英文，然后进入下一个
    setTimeout(() => {
      this.showEnglishBriefly(word, goNext);
    }, 400);
  }

  handleWrong() {
    if (this.currentIndex >= this.currentWords.length) return;
    const word = this.currentWords[this.currentIndex];
    this.wrongCount++;
    this.wordMgr.markWrong(word);
    this.results.push({ word, correct: false });

    this.sound.playWrong();
    this.speech.speak(word.en);

    const card = document.getElementById('wordCard');
    // 先禁用 transition，设置初始状态
    card.style.transition = 'none';
    card.style.transform = 'translateY(0) rotate(0) scale(1)';
    card.style.opacity = '1';
    card.classList.remove('swiping-correct', 'entering');
    void card.offsetHeight;
    // 启用 transition 并触发飞出动画
    card.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease';
    card.classList.add('swiping-wrong');

    const goNext = () => {
      this.currentIndex++;
      if (!this.isTimeMode && this.currentIndex >= this.wordLimit) {
        this.endGame();
      } else if (this.currentIndex >= this.currentWords.length) {
        this.endGame();
      } else {
        this.showCurrentWord();
      }
    };

    // 飞出动画后短暂显示英文，然后进入下一个
    setTimeout(() => {
      this.showEnglishBriefly(word, goNext);
    }, 400);
  }

  // ============================================
  // 暂停/继续
  // ============================================
  setupGame() {
    // 点击屏幕暂停 - 只绑定一次
    // 使用 _dragActive 标记避免拖拽后误触暂停
    this._dragActive = false;
    this._gamePageClickHandler = (e) => {
      if (!this.isPlaying || this.isPaused) return;
      // 如果是拖拽操作，不暂停
      if (this._dragActive) return;
      // 如果点击的是卡片、滑动区域或暂停覆盖层内的按钮，不暂停
      if (e.target.closest('.word-card') || e.target.closest('.game-header') || e.target.closest('#pauseOverlay')) return;
      this.pauseGame();
    };
    document.getElementById('gamePage').addEventListener('click', this._gamePageClickHandler);

    // 也监听卡片的双击来暂停（但不是在拖拽中）
    this._cardDblClickHandler = (e) => {
      if (!this.isPlaying || this.isPaused || this._dragActive) return;
      this.pauseGame();
    };
    document.getElementById('wordCard').addEventListener('dblclick', this._cardDblClickHandler);

    // 暂停覆盖层按钮 - 只绑定一次
    document.getElementById('resumeBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.resumeGame();
    });
    document.getElementById('restartBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.stopGame();
      this.startGame();
    });
    document.getElementById('quitBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.stopGame();
      this.showPage('settings');
      this.exitFullscreen();
    });
    // 阻止覆盖层背景点击冒泡
    document.getElementById('pauseOverlay').addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  pauseGame() {
    this.isPaused = true;
    document.getElementById('pauseOverlay').classList.add('active');
  }

  resumeGame() {
    this.isPaused = false;
    document.getElementById('pauseOverlay').classList.remove('active');
  }

  stopGame() {
    this.isPlaying = false;
    this.isPaused = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // 移除重力感应监听
    if (this._orientationHandler) {
      window.removeEventListener('deviceorientation', this._orientationHandler, true);
      window.removeEventListener('deviceorientationabsolute', this._orientationHandler, true);
      this._orientationHandler = null;
    }
    // 移除触摸后备监听
    this.removeFallbackTouch();
    // 释放屏幕唤醒锁
    this.releaseWakeLock();
    document.getElementById('pauseOverlay').classList.remove('active');
    window.speechSynthesis.cancel();
  }

  // ============================================
  // 游戏结束
  // ============================================
  endGame() {
    this.stopGame();
    this.sound.playEnd();
    this.exitFullscreen();
    this.showResults();
  }

  showResults() {
    this.showPage('result');

    document.getElementById('resultCorrect').textContent = this.correctCount;
    document.getElementById('resultWrong').textContent = this.wrongCount;

    const total = this.correctCount + this.wrongCount;
    document.getElementById('resultTotal').textContent = total;

    // 评语
    const rate = total > 0 ? this.correctCount / total : 0;
    let msg = '';
    if (rate >= 0.9) msg = '🎉 太厉害了！你是单词大师！';
    else if (rate >= 0.7) msg = '👏 非常不错！继续保持！';
    else if (rate >= 0.5) msg = '💪 还不错，再接再厉！';
    else msg = '📚 多练习几次就会更好！';
    document.getElementById('resultMessage').textContent = msg;

    // 答案详情
    const listEl = document.getElementById('resultWordList');
    listEl.innerHTML = this.results.map(r =>
      `<div class="result-word-item">
        <div class="result-word-icon ${r.correct ? 'correct' : 'wrong'}">
          ${r.correct ? '✓' : '✗'}
        </div>
        <span class="result-word-en">${r.word.en}</span>
        <span class="result-word-cn">${r.word.cn}</span>
      </div>`
    ).join('');

    // 按钮事件
    document.getElementById('resultRestartBtn').onclick = () => {
      this.startGame();
    };
    document.getElementById('resultReselectBtn').onclick = () => {
      this.showPage('settings');
    };
  }

  // ============================================
  // 全屏控制
  // ============================================
  requestFullscreen() {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
      else if (el.msRequestFullscreen) el.msRequestFullscreen();
    } catch (e) {}
  }

  exitFullscreen() {
    try {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
    } catch (e) {}
  }

  // ============================================
  // 屏幕唤醒锁 (Wake Lock API)
  // ============================================
  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
      }
    } catch (e) {
      console.log('Wake Lock not supported:', e.message);
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
  }
}

// ============================================
// 启动应用
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
