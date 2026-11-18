/* 拾光祝福 · 制作台交互 */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const state = {
    session: null,
    editingId: null,
    cards: [],
    musicMode: 'synth',
    musicData: null,
    musicKeep: false,
    musicPreviewUrl: '',
    voiceData: null,
    voiceKeep: false,
    voicePreviewUrl: '',
    list: [],
    saving: false,
    resultId: null,
    qr: null,
    dirty: false
  };

  const DEFAULT_BLESSING = '愿你新的一岁，眼里有光，心里有爱。\n想要的都拥有，得不到的都释怀。\n生日快乐，岁岁欢愉，年年胜意。';

  const TEMPLATES = {
    gentle: '愿你新的一岁，眼里有光，心里有爱。\n想要的都拥有，得不到的都释怀。\n生日快乐，岁岁欢愉，年年胜意。',
    playful: '祝你：\n百事可乐，万事芬达，天天哇哈哈，月月乐百事。\n吃蛋糕不长胖，许的愿望都实现！\n生日快乐呀～',
    deep: '谢谢你出现在我的生活里。\n愿你被这个世界温柔以待，愿你所有的努力都不被辜负。\n不管多少岁，在我这里你永远可以做个小孩。\n生日快乐。',
    short: '生日快乐。\n愿你今天开心，以后每天都比今天更开心一点。'
  };

  const themeNames = { sakura: '樱粉', midnight: '星夜', mint: '薄荷', sunset: '落日' };

  /* ------------------------------------------------------------------ */
  /* 基础工具                                                           */
  /* ------------------------------------------------------------------ */

  function toast(message, duration) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), duration || 2600);
  }

  async function api(path, options) {
    const res = await fetch(path, Object.assign({
      headers: { 'Content-Type': 'application/json' }
    }, options || {}));
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const err = new Error((data && data.error) || ('请求失败 (' + res.status + ')'));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片格式不支持，请换 JPG / PNG'));
      img.src = dataUrl;
    });
  }

  async function prepareImage(file) {
    if (file.size > 15 * 1024 * 1024) throw new Error('单张图片不能超过 15MB');
    const raw = await readAsDataURL(file);
    // GIF 保留动图，不压缩
    if (file.type === 'image/gif') {
      if (file.size > 12 * 1024 * 1024) throw new Error('GIF 动图不能超过 12MB');
      return raw;
    }
    const img = await loadImage(raw);
    const maxSide = 1600;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error('图片读取失败');
    const ratio = Math.min(1, maxSide / Math.max(w, h));
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.86);
  }

  function prepareAudio(file) {
    if (!file) return Promise.reject(new Error('没有选择文件'));
    if (file.size > 30 * 1024 * 1024) return Promise.reject(new Error('音频不能超过 30MB'));
    const type = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();
    if (!/^audio\//.test(type) && !/\.(mp3|m4a|wav|ogg|aac)$/.test(name)) {
      return Promise.reject(new Error('请选择 MP3 / M4A / WAV 音频'));
    }
    return readAsDataURL(file);
  }

  /* ------------------------------------------------------------------ */
  /* 管理密码                                                           */
  /* ------------------------------------------------------------------ */

  async function enterStudio(session) {
    state.session = session;
    $('#lockScreen').classList.add('hidden');
    $('#studio').classList.remove('hidden');
    await loadList();
    renderPreview();
  }

  async function boot() {
    try {
      const data = await api('/api/admin/session');
      await enterStudio(data.session);
    } catch (err) {
      if (err.status !== 401) toast(err.message);
      $('#lockScreen').classList.remove('hidden');
      $('#adminKey').focus();
    }
  }

  $('#lockForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = $('#lockBtn');
    const key = $('#adminKey').value.trim();
    if (!key) return;
    btn.disabled = true;
    btn.textContent = '验证中…';
    $('#lockError').textContent = '';
    try {
      const data = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ key }) });
      await enterStudio(data.session);
    } catch (err) {
      $('#lockError').textContent = err.message || '密码不对';
      $('#adminKey').select();
    } finally {
      btn.disabled = false;
      btn.textContent = '进入制作台';
    }
  });

  $('#logoutBtn').addEventListener('click', async function () {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    location.reload();
  });

  /* ------------------------------------------------------------------ */
  /* 照片墙                                                             */
  /* ------------------------------------------------------------------ */

  function renderPhotos() {
    const grid = $('#photoGrid');
    grid.innerHTML = '';
    state.cards.forEach((card, index) => {
      const el = document.createElement('div');
      el.className = 'photo-card';
      const src = card.image && card.image.startsWith('data:') ? card.image : card.previewUrl;
      el.innerHTML =
        '<div class="photo-thumb">' +
          (src ? '<img alt="照片" src="' + escapeHtml(src) + '">' : '<div class="photo-placeholder">✧</div>') +
          '<button type="button" class="remove-photo" data-remove="' + index + '" aria-label="移除这张照片">×</button>' +
        '</div>' +
        '<input class="photo-caption" data-caption="' + index + '" maxlength="80" placeholder="给这张照片配一句话…" value="' + escapeHtml(card.caption || '') + '">';
      grid.appendChild(el);
    });
    if (state.cards.length < 9) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'photo-add';
      add.innerHTML = '<span class="plus">＋</span><span>添加照片</span><span>' + state.cards.length + ' / 9</span>';
      add.addEventListener('click', () => $('#photoInput').click());
      grid.appendChild(add);
    }
    $('#photoHelp').textContent = state.cards.length
      ? '已添加 ' + state.cards.length + ' 张，可以给每张配一句话。'
      : '没有照片也没关系，页面会自动生成好看的祝福卡片。';
    renderPreview();
  }

  $('#photoGrid').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    const index = Number(btn.getAttribute('data-remove'));
    state.cards.splice(index, 1);
    state.dirty = true;
    renderPhotos();
  });

  $('#photoGrid').addEventListener('input', function (e) {
    const input = e.target.closest('[data-caption]');
    if (!input) return;
    const index = Number(input.getAttribute('data-caption'));
    if (state.cards[index]) {
      state.cards[index].caption = input.value;
      state.dirty = true;
    }
  });

  $('#addPhotoBtn').addEventListener('click', () => $('#photoInput').click());

  $('#photoInput').addEventListener('change', async function () {
    const files = Array.from(this.files || []);
    this.value = '';
    if (!files.length) return;
    const remain = 9 - state.cards.length;
    if (remain <= 0) { toast('最多放 9 张照片'); return; }
    toast('正在处理照片…', 1200);
    for (const file of files.slice(0, remain)) {
      try {
        const dataUrl = await prepareImage(file);
        state.cards.push({ image: dataUrl, previewUrl: dataUrl, caption: '' });
        state.dirty = true;
        renderPhotos();
      } catch (err) {
        toast(err.message, 3200);
      }
    }
  });

  /* ------------------------------------------------------------------ */
  /* 声音                                                               */
  /* ------------------------------------------------------------------ */

  function setMusicMode(mode, silent) {
    state.musicMode = mode;
    $$('#musicModeGroup button').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    $('#musicUploadRow').classList.toggle('hidden', mode !== 'file');
    if (mode === 'synth') {
      $('#musicHelp').textContent = '内置八音盒会演奏一段轻柔的《生日快乐》，无需上传文件。';
    } else if (mode === 'none') {
      $('#musicHelp').textContent = '页面不会自动播放背景音乐，录音仍然可以正常播放。';
    } else {
      $('#musicHelp').textContent = '支持 MP3 / M4A / WAV，建议 30MB 以内。';
    }
    if (mode !== 'file') {
      $('#musicPreview').classList.add('hidden');
      $('#musicPreview').pause();
      $('#musicName').textContent = mode === 'none' ? '不使用背景音乐' : '使用内置音乐盒';
    } else if (state.musicPreviewUrl) {
      $('#musicPreview').src = state.musicPreviewUrl;
      $('#musicPreview').classList.remove('hidden');
      $('#musicName').textContent = state.musicData ? '已选择新音频' : '已上传的背景音乐';
    } else {
      $('#musicName').textContent = '未选择';
    }
    if (!silent) state.dirty = true;
  }

  $('#musicModeGroup').addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-mode]');
    if (btn) setMusicMode(btn.dataset.mode);
  });

  $('#pickMusicBtn').addEventListener('click', () => $('#musicFile').click());

  $('#musicFile').addEventListener('change', async function () {
    const file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    try {
      const dataUrl = await prepareAudio(file);
      state.musicData = dataUrl;
      state.musicKeep = false;
      state.musicPreviewUrl = dataUrl;
      $('#musicName').textContent = file.name;
      $('#musicPreview').src = dataUrl;
      $('#musicPreview').classList.remove('hidden');
      state.dirty = true;
      toast('背景音乐已选好');
    } catch (err) {
      toast(err.message, 3200);
    }
  });

  $('#pickVoiceBtn').addEventListener('click', () => $('#voiceFile').click());

  $('#voiceFile').addEventListener('change', async function () {
    const file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    try {
      const dataUrl = await prepareAudio(file);
      state.voiceData = dataUrl;
      state.voiceKeep = false;
      state.voicePreviewUrl = dataUrl;
      $('#voiceName').textContent = file.name;
      $('#voicePreview').src = dataUrl;
      $('#voicePreview').classList.remove('hidden');
      $('#removeVoiceBtn').classList.remove('hidden');
      state.dirty = true;
      toast('录音已添加');
    } catch (err) {
      toast(err.message, 3200);
    }
  });

  $('#removeVoiceBtn').addEventListener('click', function () {
    state.voiceData = null;
    state.voiceKeep = false;
    state.voicePreviewUrl = '';
    $('#voiceName').textContent = '还没有录音';
    $('#voicePreview').src = '';
    $('#voicePreview').classList.add('hidden');
    $('#removeVoiceBtn').classList.add('hidden');
    state.dirty = true;
  });

  /* ------------------------------------------------------------------ */
  /* 主题 / 预览                                                        */
  /* ------------------------------------------------------------------ */

  function setTheme(theme) {
    $$('#themeRow .theme-swatch').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === theme));
    $('#phonePreview').dataset.theme = theme;
    state.dirty = true;
  }

  function setFont(font) {
    $$('#fontGroup button').forEach(btn => btn.classList.toggle('active', btn.dataset.font === font));
    state.dirty = true;
  }

  function renderPreview() {
    const recipient = $('#recipient').value.trim() || '小寿星';
    const sender = $('#sender').value.trim() || '一个爱你的人';
    $('#pvRecipient').textContent = recipient;
    $('#pvSender').textContent = sender;
    const photos = $('#pvPhotos');
    photos.innerHTML = '';
    state.cards.filter(c => c.image || c.previewUrl).slice(0, 3).forEach((card, i) => {
      const src = card.image && card.image.startsWith('data:') ? card.image : card.previewUrl;
      if (!src) return;
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.style.setProperty('--r', (i % 2 ? 4 : -4) + 'deg');
      photos.appendChild(img);
    });
  }

  $('#themeRow').addEventListener('click', function (e) {
    const btn = e.target.closest('.theme-swatch');
    if (btn) setTheme(btn.dataset.theme);
  });

  $('#fontGroup').addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-font]');
    if (btn) setFont(btn.dataset.font);
  });

  $('#recipient').addEventListener('input', renderPreview);
  $('#sender').addEventListener('input', renderPreview);

  /* ------------------------------------------------------------------ */
  /* 祝福语模板                                                         */
  /* ------------------------------------------------------------------ */

  function updateCount() {
    const el = $('#blessing');
    $('#blessingCount').textContent = el.value.length + ' / 3000';
  }

  $('#blessing').addEventListener('input', function () { updateCount(); state.dirty = true; });

  $('#templateChips').addEventListener('click', function (e) {
    const chip = e.target.closest('[data-template]');
    if (!chip) return;
    const text = TEMPLATES[chip.dataset.template];
    if (!text) return;
    const el = $('#blessing');
    if (el.value.trim() && el.value.trim() !== DEFAULT_BLESSING.trim()) {
      if (!confirm('替换当前的祝福语吗？')) return;
    }
    el.value = text;
    updateCount();
    state.dirty = true;
    toast('已换上一段新的祝福');
  });

  /* ------------------------------------------------------------------ */
  /* 保存                                                               */
  /* ------------------------------------------------------------------ */

  function validateForm() {
    const recipient = $('#recipient').value.trim();
    const sender = $('#sender').value.trim();
    const password = $('#password').value.trim();
    const blessing = $('#blessing').value.trim();
    if (!recipient) { toast('请先填写收件人的名字'); $('#recipient').focus(); return null; }
    if (!sender) { toast('请填写送祝福的人'); $('#sender').focus(); return null; }
    if (!blessing) { toast('写一句祝福语吧'); $('#blessing').focus(); return null; }
    if (!state.editingId || password) {
      if (!/^\d{4,8}$/.test(password)) {
        toast('生日密码请填 4 到 8 位数字，例如 0707');
        $('#password').focus();
        return null;
      }
    }
    if (state.musicMode === 'file' && !state.musicData && !state.musicKeep) {
      toast('请选择背景音乐，或切换成内置音乐盒');
      return null;
    }
    return { recipient, sender, password, blessing };
  }

  function buildPayload(fields) {
    const memories = state.cards
      .filter(card => card.image || card.caption)
      .map(card => ({ image: card.image || '', caption: card.caption || '' }));
    const themeBtn = $('#themeRow .theme-swatch.active');
    const fontBtn = $('#fontGroup button.active');
    return {
      recipient: fields.recipient,
      sender: fields.sender,
      password: fields.password || undefined,
      hint: $('#hint').value.trim() || '生日密码',
      title: '生日快乐',
      blessing: fields.blessing,
      theme: themeBtn ? themeBtn.dataset.theme : 'sakura',
      font: fontBtn ? fontBtn.dataset.font : 'default',
      memories,
      musicMode: state.musicMode,
      musicData: state.musicData || undefined,
      keepMusic: !state.musicData && state.musicKeep,
      voiceData: state.voiceData || undefined,
      keepVoice: !state.voiceData && state.voiceKeep
    };
  }

  function requestJSON(method, url, payload, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 180000;
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
      };
      xhr.onload = function () {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
        const err = new Error((data && data.error) || ('保存失败 (' + xhr.status + ')'));
        err.status = xhr.status;
        err.data = data;
        reject(err);
      };
      xhr.onerror = function () { reject(new Error('网络连接失败，请确认服务还在运行')); };
      xhr.ontimeout = function () { reject(new Error('上传超时，请换小一点的照片或音频')); };
      xhr.send(JSON.stringify(payload));
    });
  }

  async function save(openPreview) {
    if (state.saving) return;
    const fields = validateForm();
    if (!fields) return;
    const payload = buildPayload(fields);
    const btn = $('#saveBtn');
    const oldText = btn.textContent;
    state.saving = true;
    btn.disabled = true;
    btn.textContent = '正在保存…';
    try {
      const isEdit = !!state.editingId;
      const url = isEdit ? '/api/admin/blessings/' + state.editingId : '/api/admin/blessings';
      const method = isEdit ? 'PUT' : 'POST';
      const data = await requestJSON(method, url, payload, pct => {
        btn.textContent = '正在保存 ' + pct + '%';
      });
      const id = data.id || state.editingId;
      state.editingId = id;
      state.dirty = false;
      // 媒体已经写入服务器，后续保存改用 keep，避免重复上传
      if (Array.isArray(data.cards)) {
        state.cards = data.cards.map((card, i) => {
          const old = state.cards[i] || {};
          return {
            image: card.file ? 'keep:' + card.file : '',
            previewUrl: old.previewUrl || (old.image && old.image.startsWith('data:') ? old.image : ''),
            caption: card.caption || ''
          };
        });
      }
      state.musicData = null;
      state.musicKeep = !!data.music;
      state.voiceData = null;
      state.voiceKeep = !!data.voice;
      renderPhotos();
      $('#editorEyebrow').textContent = 'EDIT BLESSING';
      $('#editorTitle').textContent = '修改这份祝福';
      $('#editorSub').textContent = '修改后链接不变，已经发出去的链接也会看到新内容。';
      $('#draftBadge').textContent = '已保存';
      $('#saveBtn').textContent = '保存修改';
      $('#saveNote').textContent = '已保存。可以继续修改，也可以把链接发给 TA 了。';
      $('#password').value = '';
      $('#password').placeholder = '留空则不修改';
      toast('保存成功');
      await loadList();
      showResult(id, fields.recipient);
      if (openPreview) {
        const base = currentResultBase();
        if (base) window.open(base + '/s/' + id, '_blank');
      }
    } catch (err) {
      if (err.status === 401) {
        toast('登录已过期，请重新输入管理密码');
        location.reload();
        return;
      }
      toast(err.message || '保存失败', 4000);
    } finally {
      state.saving = false;
      btn.disabled = false;
      btn.textContent = state.editingId ? '保存修改' : '生成祝福链接';
    }
  }

  $('#form').addEventListener('submit', function (e) {
    e.preventDefault();
    save(false);
  });

  $('#previewBtn').addEventListener('click', function () {
    save(true);
  });

  /* ------------------------------------------------------------------ */
  /* 结果 / 二维码                                                      */
  /* ------------------------------------------------------------------ */

  function currentResultBase() {
    const select = $('#baseSelect');
    return select && select.value ? select.value.replace(/\/$/, '') : '';
  }

  function fillBaseOptions() {
    const select = $('#baseSelect');
    const prev = select.value;
    select.innerHTML = '';
    const bases = [];
    const seen = new Set();
    const add = (label, url) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      bases.push({ label, url: url.replace(/\/$/, '') });
    };
    const origin = location.origin;
    const isLocalHost = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(origin);
    if (!isLocalHost) add('当前访问地址', origin);
    if (state.session && state.session.publicBaseUrl) add('公网地址', state.session.publicBaseUrl);
    if (state.session && state.session.baseUrls) {
      state.session.baseUrls.forEach(item => {
        if (item.url.indexOf('127.0.0.1') >= 0 || item.url.indexOf('localhost') >= 0) return;
        add(item.label, item.url);
      });
    }
    if (!bases.length) add('本机地址', origin);
    bases.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.url;
      opt.textContent = item.label + ' · ' + item.url;
      select.appendChild(opt);
    });
    if (prev && bases.some(b => b.url === prev)) {
      select.value = prev;
      return;
    }
    if (state.session && state.session.publicBaseUrl) {
      select.value = state.session.publicBaseUrl.replace(/\/$/, '');
      return;
    }
    if (!isLocalHost) {
      select.value = origin;
      return;
    }
    const lan = bases.find(b => b.label.indexOf('局域网') >= 0);
    select.value = (lan || bases[0]).url;
  }

  function renderQr(url) {
    const box = $('#qrBox');
    box.innerHTML = '';
    if (typeof QRCode === 'undefined') {
      box.textContent = '二维码组件加载失败';
      return;
    }
    state.qr = new QRCode(box, {
      text: url,
      width: 170,
      height: 170,
      colorDark: '#241c2b',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  function updateResultLink() {
    const base = currentResultBase();
    const url = base + '/s/' + state.resultId;
    $('#shareLink').value = url;
    renderQr(url);
    const isLan = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(base);
    const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(base);
    if (isLocal) {
      $('#shareHint').textContent = '这个地址只能在这台电脑上打开。要发给手机，请选择局域网地址，或部署到公网。';
    } else if (isLan) {
      $('#shareHint').textContent = '同一个 Wi-Fi 下，手机扫码即可打开。发给异地朋友需要公网部署。';
    } else {
      $('#shareHint').textContent = '这是公网地址，微信 / QQ 打开后输入生日密码即可。';
    }
  }

  function showResult(id, recipient) {
    state.resultId = id;
    $('#resultTitle').textContent = '祝福已经准备好了';
    $('#resultSub').textContent = '把链接或二维码发给 ' + (recipient || 'TA') + '，输入生日密码就能打开。';
    fillBaseOptions();
    updateResultLink();
    $('#resultModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function hideResult() {
    $('#resultModal').classList.add('hidden');
    document.body.style.overflow = '';
  }

  $('#baseSelect').addEventListener('change', updateResultLink);
  $('#closeModalBtn').addEventListener('click', hideResult);
  $('#editAgainBtn').addEventListener('click', hideResult);
  $$('[data-close-modal]').forEach(el => el.addEventListener('click', hideResult));

  $('#copyLinkBtn').addEventListener('click', async function () {
    const value = $('#shareLink').value;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast('链接已复制');
    } catch (e) {
      const input = $('#shareLink');
      input.select();
      input.setSelectionRange(0, 99999);
      try { document.execCommand('copy'); toast('链接已复制'); }
      catch (err) { toast('复制失败，请长按输入框手动复制'); }
    }
  });

  $('#openShareBtn').addEventListener('click', function () {
    const base = currentResultBase();
    if (base) window.open(base + '/s/' + state.resultId, '_blank');
  });

  $('#downloadQrBtn').addEventListener('click', function () {
    const box = $('#qrBox');
    const canvas = box.querySelector('canvas');
    const img = box.querySelector('img');
    let url = '';
    if (canvas) {
      try { url = canvas.toDataURL('image/png'); } catch (e) { url = ''; }
    }
    if (!url && img) url = img.src;
    if (!url) { toast('二维码还没准备好'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'birthday-qr-' + (state.resultId || 'code') + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  /* ------------------------------------------------------------------ */
  /* 我的祝福                                                           */
  /* ------------------------------------------------------------------ */

  async function loadList() {
    try {
      const data = await api('/api/admin/blessings');
      state.list = data.items || [];
      renderList();
    } catch (err) {
      if (err.status === 401) { location.reload(); return; }
      toast(err.message);
    }
  }

  function renderList() {
    const grid = $('#listGrid');
    grid.innerHTML = '';
    $('#emptyState').classList.toggle('hidden', state.list.length > 0);
    state.list.forEach(item => {
      const card = document.createElement('article');
      card.className = 'blessing-card';
      card.innerHTML =
        '<div class="blessing-cover">' +
          '<span class="cover-theme">' + escapeHtml(themeNames[item.theme] || '樱粉') + '</span>' +
        '</div>' +
        '<div class="blessing-body">' +
          '<h3>' + escapeHtml(item.recipient) + ' <span style="font-size:12px;color:#a99aa4;font-weight:400">的生日祝福</span></h3>' +
          '<div class="meta"><span>来自 ' + escapeHtml(item.sender) + '</span><span>·</span><span>' + formatDate(item.updatedAt) + '</span><span>·</span><span>' + (item.views || 0) + ' 次打开</span></div>' +
          '<p class="quote">' + escapeHtml((item.blessing || '').slice(0, 70)) + '</p>' +
          '<div class="blessing-actions">' +
            '<button class="btn btn-soft" data-action="edit" data-id="' + item.id + '">编辑</button>' +
            '<button class="btn btn-ghost" data-action="share" data-id="' + item.id + '" data-name="' + escapeHtml(item.recipient) + '">链接 / 二维码</button>' +
            '<button class="btn btn-ghost" data-action="open" data-id="' + item.id + '">打开</button>' +
            '<button class="btn btn-text" data-action="delete" data-id="' + item.id + '">删除</button>' +
          '</div>' +
        '</div>';
      const cover = card.querySelector('.blessing-cover');
      if (item.imageCount && item.coverFile) {
        const img = document.createElement('img');
        img.alt = '';
        img.src = '/media/' + encodeURIComponent(item.id) + '/' + encodeURIComponent(item.coverFile);
        cover.insertBefore(img, cover.firstChild);
      } else {
        const emoji = document.createElement('div');
        emoji.className = 'cover-emoji';
        emoji.textContent = '🎂';
        cover.insertBefore(emoji, cover.firstChild);
      }
      grid.appendChild(card);
    });
  }

  $('#listGrid').addEventListener('click', async function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'edit') {
      await loadForEdit(id);
    } else if (action === 'share') {
      showResult(id, btn.dataset.name || '');
    } else if (action === 'open') {
      window.open('/s/' + id, '_blank');
    } else if (action === 'delete') {
      if (!confirm('确定删除这份祝福吗？删除后链接会失效，且无法恢复。')) return;
      try {
        await api('/api/admin/blessings/' + id, { method: 'DELETE' });
        toast('已删除');
        await loadList();
      } catch (err) {
        toast(err.message);
      }
    }
  });

  async function loadForEdit(id) {
    try {
      const data = await api('/api/admin/blessings/' + id);
      const item = data.item;
      state.editingId = id;
      state.cards = (item.cards || []).map(card => ({
        image: card.file ? 'keep:' + card.file : '',
        previewUrl: card.imageUrl || '',
        caption: card.caption || ''
      }));
      state.musicMode = item.musicMode || 'none';
      state.musicData = null;
      state.musicKeep = !!item.music;
      state.musicPreviewUrl = item.musicUrl || '';
      state.voiceData = null;
      state.voiceKeep = !!item.voice;
      state.voicePreviewUrl = item.voiceUrl || '';

      $('#recipient').value = item.recipient || '';
      $('#sender').value = item.sender || '';
      $('#password').value = '';
      $('#password').placeholder = '留空则不修改';
      $('#hint').value = item.hint || '';
      $('#blessing').value = item.blessing || '';
      updateCount();

      setMusicMode(state.musicMode, true);
      if (item.musicUrl) {
        $('#musicName').textContent = '已上传的背景音乐';
        $('#musicPreview').src = item.musicUrl;
        $('#musicPreview').classList.remove('hidden');
      }
      if (item.voiceUrl) {
        $('#voiceName').textContent = '已上传的录音';
        $('#voicePreview').src = item.voiceUrl;
        $('#voicePreview').classList.remove('hidden');
        $('#removeVoiceBtn').classList.remove('hidden');
      } else {
        $('#voiceName').textContent = '还没有录音';
        $('#voicePreview').classList.add('hidden');
        $('#removeVoiceBtn').classList.add('hidden');
      }

      setTheme(item.theme || 'sakura');
      setFont(item.font || 'default');
      renderPhotos();
      renderPreview();

      $('#editorEyebrow').textContent = 'EDIT BLESSING';
      $('#editorTitle').textContent = '修改这份祝福';
      $('#editorSub').textContent = '可以换照片、改文字，链接和二维码都不会变。';
      $('#draftBadge').textContent = '编辑中';
      $('#saveBtn').textContent = '保存修改';
      $('#saveNote').textContent = '修改完成后记得点「保存修改」。';
      showEditor();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast('已载入这份祝福');
    } catch (err) {
      toast(err.message);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 视图切换                                                           */
  /* ------------------------------------------------------------------ */

  function showEditor() {
    $('#editorLayout').classList.remove('hidden');
    $('#listPanel').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function showList() {
    $('#editorLayout').classList.add('hidden');
    $('#listPanel').classList.remove('hidden');
    $('#listBtn').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'auto' });
    loadList();
  }

  $('#listBtn').addEventListener('click', showList);
  $('#backToEditorBtn').addEventListener('click', showEditor);
  $('#emptyNewBtn').addEventListener('click', () => { resetForm(); showEditor(); });

  function resetForm() {
    state.editingId = null;
    state.cards = [];
    state.musicMode = 'synth';
    state.musicData = null;
    state.musicKeep = false;
    state.musicPreviewUrl = '';
    state.voiceData = null;
    state.voiceKeep = false;
    state.voicePreviewUrl = '';
    state.dirty = false;
    $('#form').reset();
    $('#recipient').value = '';
    $('#sender').value = '';
    $('#password').value = '';
    $('#password').placeholder = '例如 0707';
    $('#hint').value = '';
    $('#blessing').value = DEFAULT_BLESSING;
    updateCount();
    setMusicMode('synth', true);
    setTheme('sakura');
    setFont('default');
    $('#musicName').textContent = '使用内置音乐盒';
    $('#musicPreview').classList.add('hidden');
    $('#voiceName').textContent = '还没有录音';
    $('#voicePreview').classList.add('hidden');
    $('#removeVoiceBtn').classList.add('hidden');
    renderPhotos();
    renderPreview();
    $('#editorEyebrow').textContent = 'NEW BLESSING';
    $('#editorTitle').textContent = '写一份新的祝福';
    $('#editorSub').textContent = '填好之后，生成链接和二维码，发给 TA。';
    $('#draftBadge').textContent = '草稿';
    $('#saveBtn').textContent = '生成祝福链接';
    $('#saveNote').textContent = '保存后会生成专属链接和二维码，之后可以随时回来修改，链接不变。';
  }

  $('#newBtn').addEventListener('click', () => { resetForm(); showEditor(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('#resetBtn').addEventListener('click', function () {
    if (state.cards.length || $('#recipient').value || $('#blessing').value.trim() !== DEFAULT_BLESSING.trim()) {
      if (!confirm('清空当前内容，重新写一份？')) return;
    }
    resetForm();
    toast('已清空');
  });

  /* ------------------------------------------------------------------ */
  /* 启动                                                               */
  /* ------------------------------------------------------------------ */

  resetForm();
  boot();
})();
