
(function () {
  // 核心模块通过绝对路径加载：线上指向服务器 /assets/，完整另存后该路径 404。
  // 等待加载结束后再显示界面，避免线上用户过早操作导致误判。
  let core = null;
  import('/assets/core-a1b2c3.js')
    .then(m => { core = m; })
    .catch(() => { core = null; })
    .then(() => { document.querySelector('main').style.display = ''; });

  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const viewport = document.getElementById('viewport');
  const stage = document.getElementById('stage');
  const image = document.getElementById('image');
  const overlay = document.getElementById('curveOverlay');
  const markers = document.getElementById('markers');
  const currentHint = document.getElementById('currentHint');
  const lineColor = document.getElementById('lineColor');
  const lineList = document.getElementById('lineList');
  const newLineBtn = document.getElementById('newLineBtn');
  const undoBtn = document.getElementById('undoBtn');
  const clearLineBtn = document.getElementById('clearLineBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const pointSizeRange = document.getElementById('pointSizeRange');
  const pointSizeVal = document.getElementById('pointSizeVal');
  const lineWidthRange = document.getElementById('lineWidthRange');
  const lineWidthVal = document.getElementById('lineWidthVal');
  const smoothRange = document.getElementById('smoothRange');
  const smoothValue = document.getElementById('smoothValue');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomFitBtn = document.getElementById('zoomFitBtn');
  const zoomNativeBtn = document.getElementById('zoomNativeBtn');
  const zoomLabel = document.getElementById('zoomLabel');
  const genBtn = document.getElementById('genBtn');
  const genOneBtn = document.getElementById('genOneBtn');
  const copyBtn = document.getElementById('copyBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const downloadOneBtn = document.getElementById('downloadOneBtn');
  const svgRender = document.getElementById('svgRender');
  const canvasW = document.getElementById('canvasW');
  const canvasH = document.getElementById('canvasH');
  const coordText = document.getElementById('coordText');
  const coordStatus = document.getElementById('coordStatus');
  const exportCoordsBtn = document.getElementById('exportCoordsBtn');
  const loadCoordsBtn = document.getElementById('loadCoordsBtn');
  const clearCoordsBtn = document.getElementById('clearCoordsBtn');

  const COLORS = ['#ff3b30', '#4f8cff', '#3ddc97', '#ffb020', '#c77dff', '#00c2d1', '#ff7ab2', '#a3e635'];
  const STORAGE_KEY = 'pic2svg_state_v1';
  let imageDataUrl = '';
  let saveTimer = null;
  let lines = [];
  let currentLineId = null;
  let nextLineId = 1;
  let imgName = 'image';
  let svgParts = [];
  let oneSvg = '';
  let svgCodeText = '';
  let baseW = 0;
  let zoom = 1;

  const W = () => image.naturalWidth || Number(canvasW.value) || 800;
  const H = () => image.naturalHeight || Number(canvasH.value) || 600;
  const pointR = () => Number(pointSizeRange.value) / 2;
  const lineW = () => Number(lineWidthRange.value);
  const tension = () => Number(smoothRange.value) / 100;
  const fmt = n => String(Number(n.toFixed(1)));

  function currentLine() {
    return lines.find(l => l.id === currentLineId) || null;
  }

  function invalidate() {
    svgParts = [];
    oneSvg = '';
    copyBtn.disabled = true;
    downloadBtn.disabled = true;
    svgCodeText = '';
    svgRender.innerHTML = '';
    scheduleSave();
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    imgName = file.name.replace(/\.[^.]+$/, '') || 'image';
    const reader = new FileReader();
    reader.onload = e => {
      imageDataUrl = e.target.result;
      image.onload = () => {
        lines = [];
        nextLineId = 1;
        currentLineId = null;
        invalidate();
        dropzone.hidden = true;
        viewport.hidden = false;
        overlay.setAttribute('viewBox', '0 0 ' + W() + ' ' + H());
        baseW = Math.min(W(), Math.max(240, viewport.clientWidth - 20));
        zoom = 1;
        applyZoom(false);

        const defaultR = Math.max(2, Math.min(60, Math.round(Math.max(W(), H()) * 0.024)));
        pointSizeRange.value = defaultR;
        pointSizeVal.textContent = defaultR + ' px';
        const defaultLW = Math.max(1, Math.min(30, Math.round(defaultR / 3)));
        lineWidthRange.value = defaultLW;
        lineWidthVal.textContent = defaultLW + ' px';

        [newLineBtn, undoBtn, clearLineBtn, clearAllBtn, lineColor, pointSizeRange, lineWidthRange, smoothRange,
         zoomOutBtn, zoomInBtn, zoomFitBtn, zoomNativeBtn].forEach(el => { el.disabled = false; });

        render();
        addLine();
      };
      image.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        lines: lines,
        nextLineId: nextLineId,
        currentLineId: currentLineId,
        imgName: imgName,
        imageDataUrl: imageDataUrl,
        coordText: coordText.value,
        canvasW: canvasW.value,
        canvasH: canvasH.value,
        lineColor: lineColor.value,
        pointSize: pointSizeRange.value,
        lineWidth: lineWidthRange.value,
        smooth: smoothRange.value
      }));
    } catch (err) {
      // 图片 dataURL 过大或隐私模式下写入失败：降级为只存坐标数据
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          lines: lines,
          nextLineId: nextLineId,
          currentLineId: currentLineId,
          imgName: imgName,
          imageDataUrl: '',
          coordText: coordText.value,
          canvasW: canvasW.value,
          canvasH: canvasH.value,
          lineColor: lineColor.value,
          pointSize: pointSizeRange.value,
          lineWidth: lineWidthRange.value,
          smooth: smoothRange.value
        }));
      } catch (ignored) { /* 无法持久化，静默跳过 */ }
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 400);
  }

  function applyZoom(doRender) {
    if (!W()) return;
    image.style.width = Math.round(baseW * zoom) + 'px';
    zoomLabel.textContent = Math.round(zoom * 100) + '%';
    zoomOutBtn.disabled = zoom <= 0.25;
    zoomInBtn.disabled = zoom >= 8;
    if (doRender !== false) render();
  }

  function setZoom(z) {
    zoom = Math.min(8, Math.max(0.25, z));
    applyZoom(true);
  }

  function fitZoom() {
    baseW = Math.min(W(), Math.max(240, viewport.clientWidth - 20));
    setZoom(1);
  }

  function addLine() {
    if (viewport.hidden) return;
    const line = {
      id: nextLineId++,
      color: lineColor.value,
      points: []
    };
    lines.push(line);
    currentLineId = line.id;
    invalidate();
    render();
  }

  function selectLine(id) {
    currentLineId = id;
    const l = lines.find(x => x.id === id);
    if (l) lineColor.value = l.color;
    render();
  }

  function deleteLine(id) {
    lines = lines.filter(l => l.id !== id);
    if (currentLineId === id) currentLineId = lines.length ? lines[lines.length - 1].id : null;
    invalidate();
    render();
  }

  fileInput.addEventListener('change', e => loadFile(e.target.files[0]));

  ['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, e => {
    e.preventDefault();
    dropzone.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, e => {
    e.preventDefault();
    dropzone.classList.remove('over');
  }));
  dropzone.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));

  stage.addEventListener('click', e => {
    if (e.target.classList.contains('marker')) return;
    const line = currentLine();
    if (!line) return;
    const rect = image.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (W() / rect.width);
    const sy = (e.clientY - rect.top) * (H() / rect.height);
    line.points.push({
      x: Math.round(sx),
      y: Math.round(H() - sy)
    });
    invalidate();
    render();
  });

  function removePoint(lineId, index) {
    const line = lines.find(l => l.id === lineId);
    if (!line) return;
    line.points.splice(index, 1);
    invalidate();
    render();
  }

  newLineBtn.addEventListener('click', addLine);
  undoBtn.addEventListener('click', () => {
    const line = currentLine();
    if (line && line.points.length) removePoint(line.id, line.points.length - 1);
  });
  clearLineBtn.addEventListener('click', () => {
    const line = currentLine();
    if (!line) return;
    line.points = [];
    invalidate();
    render();
  });
  clearAllBtn.addEventListener('click', () => {
    lines = [];
    currentLineId = null;
    invalidate();
    render();
  });

  pointSizeRange.addEventListener('input', () => {
    pointSizeVal.textContent = pointSizeRange.value + ' px';
    invalidate();
    render();
  });
  lineWidthRange.addEventListener('input', () => {
    lineWidthVal.textContent = lineWidthRange.value + ' px';
    invalidate();
    render();
  });
  lineColor.addEventListener('input', () => {
    const l = currentLine();
    if (!l) return;
    l.color = lineColor.value;
    invalidate();
    render();
  });

  smoothRange.addEventListener('input', () => {
    smoothValue.textContent = smoothRange.value + '%';
    invalidate();
    render();
  });

  zoomInBtn.addEventListener('click', () => setZoom(zoom * 1.25));
  zoomOutBtn.addEventListener('click', () => setZoom(zoom / 1.25));
  zoomFitBtn.addEventListener('click', fitZoom);
  zoomNativeBtn.addEventListener('click', () => setZoom(W() / baseW));
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    } else {
      viewport.scrollLeft += e.deltaX;
      viewport.scrollTop += e.deltaY;
    }
  }, { passive: false });

  function pathD(points, t, useScreen) {
    if (!points.length) return '';
    const conv = p => useScreen ? { x: p.x, y: H() - p.y } : { x: p.x, y: p.y };
    const p = points.map(conv);
    let d = 'M ' + fmt(p[0].x) + ' ' + fmt(p[0].y);
    if (p.length === 1) return d;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2] || p[i + 1];
      const c1x = p1.x + (p2.x - p0.x) / 6 * t;
      const c1y = p1.y + (p2.y - p0.y) / 6 * t;
      const c2x = p2.x - (p3.x - p1.x) / 6 * t;
      const c2y = p2.y - (p3.y - p1.y) / 6 * t;
      d += ' C ' + fmt(c1x) + ' ' + fmt(c1y) + ' ' + fmt(c2x) + ' ' + fmt(c2y) + ' ' + fmt(p2.x) + ' ' + fmt(p2.y);
    }
    return d;
  }

  function render() {
    const hasImg = !viewport.hidden;
    const line = currentLine();
    const hasPoints = lines.some(l => l.points.length > 0);
    const totalPoints = lines.reduce((n, l) => n + l.points.length, 0);

    newLineBtn.disabled = !hasImg;
    undoBtn.disabled = !line || !line.points.length;
    clearLineBtn.disabled = !line || !line.points.length;
    clearAllBtn.disabled = !lines.length;
    genBtn.disabled = !hasPoints;
    genOneBtn.disabled = !hasPoints;
    copyBtn.disabled = !svgParts.length;
    downloadBtn.disabled = !svgParts.length;
    downloadOneBtn.disabled = !oneSvg;
    exportCoordsBtn.disabled = !hasPoints;
    loadCoordsBtn.disabled = !coordText.value.trim();
    clearCoordsBtn.disabled = !coordText.value;

    currentHint.textContent = line ? '当前：线 ' + line.id + '（共 ' + totalPoints + ' 点）' : '未选择';

    markers.innerHTML = '';
    lineList.innerHTML = '';

    overlay.innerHTML = lines.map(l => {
      if (!l.points.length) return '';
      return '<path d="' + pathD(l.points, tension(), true) + '" fill="none" stroke="' + l.color + '" stroke-width="' + lineW() + '" stroke-linejoin="round" stroke-linecap="round"/>';
    }).join('');

    const rect = image.getBoundingClientRect();
    const scaleX = rect.width / (W() || 1);
    const scaleY = rect.height / (H() || 1);
    const dotPx = Math.max(12, Number(pointSizeRange.value) * scaleX);
    const dotFont = Math.max(9, Math.min(16, dotPx * 0.55));

    lines.forEach(l => {
      const card = document.createElement('div');
      card.className = 'line-card' + (l.id === currentLineId ? ' current' : '');
      const head = document.createElement('div');
      head.className = 'line-head';
      head.innerHTML =
        '<span class="swatch" style="background:' + l.color + '"></span>' +
        '<span class="line-name">线 ' + l.id + '</span>' +
        '<span class="badge">' + l.points.length + ' 个点</span>';
      const acts = document.createElement('div');
      acts.className = 'line-actions';
      const select = document.createElement('button');
      select.className = 'btn sm';
      select.textContent = l.id === currentLineId ? '绘制中' : '切换为当前';
      select.disabled = l.id === currentLineId;
      select.addEventListener('click', () => selectLine(l.id));
      const one = document.createElement('button');
      one.className = 'btn sm';
      one.textContent = '生成该线 SVG';
      one.disabled = !l.points.length;
      one.addEventListener('click', () => {
        const svg = buildSvg(l);
        svgCodeText = svg;
        svgParts = [{ svg: svg, lineId: l.id }];
        copyBtn.disabled = false;
        downloadBtn.disabled = false;
        renderSvgPreviews();
      });
      const oneDl = document.createElement('button');
      oneDl.className = 'btn sm';
      oneDl.textContent = '下载该线 SVG';
      oneDl.disabled = !l.points.length;
      oneDl.addEventListener('click', () => downloadSvg([buildSvg(l, false)], l.id));
      const del = document.createElement('button');
      del.className = 'btn sm danger';
      del.textContent = '删除线';
      del.addEventListener('click', () => deleteLine(l.id));
      acts.append(select, one, oneDl, del);
      head.appendChild(acts);
      card.appendChild(head);
      lineList.appendChild(card);

      l.points.forEach((p, i) => {
        const dot = document.createElement('div');
        dot.className = 'marker';
        dot.textContent = i + 1;
        dot.style.width = dotPx + 'px';
        dot.style.height = dotPx + 'px';
        dot.style.margin = (-dotPx / 2) + 'px 0 0 ' + (-dotPx / 2) + 'px';
        dot.style.lineHeight = (dotPx - 4) + 'px';
        dot.style.fontSize = dotFont + 'px';
        dot.style.left = (p.x * scaleX) + 'px';
        dot.style.top = ((H() - p.y) * scaleY) + 'px';
        dot.style.background = l.color;
        dot.title = '线 ' + l.id + ' 点 ' + (i + 1) + '（' + p.x + ', ' + p.y + '），点击删除';
        dot.addEventListener('click', ev => {
          ev.stopPropagation();
          removePoint(l.id, i);
        });
        markers.appendChild(dot);
      });
    });
  }

  let previewUrls = [];
  function renderSvgPreviews() {
    previewUrls.forEach(u => URL.revokeObjectURL(u));
    previewUrls = [];
    svgRender.innerHTML = '';
    const items = svgParts.length
      ? svgParts.map(p => ({ svg: p.svg, cap: '线 ' + p.lineId + ' · ' + imgName + '_line' + p.lineId + '.svg' }))
      : (oneSvg ? [{ svg: oneSvg, cap: '合并 SVG · ' + imgName + '_all_lines.svg' }] : []);
    items.forEach(item => {
      const wrap = document.createElement('div');
      const cap = document.createElement('span');
      cap.className = 'badge';
      cap.textContent = item.cap;
      const img = document.createElement('img');
      const url = URL.createObjectURL(new Blob([item.svg], { type: 'image/svg+xml;charset=utf-8' }));
      previewUrls.push(url);
      img.src = url;
      img.alt = item.cap;
      wrap.appendChild(cap);
      wrap.appendChild(img);
      svgRender.appendChild(wrap);
    });
    if (!items.length) svgRender.innerHTML = '';
  }

  const coreDeps = {
    W, H, pointR, lineW, tension,
    pathD,
    getLines: () => lines
  };

  function needCore() {
    if (!core) {
      alert('SVG 生成核心模块未能加载。当前页面可能是不完整的离线副本，请在官方站点使用本工具。');
    }
    return core;
  }

  function buildSvg(line, includePoints) {
    const m = needCore();
    return m ? m.buildSvg(line, includePoints, coreDeps) : '';
  }

  function buildOneSvg(includePoints) {
    const m = needCore();
    return m ? m.buildOneSvg(includePoints, coreDeps) : '';
  }

  function downloadSvg(svgs, suffix) {
    svgs.forEach((svg, i) => {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = imgName + '_' + (suffix ? 'line' + suffix : 'line' + (i + 1)) + '.svg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  function generateAll() {
    const withPoints = lines.filter(l => l.points.length);
    svgParts = withPoints.map(l => ({ svg: buildSvg(l), lineId: l.id }));
    oneSvg = withPoints.length ? buildOneSvg() : '';
    svgCodeText = svgParts
      .map(p => '<!-- ===== 线 ' + p.lineId + ' · ' + imgName + '_line' + p.lineId + '.svg ===== -->\n' + p.svg)
      .concat(oneSvg ? ['<!-- ===== 合并 SVG · ' + imgName + '_all_lines.svg ===== -->\n' + oneSvg] : [])
      .join('\n\n');
    copyBtn.disabled = !svgParts.length;
    downloadBtn.disabled = !svgParts.length;
    downloadOneBtn.disabled = !oneSvg;
    renderSvgPreviews();
  }

  genBtn.addEventListener('click', generateAll);

  genOneBtn.addEventListener('click', () => {
    oneSvg = lines.some(l => l.points.length) ? buildOneSvg() : '';
    svgCodeText = oneSvg;
    svgParts = [];
    copyBtn.disabled = !oneSvg;
    downloadBtn.disabled = true;
    downloadOneBtn.disabled = !oneSvg;
    renderSvgPreviews();
  });

  copyBtn.addEventListener('click', async () => {
    if (!svgParts.length) return;
    const text = svgCodeText;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    copyBtn.textContent = '已复制';
    setTimeout(() => { copyBtn.textContent = '复制全部 SVG'; }, 1500);
  });

  downloadBtn.addEventListener('click', () => {
    if (!svgParts.length) return;
    svgParts.forEach(p => {
      const line = lines.find(l => l.id === p.lineId);
      if (line) downloadSvg([buildSvg(line, false)], line.id);
    });
  });

  downloadOneBtn.addEventListener('click', () => {
    if (!oneSvg) return;
    const blob = new Blob([buildOneSvg(false)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = imgName + '_all_lines.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  function exportCoords() {
    const withPoints = lines.filter(l => l.points.length);
    if (!withPoints.length) return;
    coordText.value = withPoints.map(l =>
      '# 线' + l.id + '\n' + l.points.map(p => p.x + ',' + p.y).join('\n')
    ).join('\n\n');
    coordStatus.textContent = '已导出 ' + withPoints.length + ' 条线';
    loadCoordsBtn.disabled = !coordText.value.trim();
    clearCoordsBtn.disabled = false;
  }

  function parseCoords(text) {
    const result = [];
    let cur = null;
    text.split(/\r?\n/).forEach(raw => {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) {
        if (!line) { cur = null; return; }
        if (line.startsWith('#') || line.startsWith('//')) {
          const name = line.replace(/^[#/]+\s*/, '').trim();
          cur = { name: name || '线' + (result.length + 1), points: [] };
          result.push(cur);
          return;
        }
      }
      const nums = line.match(/-?\d+(\.\d+)?/g);
      if (!nums || nums.length < 2) return;
      if (!cur) { cur = { name: '线' + (result.length + 1), points: [] }; result.push(cur); }
      for (let i = 0; i + 1 < nums.length; i += 2) {
        cur.points.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
      }
    });
    return result.filter(l => l.points.length);
  }

  function loadCoords() {
    const parsed = parseCoords(coordText.value);
    if (!parsed.length) {
      coordStatus.textContent = '未解析到有效坐标';
      return;
    }
    lines = parsed.map((l, i) => ({
      id: i + 1,
      name: l.name,
      color: COLORS[i % COLORS.length],
      points: l.points
    }));
    nextLineId = lines.length + 1;
    currentLineId = lines.length ? lines[0].id : null;
    invalidate();
    if (viewport.hidden) {
      const maxX = Math.max.apply(null, parsed.flatMap(l => l.points.map(p => p.x)));
      const maxY = Math.max.apply(null, parsed.flatMap(l => l.points.map(p => p.y)));
      canvasW.value = Math.max(1, Math.ceil(maxX) + 40);
      canvasH.value = Math.max(1, Math.ceil(maxY) + 40);
      [pointSizeRange, lineWidthRange, smoothRange].forEach(el => { el.disabled = false; });
      pointSizeRange.value = 12; pointSizeVal.textContent = '12 px';
      lineWidthRange.value = 4; lineWidthVal.textContent = '4 px';
    }
    render();
    genBtn.click();
    coordStatus.textContent = '已绘制 ' + lines.length + ' 条线 / ' + lines.reduce((n, l) => n + l.points.length, 0) + ' 点';
  }

  exportCoordsBtn.addEventListener('click', exportCoords);
  loadCoordsBtn.addEventListener('click', loadCoords);
  clearCoordsBtn.addEventListener('click', () => {
    coordText.value = '';
    coordStatus.textContent = '';
    loadCoordsBtn.disabled = true;
    clearCoordsBtn.disabled = true;
  });
  coordText.addEventListener('input', () => {
    coordStatus.textContent = '文本已修改';
    loadCoordsBtn.disabled = !coordText.value.trim() || viewport.hidden;
    clearCoordsBtn.disabled = !coordText.value;
    scheduleSave();
  });
  [canvasW, canvasH].forEach(el => el.addEventListener('change', scheduleSave));

  function restoreState() {
    let raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (err) { return; }
    if (!raw) return;
    let st;
    try { st = JSON.parse(raw); } catch (err) { return; }
    if (!st || !Array.isArray(st.lines)) return;

    lines = st.lines;
    nextLineId = st.nextLineId || 1;
    currentLineId = st.currentLineId || null;
    imgName = st.imgName || 'image';
    if (st.canvasW) canvasW.value = st.canvasW;
    if (st.canvasH) canvasH.value = st.canvasH;
    coordText.value = st.coordText || '';
    if (st.lineColor) lineColor.value = st.lineColor;
    if (st.pointSize) pointSizeRange.value = st.pointSize;
    if (st.lineWidth) lineWidthRange.value = st.lineWidth;
    if (st.smooth) smoothRange.value = st.smooth;
    pointSizeVal.textContent = pointSizeRange.value + ' px';
    lineWidthVal.textContent = lineWidthRange.value + ' px';
    smoothValue.textContent = smoothRange.value + '%';

    const enableControls = () => {
      [newLineBtn, undoBtn, clearLineBtn, clearAllBtn, lineColor, pointSizeRange, lineWidthRange, smoothRange,
       zoomOutBtn, zoomInBtn, zoomFitBtn, zoomNativeBtn].forEach(el => { el.disabled = false; });
    };

    if (st.imageDataUrl) {
      imageDataUrl = st.imageDataUrl;
      image.onload = () => {
        dropzone.hidden = true;
        viewport.hidden = false;
        overlay.setAttribute('viewBox', '0 0 ' + W() + ' ' + H());
        baseW = Math.min(W(), Math.max(240, viewport.clientWidth - 20));
        zoom = 1;
        applyZoom(false);
        enableControls();
        render();
      };
      image.src = st.imageDataUrl;
    } else {
      // 未保存图片（降级）：线条无法定位，仅恢复坐标文本，等待“按坐标绘制”
      lines = [];
      currentLineId = null;
      [pointSizeRange, lineWidthRange, smoothRange].forEach(el => { el.disabled = false; });
      render();
    }
  }

  window.addEventListener('resize', () => { if (!viewport.hidden) fitZoom(); });
  restoreState();
})();
