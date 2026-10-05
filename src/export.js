// Browser-only SVG snapshot. No external images, fonts or services are loaded.
export async function downloadMapPng(svg) {
  if (!svg || svg.tagName.toLowerCase() !== 'svg') throw new Error('Missing map');
  const view = svg.viewBox.baseVal;
  const bounds = svg.getBBox();
  const left = Math.min(view.x, bounds.x) - 24;
  const top = Math.min(view.y, bounds.y) - 24;
  const width = Math.max(view.x + view.width, bounds.x + bounds.width) - left + 24;
  const height = Math.max(view.y + view.height, bounds.y + bounds.height) - top + 24;
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error('Invalid map dimensions');

  const copy = svg.cloneNode(true);
  // Capture CSS from the live map, including route/hazard colours and text.
  const properties = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity',
    'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
    'opacity', 'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
    'letter-spacing', 'word-spacing', 'text-anchor', 'dominant-baseline', 'alignment-baseline',
    'direction', 'unicode-bidi', 'white-space', 'paint-order', 'visibility', 'display'];
  const originals = [svg, ...svg.querySelectorAll('*')];
  const copies = [copy, ...copy.querySelectorAll('*')];
  originals.forEach((node, index) => {
    const computed = getComputedStyle(node);
    for (const property of properties) {
      // Computed fragment URLs can become absolute; keep patterns local to this SVG.
      const value = computed.getPropertyValue(property).replace(/url\(["']?[^)"']*#([^)"']+)["']?\)/g, 'url(#$1)');
      if (value) copies[index].style.setProperty(property, value);
    }
    copies[index].style.setProperty('animation', 'none');
    copies[index].style.setProperty('transition', 'none');
  });
  const scale = Math.min(3, 4096 / width, 4096 / height);
  const pixelWidth = Math.max(1, Math.ceil(width * scale));
  const pixelHeight = Math.max(1, Math.ceil(height * scale));
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
  copy.setAttribute('width', pixelWidth);
  copy.setAttribute('height', pixelHeight);
  const background = getComputedStyle(svg.parentElement).backgroundColor;
  const svgBlob = new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  try {
    await document.fonts?.ready;
    const image = new Image();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Map image timed out')), 10000);
      image.onload = () => { clearTimeout(timeout); resolve(); };
      image.onerror = () => { clearTimeout(timeout); reject(new Error('Map image could not load')); };
      image.src = svgUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = pixelWidth; canvas.height = pixelHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, pixelWidth, pixelHeight);
    context.fillStyle = background; context.fillRect(0, 0, pixelWidth, pixelHeight);
    context.drawImage(image, 0, 0, pixelWidth, pixelHeight);
    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('PNG encoding failed');
    const pngUrl = URL.createObjectURL(png);
    const link = document.createElement('a');
    link.href = pngUrl; link.download = 'smart-escape-map.png';
    document.body.append(link);
    try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(pngUrl), 30000); }
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
