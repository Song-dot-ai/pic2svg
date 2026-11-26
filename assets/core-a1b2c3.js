// 核心 SVG 生成模块
// 线上部署于站点根目录 /assets/core-a1b2c3.js，由主程序通过绝对路径动态 import。
// 依赖（W/H/pointR/lineW/tension/pathD/getLines）由调用方注入，避免模块与界面状态耦合。

export function lineElements(line, indent, includePoints, deps) {
  const pts = line.points;
  const r = deps.pointR();
  const stroke = deps.lineW();
  const out = [];
  const pre = indent || '';
  out.push(pre + '<g id="line-' + line.id + '" data-line-id="' + line.id + '" data-color="' + line.color + '">');
  out.push(pre + '  <path d="' + deps.pathD(pts, deps.tension(), false) + '" fill="none" stroke="' + line.color + '" stroke-width="' + stroke + '" stroke-linejoin="round" stroke-linecap="round"/>');
  if (includePoints !== false) {
    pts.forEach(p => {
      out.push(pre + '  <circle cx="' + p.x + '" cy="' + p.y + '" r="' + r + '" fill="' + line.color + '" stroke="#ffffff" stroke-width="' + Math.max(1, Math.round(r * 0.22)) + '" data-x="' + p.x + '" data-y="' + p.y + '"/>');
    });
  }
  out.push(pre + '</g>');
  return out;
}

export function buildSvg(line, includePoints, deps) {
  const w = deps.W();
  const h = deps.H();
  const parts = [];
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" data-line-id="' + line.id + '" data-coordinate-system="cartesian" data-origin="bottom-left" data-smooth="' + deps.tension() + '">');
  parts.push('  <desc>线 ' + line.id + '，共 ' + line.points.length + ' 个点。笛卡尔坐标系：原点左下角，x 向右为正，y 向上为正；平滑曲线为 Catmull-Rom 转三次贝塞尔。</desc>');
  parts.push('  <g transform="translate(0,' + h + ') scale(1,-1)">');
  parts.push.apply(parts, lineElements(line, '    ', includePoints, deps));
  parts.push('  </g>');
  parts.push('</svg>');
  return parts.join('\n');
}

export function buildOneSvg(includePoints, deps) {
  const w = deps.W();
  const h = deps.H();
  const withPoints = deps.getLines().filter(l => l.points.length);
  const parts = [];
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" data-coordinate-system="cartesian" data-origin="bottom-left" data-smooth="' + deps.tension() + '" data-line-count="' + withPoints.length + '">');
  parts.push('  <desc>共 ' + withPoints.length + ' 条线。笛卡尔坐标系：原点左下角，x 向右为正，y 向上为正；平滑曲线为 Catmull-Rom 转三次贝塞尔。</desc>');
  parts.push('  <g transform="translate(0,' + h + ') scale(1,-1)">');
  withPoints.forEach(l => { parts.push.apply(parts, lineElements(l, '    ', includePoints, deps)); });
  parts.push('  </g>');
  parts.push('</svg>');
  return parts.join('\n');
}
