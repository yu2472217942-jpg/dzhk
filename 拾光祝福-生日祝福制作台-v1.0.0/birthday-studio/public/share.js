/* 拾光祝福 · 分享页交互 */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const id = window.__BLESSING_ID__;
  const meta = window.__META__ || {};
  const state = {
    data: null,
    unlocking: false,
    musicMode: 'none',
    musicStarted: false,
    musicPlaying: false,
    musicWasPlaying: false,
    musicBox: null,
    tapHintShown: false,
    voicePlaying: false,
    blown: false
  };

  const DEFAULT_CARDS = [
    { emoji: '🎂', caption: '愿你新的一岁，眼里有光，心里有爱，想要的都拥有，得不到的都释怀。' },
    { emoji: '🎁', caption: '愿所有的小愿望，都在这一年里悄悄实现。' },
    { emoji: '🌟', caption: '愿你被这个世界温柔以待，也永远有勇气做自己。' },
    { emoji: '💌', caption: '谢谢你出现在我的生活里，生日快乐。' },
    { emoji: '🥂', caption: '敬这一岁，也敬下一岁。愿你自由、热烈、闪闪发光。' },
    { emoji: '🌈', caption: '愿你今后的每一天，都比今天更开心一点。' }
  ];

  const EMOJIS = ['🎂', '🎁', '🌟', '💌', '🥂', '🌈', '✨', '🎈'];

  const themeMeta = {
    sakura: { color: '#fbe7ea' },
    midnight: { color: '#140f22' },
    mint: { color: '#e4f8f0' },
    sunset: { color: '#ffe8d4' }
  };

  function toast(message, duration) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), duration || 2600);
  }

  function setTheme(theme, font) {
    const t = themeMeta[theme] ? theme : 'sakura';
    document.body.dataset.theme = t;
    if (font) document.body.dataset.font = font;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', themeMeta[t].color);
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ------------------------------------------------------------------ */
  /* 音乐盒（内置合成音乐）                                              */
  /* ------------------------------------------------------------------ */

  function MusicBox() {
    this.ctx = null;
    this.master = null;
    this.timer = null;
    this.playing = false;
    this.loopDuration = 0;
  }

  MusicBox.prototype.ensure = function () {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  };

  MusicBox.prototype.start = function () {
    if (this.playing) return true;
    const ctx = this.ensure();
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume();
    this.playing = true;
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0.28, now + 0.5);
    this.scheduleLoop();
    return true;
  };

  MusicBox.prototype.stop = function () {
    this.playing = false;
    clearTimeout(this.timer);
    this.timer = null;
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + 0.25);
    }
  };

  MusicBox.prototype.pause = function () {
    this.stop();
  };

  MusicBox.prototype.scheduleLoop = function () {
    if (!this.playing || !this.ctx) return;
    const ctx = this.ctx;
    const beat = 0.52;
    // 生日快乐旋律（C 大调），音名 -> 频率
    const N = {
      G4: 392.00, A4: 440.00, B4: 493.88, C5: 523.25,
      D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99
    };
    const melody = [
      ['G4', 0.5], ['G4', 0.5], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
      ['G4', 0.5], ['G4', 0.5], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
      ['G4', 0.5], ['G4', 0.5], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
      ['F5', 0.5], ['F5', 0.5], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 2]
    ];
    let t = ctx.currentTime + 0.12;
    const start = t;
    melody.forEach(function (item) {
      const freq = N[item[0]];
      const dur = item[1] * beat;
      this.playNote(freq, t, dur, 0.7);
      t += dur;
    }, this);
    this.loopDuration = t - start;
    // 低音铺底，让旋律更柔和
    const chords = [
      [0, 4, 196.00], [4, 4, 261.63], [8, 4, 196.00], [12, 4, 174.61],
      [16, 4, 196.00], [20, 4, 261.63], [24, 4, 174.61], [28, 4, 196.00]
    ];
    chords.forEach(function (c) {
      this.playNote(c[2], start + c[0] * beat, c[1] * beat * 0.95, 0.12, 'sine');
    }, this);

    const wait = Math.max(1000, (this.loopDuration + 0.5) * 1000);
    this.timer = setTimeout(() => this.scheduleLoop(), wait);
  };

  MusicBox.prototype.playNote = function (freq, start, dur, vol, type) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    const peak = (vol || 0.7) * 0.3;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur * 0.92);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  };

  /* ------------------------------------------------------------------ */
  /* 提示 / 音频                                                         */
  /* ------------------------------------------------------------------ */

  function showTapHint() {
    if (state.tapHintShown || state.musicPlaying) return;
    state.tapHintShown = true;
    const el = $('#tapHint');
    if (el) el.classList.remove('hidden');
  }

  function hideTapHint() {
    const el = $('#tapHint');
    if (el) el.classList.add('hidden');
  }

  function updateMusicUi() {
    const btn = $('#musicBtn');
    if (!btn) return;
    btn.classList.toggle('playing', state.musicPlaying);
    const text = $('#musicState');
    if (text) text.textContent = state.musicPlaying ? '播放中' : '音乐';
  }

  function playMusic() {
    if (!state.data) return;
    if (state.musicMode === 'none') return;
    if (state.musicPlaying) return;
    hideTapHint();
    if (state.musicMode === 'synth') {
      if (!state.musicBox) state.musicBox = new MusicBox();
      const ok = state.musicBox.start();
      if (ok) {
        state.musicStarted = true;
        state.musicPlaying = true;
        updateMusicUi();
        if (state.musicBox.ctx && state.musicBox.ctx.state !== 'running') {
          showTapHint();
        }
      } else {
        showTapHint();
      }
      return;
    }
    const bgm = $('#bgm');
    if (!bgm || !bgm.src) return;
    bgm.play().then(function () {
      state.musicStarted = true;
      state.musicPlaying = true;
      updateMusicUi();
    }).catch(function () {
      showTapHint();
    });
  }

  function pauseMusic() {
    if (state.musicMode === 'synth' && state.musicBox) {
      state.musicBox.pause();
    } else {
      const bgm = $('#bgm');
      if (bgm) bgm.pause();
    }
    state.musicPlaying = false;
    updateMusicUi();
  }

  function toggleMusic(e) {
    if (e) e.stopPropagation();
    if (state.musicPlaying) pauseMusic();
    else playMusic();
  }

  function setupMusic(data) {
    state.musicMode = data.musicMode || 'none';
    if (data.music) {
      state.musicMode = 'file';
      const bgm = $('#bgm');
      bgm.src = data.music;
      bgm.loop = true;
      bgm.volume = 0.55;
      bgm.addEventListener('play', function () { state.musicPlaying = true; updateMusicUi(); });
      bgm.addEventListener('pause', function () { state.musicPlaying = false; updateMusicUi(); });
    } else if (state.musicMode === 'file') {
      state.musicMode = 'none';
    }
    if (state.musicMode === 'none') {
      const btn = $('#musicBtn');
      if (btn) btn.classList.add('hidden');
    }
  }

  /* ------------------------------------------------------------------ */
  /* 渲染                                                               */
  /* ------------------------------------------------------------------ */

  function renderMemories(data) {
    const list = $('#memoryList');
    list.innerHTML = '';
    let cards = (data.cards || []).slice();
    if (!cards.length) {
      cards = DEFAULT_CARDS.slice(0, 6).map((c, i) => ({ emoji: c.emoji, caption: c.caption }));
    } else if (cards.length < 3) {
      const fill = DEFAULT_CARDS.slice(cards.length, 3);
      fill.forEach(c => cards.push({ emoji: c.emoji, caption: c.caption }));
    }

    cards.forEach((card, index) => {
      const hasImage = !!card.src;
      const article = document.createElement('article');
      article.className = 'memory-card';

      const dot = document.createElement('span');
      dot.className = 'memory-dot';
      article.appendChild(dot);

      const photo = document.createElement('div');
      photo.className = 'memory-photo' + (hasImage ? '' : ' no-photo');
      if (hasImage) {
        const img = document.createElement('img');
        img.src = card.src;
        img.alt = '';
        img.loading = index < 2 ? 'eager' : 'lazy';
        img.decoding = 'async';
        photo.appendChild(img);
      } else {
        const emoji = document.createElement('span');
        emoji.className = 'memory-emoji';
        emoji.textContent = card.emoji || EMOJIS[index % EMOJIS.length];
        photo.appendChild(emoji);
      }
      article.appendChild(photo);

      const text = document.createElement('div');
      text.className = 'memory-text';
      const p = document.createElement('p');
      p.textContent = card.caption || (DEFAULT_CARDS[index % DEFAULT_CARDS.length] || {}).caption || '';
      text.appendChild(p);
      const tag = document.createElement('span');
      tag.className = 'memory-tag';
      tag.textContent = 'MEMORY ' + String(index + 1).padStart(2, '0');
      text.appendChild(tag);
      article.appendChild(text);

      list.appendChild(article);
    });

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      $$('.memory-card', list).forEach(el => io.observe(el));
    } else {
      $$('.memory-card', list).forEach(el => el.classList.add('in'));
    }
  }

  function renderBlessing(data) {
    $('#blessingText').textContent = data.blessing || '';
    $('#letterSender').textContent = data.sender || '我';
    $('#letterSign').textContent = data.sender || '我';
    $('#footerName').textContent = data.sender || '我';
    $('#voiceSender').textContent = data.sender || '我';
  }

  function setupVoice(data) {
    if (!data.voice) {
      $('#voiceSection').classList.add('hidden');
      return;
    }
    $('#voiceSection').classList.remove('hidden');
    const audio = $('#voiceAudio');
    audio.src = data.voice;
    const btn = $('#voicePlay');
    const bar = $('#voiceBar');
    const track = $('#voiceTrack');
    const time = $('#voiceTime');

    function setBtn(playing) {
      btn.textContent = playing ? '❚❚' : '▶';
      btn.setAttribute('aria-label', playing ? '暂停录音' : '播放录音');
    }

    audio.addEventListener('loadedmetadata', function () {
      time.textContent = '0:00 / ' + formatTime(audio.duration);
    });
    audio.addEventListener('timeupdate', function () {
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      bar.style.width = pct + '%';
      time.textContent = formatTime(audio.currentTime) + ' / ' + formatTime(audio.duration);
    });
    audio.addEventListener('play', function () {
      state.voicePlaying = true;
      setBtn(true);
      // 播录音时，背景音乐先让路
      state.musicWasPlaying = state.musicPlaying;
      if (state.musicPlaying) pauseMusic();
    });
    audio.addEventListener('pause', function () {
      state.voicePlaying = false;
      setBtn(false);
      if (state.musicWasPlaying) {
        state.musicWasPlaying = false;
        playMusic();
      }
    });
    audio.addEventListener('ended', function () {
      state.voicePlaying = false;
      setBtn(false);
      bar.style.width = '0%';
      if (state.musicWasPlaying) {
        state.musicWasPlaying = false;
        playMusic();
      }
    });
    audio.addEventListener('error', function () {
      toast('录音加载失败，可能文件格式不被当前浏览器支持');
    });

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (audio.paused) audio.play().catch(() => toast('点击播放录音失败，请再试一次'));
      else audio.pause();
    });
    track.addEventListener('click', function (e) {
      if (!audio.duration) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      audio.currentTime = pct * audio.duration;
    });
  }

  /* ------------------------------------------------------------------ */
  /* 交互                                                               */
  /* ------------------------------------------------------------------ */

  function scrollToMemories() {
    const target = $('#memoriesScreen');
    if (!target) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  function floatingHearts(source) {
    const rect = source.getBoundingClientRect();
    const count = 14;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.textContent = Math.random() > 0.35 ? '♥' : '✦';
      el.style.position = 'fixed';
      el.style.left = (rect.left + rect.width / 2) + 'px';
      el.style.top = (rect.top + rect.height / 2) + 'px';
      el.style.zIndex = '75';
      el.style.pointerEvents = 'none';
      el.style.color = i % 3 === 0 ? 'var(--accent-3)' : 'var(--accent)';
      el.style.fontSize = (12 + Math.random() * 15) + 'px';
      el.style.opacity = '0';
      el.style.transition = 'transform 1.1s cubic-bezier(.2,.7,.3,1), opacity 1.1s ease';
      document.body.appendChild(el);
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translate(' + (Math.random() * 160 - 80) + 'px,' + (-90 - Math.random() * 130) + 'px) rotate(' + (Math.random() * 80 - 40) + 'deg)';
      });
      setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
      }, 900);
    }
  }

  function setupInteractions(data) {
    const like = $('#likeBtn');
    like.addEventListener('click', function (e) {
      e.stopPropagation();
      playMusic();
      floatingHearts(like);
      like.innerHTML = '<span class="heart-icon">♥</span> 收到啦';
      setTimeout(scrollToMemories, 650);
    });

    const blow = $('#blowBtn');
    blow.addEventListener('click', function (e) {
      e.stopPropagation();
      if (state.blown) return;
      state.blown = true;
      $('#cake').classList.add('blown');
      blow.textContent = '愿望已许下';
      blow.disabled = true;
      floatingHearts(blow);
      toast('愿望已许下，一定会实现 ✦', 3200);
    });

    $$('.flame').forEach(flame => {
      flame.addEventListener('click', function (e) {
        e.stopPropagation();
        blow.click();
      });
    });

    $('#fireworksBtn').addEventListener('click', function () {
      if (!window.BirthdayFX) return;
      const text = (data.recipient || '你') + '，生日快乐';
      window.BirthdayFX.start(text, { duration: 5200 });
    });

    $('#topBtn').addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const musicBtn = $('#musicBtn');
    musicBtn.addEventListener('click', toggleMusic);

    const tapHint = $('#tapHint');
    tapHint.addEventListener('click', function () {
      hideTapHint();
      playMusic();
    });

    // 第一次轻触页面时尝试开启音乐（不抢音乐按钮）
    const firstTouch = function (e) {
      if (e.target.closest('#musicBtn')) return;
      hideTapHint();
      if (state.musicBox && state.musicBox.ctx && state.musicBox.ctx.state === 'suspended') {
        state.musicBox.ctx.resume();
      }
      if (!state.musicStarted) playMusic();
    };
    document.addEventListener('pointerdown', firstTouch, { once: true, passive: true });

    let lastY = window.scrollY;
    window.addEventListener('scroll', function () {
      const y = window.scrollY;
      const hint = $('#scrollHint');
      if (hint && y > 40) hint.classList.add('gone');
      if (y < lastY - 30) {
        // 向上滑回时，不自动做任何事，保留控制感
      }
      lastY = y;
    }, { passive: true });

    // 离开页面时暂停音乐
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (state.musicPlaying) pauseMusic();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 主流程                                                             */
  /* ------------------------------------------------------------------ */

  function showApp(data, fromLogin) {
    state.data = data;
    setTheme(data.theme, data.font);
    $('#loginScreen').classList.add('hidden');
    const app = $('#app');
    app.classList.remove('hidden');

    $('#cakeRecipient').textContent = data.recipient || '你';
    $('#cakeWish').textContent = data.title && data.title !== '生日快乐'
      ? data.title
      : '愿所有美好，都如期而至。';
    $('#loginRecipient').textContent = data.recipient || '你';

    renderMemories(data);
    renderBlessing(data);
    setupVoice(data);
    setupMusic(data);
    setupInteractions(data);

    window.scrollTo(0, 0);

    if (fromLogin) {
      const text = (data.recipient || '你') + '\n生日快乐';
      if (window.BirthdayFX) {
        window.BirthdayFX.start(text, { duration: 5000 });
      }
      setTimeout(function () {
        if (!state.musicStarted) showTapHint();
      }, 1400);
    } else {
      setTimeout(function () {
        if (!state.musicStarted) showTapHint();
      }, 1200);
    }

    // 进入页面后先尝试播放（浏览器可能拦截，会显示轻触提示）
    setTimeout(function () {
      if (!state.musicStarted) playMusic();
    }, 500);
  }

  function showLogin() {
    $('#loginScreen').classList.remove('hidden');
    $('#app').classList.add('hidden');
  }

  async function fetchData() {
    const res = await fetch('/api/blessings/' + encodeURIComponent(id) + '/data', {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });
    if (!res.ok) {
      const err = new Error('not unlocked');
      err.status = res.status;
      throw err;
    }
    const json = await res.json();
    return json.blessing;
  }

  async function unlock(password) {
    const res = await fetch('/api/blessings/' + encodeURIComponent(id) + '/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: password })
    });
    let json = null;
    try { json = await res.json(); } catch (e) { json = null; }
    if (!res.ok) {
      const err = new Error((json && json.error) || '密码不对哦');
      err.status = res.status;
      throw err;
    }
    return json;
  }

  function initLogin() {
    const recipient = meta.recipient || '你';
    $('#loginRecipient').textContent = recipient;
    $('#loginHint').textContent = '提示：' + (meta.hint || '生日密码');
    const nameInput = $('#userName');
    if (nameInput && !nameInput.value) nameInput.value = recipient;
    if (meta.cover) {
      const photo = $('#loginPhoto');
      photo.style.backgroundImage = 'url("' + String(meta.cover).replace(/"/g, '%22') + '")';
    }

    const pwd = $('#pwd');
    pwd.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '');
      $('#loginError').textContent = '';
    });

    $('#loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (state.unlocking) return;
      const value = pwd.value.trim();
      if (!/^\d{4,8}$/.test(value)) {
        $('#loginError').textContent = '请输入 4–8 位生日密码';
        pwd.focus();
        return;
      }
      const btn = $('#loginBtn');
      state.unlocking = true;
      btn.disabled = true;
      btn.querySelector('span').textContent = '验证中…';
      $('#loginError').textContent = '';
      // 用这次点击手势预热音频
      try {
        if (!state.musicBox) state.musicBox = new MusicBox();
        const ctx = state.musicBox.ensure();
        if (ctx && ctx.state === 'suspended') ctx.resume();
      } catch (e) { /* ignore */ }
      try {
        await unlock(value);
        const data = await fetchData();
        showApp(data, true);
      } catch (err) {
        const card = $('#loginCard');
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        $('#loginError').textContent = err.status === 429
          ? '试得有点多啦，休息十分钟再试吧'
          : (err.message || '密码不对哦，再想想～');
        pwd.value = '';
        pwd.focus();
      } finally {
        state.unlocking = false;
        btn.disabled = false;
        btn.querySelector('span').textContent = '进入惊喜';
      }
    });
  }

  async function boot() {
    setTheme(meta.theme || document.body.dataset.theme, meta.font || document.body.dataset.font);
    initLogin();
    try {
      const data = await fetchData();
      showApp(data, false);
    } catch (err) {
      showLogin();
      if (err.status === 404) {
        $('#loginError').textContent = '这份祝福不存在或已经被删除';
        $('#loginForm').querySelector('button').disabled = true;
      }
    }
  }

  boot();
})();
