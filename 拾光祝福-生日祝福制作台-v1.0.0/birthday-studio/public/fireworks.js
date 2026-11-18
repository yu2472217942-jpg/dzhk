/* 生日烟花 · 文字粒子 */
(function () {
  'use strict';

  const canvas = document.getElementById('fxCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let running = false;
  let raf = 0;
  let startTime = 0;
  let finishTimer = 0;
  let particles = [];
  let sparkles = [];
  let targets = [];
  let targetCursor = 0;
  let resolveFn = null;
  let clickHandler = null;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildTargets(text) {
    const maxWidth = Math.min(width * 0.86, 980);
    const maxHeight = Math.min(height * 0.46, 420);
    const lines = String(text || '生日快乐').split('\n').filter(Boolean);
    let fontSize = Math.min(190, Math.floor(maxHeight / Math.max(1, lines.length) / 1.25));
    let lineHeight = fontSize * 1.22;
    let sizes = [];

    function measure(size) {
      ctx.save();
      ctx.font = '900 ' + size + 'px "PingFang SC","Microsoft YaHei",sans-serif';
      const ws = lines.map(line => ctx.measureText(line).width);
      ctx.restore();
      return ws;
    }

    for (let guard = 0; guard < 80; guard++) {
      sizes = measure(fontSize);
      const maxLine = Math.max.apply(null, sizes);
      lineHeight = fontSize * 1.22;
      if (maxLine <= maxWidth && lineHeight * lines.length <= maxHeight) break;
      fontSize -= 4;
      if (fontSize < 24) break;
    }
    fontSize = Math.max(24, fontSize);
    lineHeight = fontSize * 1.22;

    const offW = Math.ceil(Math.max.apply(null, measure(fontSize)) + 40);
    const offH = Math.ceil(lineHeight * lines.length + 20);
    const off = document.createElement('canvas');
    off.width = offW;
    off.height = offH;
    const octx = off.getContext('2d');
    octx.clearRect(0, 0, offW, offH);
    octx.font = '900 ' + fontSize + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillStyle = '#fff';
    lines.forEach((line, i) => {
      octx.fillText(line, offW / 2, 10 + lineHeight * (i + 0.5));
    });

    const img = octx.getImageData(0, 0, offW, offH).data;
    const step = width < 520 ? 4 : 3;
    const points = [];
    for (let y = 0; y < offH; y += step) {
      for (let x = 0; x < offW; x += step) {
        const alpha = img[(y * offW + x) * 4 + 3];
        if (alpha > 128) {
          points.push({
            x: x + (width - offW) / 2,
            y: y + (height - offH) / 2
          });
        }
      }
    }
    // 打乱，让粒子形成文字时更自然
    for (let i = points.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = points[i]; points[i] = points[j]; points[j] = t;
    }
    return points;
  }

  function spawnParticles(points) {
    particles = [];
    sparkles = [];
    targetCursor = 0;
    const centers = [];
    const centerCount = width < 520 ? 5 : 8;
    for (let i = 0; i < centerCount; i++) {
      const angle = (Math.PI * 2 * i) / centerCount + Math.random() * 0.5;
      centers.push({
        x: width / 2 + Math.cos(angle) * width * (0.10 + Math.random() * 0.22),
        y: height / 2 + Math.sin(angle) * height * (0.08 + Math.random() * 0.18)
      });
    }

    points.forEach((point, index) => {
      const center = centers[index % centers.length];
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      const hue = Math.random() < 0.72 ? 345 : (Math.random() < 0.55 ? 42 : 275);
      const p = {
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        tx: point.x,
        ty: point.y,
        size: 0.9 + Math.random() * 1.3,
        hue: hue,
        settled: false,
        life: 0,
        twinkle: Math.random() * Math.PI * 2
      };
      particles.push(p);
    });

    // 少量纯装饰光点
    for (let i = 0; i < 70; i++) {
      sparkles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.6 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.6 ? 345 : 42
      });
    }
  }

  function draw(now) {
    if (!running) return;
    const elapsed = now - startTime;
    // 拖尾：半透明深色覆盖，浅色主题也能看清烟花
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(13, 9, 20, 0.16)';
    ctx.fillRect(0, 0, width, height);

    const fade = elapsed > 4300 ? Math.max(0, 1 - (elapsed - 4300) / 900) : 1;

    ctx.globalCompositeOperation = 'lighter';
    sparkles.forEach(s => {
      const a = (0.25 + 0.25 * Math.sin(now / 600 + s.phase)) * fade;
      ctx.beginPath();
      ctx.fillStyle = 'hsla(' + s.hue + ', 100%, 80%, ' + a + ')';
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    let unsettled = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life += 1;
      if (!p.settled) {
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 2.2) {
          p.settled = true;
          p.x = p.tx;
          p.y = p.ty;
          p.vx = 0;
          p.vy = 0;
        } else {
          unsettled++;
          const ax = dx / Math.max(dist, 0.01);
          const ay = dy / Math.max(dist, 0.01);
          const pull = dist < 80 ? 0.07 : 0.035;
          p.vx += ax * pull * Math.min(dist, 120) * 0.16 + ax * 0.55;
          p.vy += ay * pull * Math.min(dist, 120) * 0.16 + ay * 0.55;
          p.vx *= 0.9;
          p.vy *= 0.9;
          p.x += p.vx;
          p.y += p.vy;
        }
      }
      const tw = p.settled ? (0.82 + 0.18 * Math.sin(now / 260 + p.twinkle)) : 1;
      const alpha = Math.min(1, p.life / 10) * fade * tw;
      const light = p.settled ? 80 : 62;
      ctx.fillStyle = 'hsla(' + p.hue + ', 100%, ' + light + '%, ' + alpha + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.settled ? 1.05 : 1), 0, Math.PI * 2);
      ctx.fill();
      if (p.settled && p.size > 1.75) {
        ctx.fillStyle = 'hsla(' + p.hue + ', 100%, 92%, ' + (alpha * 0.28) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (elapsed > 2600 && unsettled === 0) {
      // 文字已经成形，保持一会儿
    }

    ctx.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(draw);
  }

  function cleanup() {
    running = false;
    cancelAnimationFrame(raf);
    clearTimeout(finishTimer);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.classList.remove('active');
    if (clickHandler) {
      canvas.removeEventListener('click', clickHandler);
      canvas.removeEventListener('touchstart', clickHandler);
      clickHandler = null;
    }
  }

  function finish() {
    if (!running) return;
    cleanup();
    const fn = resolveFn;
    resolveFn = null;
    if (fn) fn();
  }

  function start(text, options) {
    options = options || {};
    if (running) {
      // 重新启动
      cleanup();
    }
    running = true;
    startTime = performance.now();
    resize();
    canvas.classList.add('active');
    targets = buildTargets(text);
    spawnParticles(targets);
    clickHandler = function () { finish(); };
    canvas.addEventListener('click', clickHandler);
    canvas.addEventListener('touchstart', clickHandler, { passive: true });
    raf = requestAnimationFrame(draw);
    const duration = options.duration || 5200;
    finishTimer = setTimeout(finish, duration);
    return new Promise(resolve => { resolveFn = resolve; });
  }

  window.addEventListener('resize', function () {
    if (!running) return;
    resize();
    targets = buildTargets(window.__FX_TEXT__ || '生日快乐');
    spawnParticles(targets);
  });

  window.BirthdayFX = {
    start: function (text, options) {
      window.__FX_TEXT__ = text;
      return start(text, options);
    },
    stop: finish,
    isRunning: function () { return running; }
  };
})();
