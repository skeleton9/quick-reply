const CARD_OVERLAY_ATTR = 'data-quick-reply-card-overlay';

const CARD_RATIOS = [
  { id: '1:1', name: '1:1', width: 1080, height: 1080 },
  { id: '3:4', name: '3:4', width: 810, height: 1080 },
  { id: '4:3', name: '4:3', width: 1080, height: 810 },
];

const CARD_TEMPLATES = [
  {
    id: 'minimal',
    name: '简约白',
    padding: 88,
    background: '#ffffff',
    color: '#0f1419',
    fontWeight: '600',
    accent: null,
  },
  {
    id: 'dark',
    name: '深色',
    padding: 88,
    background: '#15202b',
    color: '#e7e9ea',
    fontWeight: '600',
    accent: '#1d9bf0',
  },
  {
    id: 'gradient',
    name: '渐变紫',
    padding: 88,
    gradient: ['#667eea', '#764ba2'],
    color: '#ffffff',
    fontWeight: '700',
    accent: null,
  },
  {
    id: 'sunset',
    name: '日落',
    padding: 88,
    gradient: ['#f83600', '#f9d423'],
    color: '#ffffff',
    fontWeight: '700',
    accent: null,
  },
  {
    id: 'quote',
    name: '引用',
    padding: 100,
    background: '#f7f9f9',
    color: '#0f1419',
    fontWeight: '500',
    accent: '#1d9bf0',
    border: '#cfd9de',
  },
  {
    id: 'mint',
    name: '薄荷',
    padding: 88,
    background: '#ecfdf5',
    color: '#064e3b',
    fontWeight: '600',
    accent: '#10b981',
  },
];

const CARD_FONTS = [
  { id: 'system', name: '系统默认', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  { id: 'serif', name: '衬线', value: 'Georgia, "Times New Roman", "Songti SC", serif' },
  { id: 'sans', name: '黑体', value: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif' },
  { id: 'mono', name: '等宽', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
];

function getTemplate(id) {
  return CARD_TEMPLATES.find((t) => t.id === id) || CARD_TEMPLATES[0];
}

function getRatio(id) {
  return CARD_RATIOS.find((r) => r.id === id) || CARD_RATIOS[0];
}

function getCardLayout(templateId, ratioId) {
  const template = getTemplate(templateId);
  const ratio = getRatio(ratioId);
  const { width, height } = ratio;
  const padding = Math.round(template.padding * Math.min(width, height) / 1080);
  return { template, width, height, padding };
}

function getFontValue(id) {
  return CARD_FONTS.find((f) => f.id === id)?.value || CARD_FONTS[0].value;
}

function isCjkChar(char) {
  return /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(char);
}

function splitIntoWrapUnits(paragraph) {
  const units = [];
  let i = 0;

  while (i < paragraph.length) {
    const ch = paragraph[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (isCjkChar(ch)) {
      units.push({ type: 'cjk', text: ch });
      i += 1;
      continue;
    }

    let word = ch;
    i += 1;
    while (i < paragraph.length && !/\s/.test(paragraph[i]) && !isCjkChar(paragraph[i])) {
      word += paragraph[i];
      i += 1;
    }
    units.push({ type: 'word', text: word });
  }

  return units;
}

function wrapParagraph(ctx, paragraph, maxWidth) {
  const units = splitIntoWrapUnits(paragraph);
  const lines = [];
  let line = '';

  for (const unit of units) {
    let candidate;
    if (!line) {
      candidate = unit.text;
    } else if (unit.type === 'word') {
      candidate = `${line} ${unit.text}`;
    } else {
      candidate = line + unit.text;
    }

    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) {
      lines.push(line);
      line = '';
    }

    if (ctx.measureText(unit.text).width <= maxWidth) {
      line = unit.text;
    } else {
      lines.push(unit.text);
    }
  }

  if (line) lines.push(line);
  return lines;
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  const paragraphs = String(text).split('\n');

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    lines.push(...wrapParagraph(ctx, paragraph, maxWidth));
  }

  return lines.length ? lines : [''];
}

function layoutFits(ctx, layout, maxWidth, maxHeight) {
  if (layout.totalHeight > maxHeight) return false;
  return layout.lines.every((line) => !line || ctx.measureText(line).width <= maxWidth);
}

function measureLayout(ctx, text, maxWidth, maxHeight, fontFamily, fontWeight, fontSize) {
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = fontSize * 1.38;
  const totalHeight = lines.length * lineHeight;
  return { lines, lineHeight, totalHeight, fontSize };
}

function autoFitLayout(ctx, text, maxWidth, maxHeight, fontFamily, fontWeight, maxSize = 80, minSize = 18) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    const layout = measureLayout(ctx, text, maxWidth, maxHeight, fontFamily, fontWeight, size);
    if (layoutFits(ctx, layout, maxWidth, maxHeight)) return layout;
  }
  return measureLayout(ctx, text, maxWidth, maxHeight, fontFamily, fontWeight, minSize);
}

function drawBackground(ctx, template, width, height) {
  if (template.gradient) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, template.gradient[0]);
    gradient.addColorStop(1, template.gradient[1]);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = template.background;
  }
  ctx.fillRect(0, 0, width, height);

  if (template.border) {
    const margin = Math.round(Math.min(width, height) * 0.044);
    ctx.strokeStyle = template.border;
    ctx.lineWidth = 4;
    ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);
  }

  if (template.accent && template.id === 'quote') {
    ctx.fillStyle = template.accent;
    ctx.fillRect(
      Math.round(width * 0.067),
      Math.round(height * 0.111),
      8,
      Math.round(height * 0.778)
    );
  }

  if (template.accent && template.id === 'dark') {
    ctx.fillStyle = template.accent;
    ctx.fillRect(
      Math.round(width * 0.067),
      height - Math.round(height * 0.111),
      Math.round(width * 0.111),
      6
    );
  }
}

function getFooterColor(template) {
  if (template.gradient || template.id === 'dark') {
    return 'rgba(255, 255, 255, 0.72)';
  }
  return 'rgba(15, 20, 25, 0.55)';
}

function measureFooterLayout(ctx, footerText, maxWidth, fontFamily, fontSize) {
  ctx.font = `500 ${fontSize}px ${fontFamily}`;
  const lines = wrapText(ctx, footerText, maxWidth);
  const lineHeight = fontSize * 1.4;
  return { lines, lineHeight, totalHeight: lines.length * lineHeight, fontSize };
}

function computeDefaultFooterFontSize(templateId, ratioId) {
  const { width, height } = getCardLayout(templateId, ratioId);
  return Math.max(18, Math.round(Math.min(width, height) * 0.028));
}

function getFooterSpace(width, height, padding, footerText, fontFamily, footerFontSize) {
  const footer = (footerText || '').trim();
  if (!footer) return { reserved: 0, layout: null, fontSize: 0 };

  const fontSize = footerFontSize || Math.max(18, Math.round(Math.min(width, height) * 0.028));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const maxWidth = width - padding * 2;
  const layout = measureFooterLayout(ctx, footer, maxWidth, fontFamily, fontSize);
  const gap = Math.round(padding * 0.35);
  return { reserved: layout.totalHeight + gap, layout, fontSize };
}

function computeAutoFontSize(text, templateId, fontId, ratioId, footerText = '', footerFontSize) {
  const { template, width, height, padding } = getCardLayout(templateId, ratioId);
  const fontFamily = getFontValue(fontId);
  const fontWeight = template.fontWeight || '600';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const maxWidth = width - padding * 2;
  const { reserved: footerReserved } = getFooterSpace(
    width,
    height,
    padding,
    footerText,
    fontFamily,
    footerFontSize
  );
  const maxHeight = height - padding * 2 - footerReserved;
  const layout = autoFitLayout(
    ctx,
    (text || '').trim() || ' ',
    maxWidth,
    maxHeight,
    fontFamily,
    fontWeight
  );
  return layout.fontSize;
}

function drawCardFooter(ctx, template, width, height, padding, fontFamily, footerText, footerFontSize) {
  const footer = (footerText || '').trim();
  if (!footer) return;

  const maxWidth = width - padding * 2;
  const fontSize = footerFontSize || Math.max(18, Math.round(Math.min(width, height) * 0.028));
  const layout = measureFooterLayout(ctx, footer, maxWidth, fontFamily, fontSize);
  const startY = height - padding * 0.55 - layout.totalHeight + layout.fontSize;

  ctx.fillStyle = getFooterColor(template);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `500 ${fontSize}px ${fontFamily}`;
  layout.lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * layout.lineHeight);
  });
}

function renderCardCanvas(options) {
  const { template, width, height, padding } = getCardLayout(options.templateId, options.ratioId);
  const fontFamily = getFontValue(options.fontId);
  const fontWeight = template.fontWeight || '600';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  drawBackground(ctx, template, width, height);

  const text = (options.text || '').trim() || ' ';
  const maxWidth = width - padding * 2;
  const { reserved: footerReserved } = getFooterSpace(
    width,
    height,
    padding,
    options.footerText,
    fontFamily,
    options.footerFontSize
  );
  const contentHeight = height - padding * 2 - footerReserved;
  const fontSize = options.fontSize || 48;

  const layout = measureLayout(ctx, text, maxWidth, contentHeight, fontFamily, fontWeight, fontSize);

  ctx.fillStyle = template.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${fontWeight} ${layout.fontSize}px ${fontFamily}`;

  const startY = padding + (contentHeight - layout.totalHeight) / 2 + layout.fontSize;
  layout.lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * layout.lineHeight);
  });

  drawCardFooter(
    ctx,
    template,
    width,
    height,
    padding,
    fontFamily,
    options.footerText,
    options.footerFontSize
  );

  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('图片生成失败'));
    }, 'image/png');
  });
}

async function insertImageToReply(article, blob) {
  const inlineReply = article?.querySelector('[data-testid="inline_reply_offscreen"]');
  const scope = inlineReply || article?.closest('[role="dialog"]') || document;

  let fileInput = scope.querySelector('[data-testid="fileInput"]');
  if (!fileInput) {
    const photoBtn = scope.querySelector('[aria-label="Add photos or video"], [data-testid="fileInput"]');
    if (photoBtn?.tagName === 'BUTTON') {
      photoBtn.click();
      await new Promise((r) => setTimeout(r, 250));
      fileInput = scope.querySelector('[data-testid="fileInput"]');
    }
  }

  if (!fileInput) {
    throw new Error('未找到图片上传入口，请先打开回复框');
  }

  const file = new File([blob], `quick-reply-card-${Date.now()}.png`, { type: 'image/png' });
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  fileInput.files = dataTransfer.files;
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
}

const CARD_PREF_DEFAULTS = {
  cardTemplateId: 'minimal',
  cardRatioId: '1:1',
  cardFontId: 'system',
  cardFooterText: '',
  cardFooterFontSize: 0,
};

async function loadCardPrefs() {
  const stored = await chrome.storage.sync.get(Object.keys(CARD_PREF_DEFAULTS));
  const templateId = CARD_TEMPLATES.some((t) => t.id === stored.cardTemplateId)
    ? stored.cardTemplateId
    : CARD_PREF_DEFAULTS.cardTemplateId;
  const ratioId = CARD_RATIOS.some((r) => r.id === stored.cardRatioId)
    ? stored.cardRatioId
    : CARD_PREF_DEFAULTS.cardRatioId;
  const fontId = CARD_FONTS.some((f) => f.id === stored.cardFontId)
    ? stored.cardFontId
    : CARD_PREF_DEFAULTS.cardFontId;
  const footerText = typeof stored.cardFooterText === 'string' ? stored.cardFooterText : CARD_PREF_DEFAULTS.cardFooterText;
  const footerFontSize =
    typeof stored.cardFooterFontSize === 'number' && stored.cardFooterFontSize >= 12
      ? stored.cardFooterFontSize
      : computeDefaultFooterFontSize(templateId, ratioId);
  return { templateId, ratioId, fontId, footerText, footerFontSize };
}

function saveCardPrefs(templateId, ratioId, fontId, footerText, footerFontSize) {
  chrome.storage.sync.set({
    cardTemplateId: templateId,
    cardRatioId: ratioId,
    cardFontId: fontId,
    cardFooterText: footerText ?? '',
    cardFooterFontSize: footerFontSize ?? 0,
  });
}

function removeCardOverlay() {
  document.querySelector(`[${CARD_OVERLAY_ATTR}]`)?.remove();
}

async function showCardEditor({ text, article }) {
  removeCardOverlay();

  const prefs = await loadCardPrefs();
  let templateId = prefs.templateId;
  let fontId = prefs.fontId;
  let ratioId = prefs.ratioId;

  const overlay = document.createElement('div');
  overlay.setAttribute(CARD_OVERLAY_ATTR, 'true');
  overlay.className = 'qr-card-overlay';

  overlay.innerHTML = `
    <div class="qr-card-modal" role="dialog" aria-modal="true" aria-label="编辑文字卡片">
      <div class="qr-card-modal-header">
        <span>编辑文字卡片</span>
        <button type="button" class="qr-card-close" title="关闭">×</button>
      </div>
      <div class="qr-card-modal-body">
        <div class="qr-card-preview-wrap">
          <canvas class="qr-card-preview"></canvas>
        </div>
        <div class="qr-card-controls">
          <div class="qr-card-section">
            <label class="qr-card-field">
              <span>卡片文字</span>
              <textarea class="qr-card-text" rows="5" placeholder="输入卡片内容"></textarea>
            </label>
            <label class="qr-card-field qr-card-field-row">
              <span>正文字号</span>
              <input class="qr-card-size" type="range" min="18" max="96" value="48" />
              <output class="qr-card-size-value">48px</output>
            </label>
          </div>

          <div class="qr-card-section">
            <label class="qr-card-field">
              <span>比例</span>
              <select class="qr-card-ratio"></select>
            </label>
            <label class="qr-card-field">
              <span>模板</span>
              <select class="qr-card-template"></select>
            </label>
            <label class="qr-card-field">
              <span>字体</span>
              <select class="qr-card-font"></select>
            </label>
          </div>

          <div class="qr-card-section">
            <label class="qr-card-field">
              <span>Footer 文字</span>
              <input class="qr-card-footer" type="text" placeholder="可选，显示在卡片底部" />
            </label>
            <label class="qr-card-field qr-card-field-row">
              <span>Footer 字号</span>
              <input class="qr-card-footer-size" type="range" min="12" max="48" value="28" />
              <output class="qr-card-footer-size-value">28px</output>
            </label>
          </div>
        </div>
      </div>
      <div class="qr-card-modal-footer">
        <button type="button" class="qr-card-btn qr-card-btn-cancel">取消</button>
        <button type="button" class="qr-card-btn qr-card-btn-confirm">插入图片</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const previewCanvas = overlay.querySelector('.qr-card-preview');
  const textArea = overlay.querySelector('.qr-card-text');
  const templateSelect = overlay.querySelector('.qr-card-template');
  const ratioSelect = overlay.querySelector('.qr-card-ratio');
  const fontSelect = overlay.querySelector('.qr-card-font');
  const sizeInput = overlay.querySelector('.qr-card-size');
  const sizeValue = overlay.querySelector('.qr-card-size-value');
  const footerInput = overlay.querySelector('.qr-card-footer');
  const footerSizeInput = overlay.querySelector('.qr-card-footer-size');
  const footerSizeValue = overlay.querySelector('.qr-card-footer-size-value');
  const confirmBtn = overlay.querySelector('.qr-card-btn-confirm');

  textArea.value = text || '';
  footerInput.value = prefs.footerText;
  footerSizeInput.value = String(prefs.footerFontSize);
  footerSizeValue.textContent = `${prefs.footerFontSize}px`;

  CARD_RATIOS.forEach((ratio) => {
    const option = document.createElement('option');
    option.value = ratio.id;
    option.textContent = ratio.name;
    ratioSelect.appendChild(option);
  });

  CARD_TEMPLATES.forEach((tpl) => {
    const option = document.createElement('option');
    option.value = tpl.id;
    option.textContent = tpl.name;
    templateSelect.appendChild(option);
  });

  CARD_FONTS.forEach((font) => {
    const option = document.createElement('option');
    option.value = font.id;
    option.textContent = font.name;
    fontSelect.appendChild(option);
  });

  ratioSelect.value = ratioId;
  templateSelect.value = templateId;
  fontSelect.value = fontId;

  function applyAutoFontSize() {
    const size = computeAutoFontSize(
      textArea.value,
      templateId,
      fontId,
      ratioId,
      footerInput.value,
      Number(footerSizeInput.value)
    );
    sizeInput.value = String(size);
    sizeValue.textContent = `${size}px`;
  }

  function persistPrefs() {
    saveCardPrefs(
      templateId,
      ratioId,
      fontId,
      footerInput.value,
      Number(footerSizeInput.value)
    );
  }

  function updatePreview() {
    const rendered = renderCardCanvas({
      text: textArea.value,
      templateId,
      fontId,
      ratioId,
      footerText: footerInput.value,
      footerFontSize: Number(footerSizeInput.value),
      fontSize: Number(sizeInput.value),
    });

    previewCanvas.width = rendered.width;
    previewCanvas.height = rendered.height;
    const ctx = previewCanvas.getContext('2d');
    ctx.clearRect(0, 0, rendered.width, rendered.height);
    ctx.drawImage(rendered, 0, 0);
  }

  textArea.addEventListener('input', updatePreview);
  footerInput.addEventListener('input', () => {
    persistPrefs();
    applyAutoFontSize();
    updatePreview();
  });
  footerSizeInput.addEventListener('input', () => {
    footerSizeValue.textContent = `${footerSizeInput.value}px`;
    persistPrefs();
    applyAutoFontSize();
    updatePreview();
  });
  ratioSelect.addEventListener('change', () => {
    ratioId = ratioSelect.value;
    persistPrefs();
    applyAutoFontSize();
    updatePreview();
  });
  templateSelect.addEventListener('change', () => {
    templateId = templateSelect.value;
    persistPrefs();
    applyAutoFontSize();
    updatePreview();
  });
  fontSelect.addEventListener('change', () => {
    fontId = fontSelect.value;
    persistPrefs();
    applyAutoFontSize();
    updatePreview();
  });
  sizeInput.addEventListener('input', () => {
    sizeValue.textContent = `${sizeInput.value}px`;
    updatePreview();
  });

  overlay.querySelector('.qr-card-close').addEventListener('click', removeCardOverlay);
  overlay.querySelector('.qr-card-btn-cancel').addEventListener('click', removeCardOverlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) removeCardOverlay();
  });

  confirmBtn.addEventListener('click', async () => {
    const cardText = textArea.value.trim();
    if (!cardText) {
      alert('请输入卡片文字');
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = '生成中…';

    try {
      const canvas = renderCardCanvas({
        text: cardText,
        templateId,
        fontId,
        ratioId,
        footerText: footerInput.value,
        footerFontSize: Number(footerSizeInput.value),
        fontSize: Number(sizeInput.value),
      });
      const blob = await canvasToBlob(canvas);
      persistPrefs();
      await insertImageToReply(article, blob);
      removeCardOverlay();
    } catch (err) {
      alert(err.message || String(err));
      confirmBtn.disabled = false;
      confirmBtn.textContent = '插入图片';
    }
  });

  applyAutoFontSize();
  updatePreview();
  textArea.focus();
}

window.QuickReplyCard = { showCardEditor };
