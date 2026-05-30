const BUTTON_ATTR = 'data-quick-reply-btn';
const PANEL_ATTR = 'data-quick-reply-panel';

function getTweetText(article) {
  const inlineReply = article.querySelector('[data-testid="inline_reply_offscreen"]');
  const texts = [];
  const seen = new Set();

  for (const el of article.querySelectorAll('[data-testid="tweetText"]')) {
    if (inlineReply?.contains(el)) continue;

    const text = el.innerText?.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    texts.push(text);
  }

  if (texts.length === 0) return '';
  if (texts.length === 1) return texts[0];

  const socialContext = article.querySelector('[data-testid="socialContext"]')?.innerText?.trim() || '';
  const isRepost = /repost/i.test(socialContext);
  const hasQuoteCard = !!article.querySelector('[data-testid="quoteTweet"], [data-testid="card.wrapper"]');

  if (isRepost && texts.length >= 2) {
    return `Repost note:\n${texts[0]}\n\nReposted content:\n${texts.slice(1).join('\n\n')}`;
  }

  if (hasQuoteCard && texts.length >= 2) {
    return `Quote comment:\n${texts[0]}\n\nQuoted post:\n${texts.slice(1).join('\n\n')}`;
  }

  return texts.map((text, index) => `[Part ${index + 1}]\n${text}`).join('\n\n');
}

function findInlineReply(article) {
  return article?.querySelector('[data-testid="inline_reply_offscreen"]') || null;
}

function findComposer(article) {
  const inlineReply = findInlineReply(article);
  if (inlineReply) {
    const composer = inlineReply.querySelector('[data-testid="tweetTextarea_0"]');
    if (composer) return composer;
  }

  const dialog = article?.closest('[role="dialog"]') || document.querySelector('[role="dialog"]');
  if (dialog) {
    const composer = dialog.querySelector('[data-testid="tweetTextarea_0"]');
    if (composer) return composer;
  }

  return article?.querySelector('[data-testid="tweetTextarea_0"]') || null;
}

function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

async function waitForComposer(article, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const composer = findComposer(article);
    if (composer && isVisible(composer)) return composer;
    await sleep(100);
  }
  return findComposer(article);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getReactFiber(node) {
  if (!node) return null;
  const key = Object.keys(node).find((k) => k.startsWith('__reactFiber$'));
  return key ? node[key] : null;
}

function findDraftEditorProps(composer) {
  let node = composer;
  while (node) {
    let fiber = getReactFiber(node);
    while (fiber) {
      const props = fiber.memoizedProps || fiber.pendingProps;
      if (props?.editorState && typeof props.onChange === 'function') {
        return props;
      }
      fiber = fiber.return;
    }
    node = node.parentElement;
  }
  return null;
}

function fillComposerViaDraftState(composer, text) {
  const props = findDraftEditorProps(composer);
  if (!props) return false;

  const { editorState, onChange } = props;
  const EditorState = editorState.constructor;
  const ContentState = editorState.getCurrentContent().constructor;

  if (typeof ContentState.createFromText !== 'function') return false;

  const newContent = ContentState.createFromText(text);
  let newEditorState = EditorState.createWithContent(newContent);
  if (typeof EditorState.moveFocusToEnd === 'function') {
    newEditorState = EditorState.moveFocusToEnd(newEditorState);
  }

  onChange(newEditorState);
  return true;
}

function normalizeText(text) {
  return (text || '').replace(/\u200B/g, '').replace(/\s+/g, ' ').trim();
}

function getComposerText(composer) {
  return normalizeText(composer.textContent);
}

function selectAllInComposer(composer) {
  composer.focus();
  if (document.execCommand('selectAll', false, null)) return;

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(composer);
  selection.removeAllRanges();
  selection.addRange(range);
}

function isComposerFilled(composer, text) {
  const current = getComposerText(composer);
  const expected = normalizeText(text);
  if (!expected) return true;
  return current === expected;
}

async function fillComposer(composer, text) {
  const target = text.trim();
  if (!target) return;

  composer.click();
  composer.focus();
  await sleep(30);

  // 直接更新 Draft.js 内部 state，避免 DOM 与发布内容不一致
  if (fillComposerViaDraftState(composer, target)) {
    await sleep(30);
    return;
  }

  // 回退：单次 selectAll + insertText（不用 paste，避免 state 重复）
  selectAllInComposer(composer);
  document.execCommand('insertText', false, target);
  await sleep(50);

  if (!isComposerFilled(composer, target)) {
    selectAllInComposer(composer);
    document.execCommand('insertText', false, target);
  }
}

function removePanel() {
  document.querySelector(`[${PANEL_ATTR}]`)?.remove();
}

function getPanelMountTarget(article, composer) {
  const inlineReply = findInlineReply(article);
  if (inlineReply) {
    const toolbar = inlineReply.querySelector('[data-testid="toolBar"]');
    if (toolbar) {
      return { node: toolbar, position: 'beforebegin' };
    }
    return { node: inlineReply, position: 'beforeend' };
  }

  const dialog = composer?.closest('[role="dialog"]');
  if (dialog) {
    const toolbar = dialog.querySelector('[data-testid="toolBar"]');
    if (toolbar) {
      return { node: toolbar, position: 'beforebegin' };
    }
    return { node: dialog, position: 'beforeend' };
  }

  const label = composer?.closest('[data-testid="tweetTextarea_0_label"]');
  if (label?.parentElement) {
    return { node: label.parentElement, position: 'afterend' };
  }

  return { node: composer?.parentElement || document.body, position: 'beforeend' };
}

function mountPanel(panel, target) {
  target.node.insertAdjacentElement(target.position, panel);
}

async function copyReplyText(text, copyBtn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  copyBtn.classList.add('qr-copy-done');
  copyBtn.setAttribute('aria-label', '已复制');
  copyBtn.title = '已复制';
  setTimeout(() => {
    copyBtn.classList.remove('qr-copy-done');
    copyBtn.setAttribute('aria-label', '复制');
    copyBtn.title = '复制';
  }, 1500);
}

async function fetchReplies(tweetText) {
  const response = await chrome.runtime.sendMessage({
    type: 'GENERATE_REPLIES',
    tweetText,
  });

  if (!response?.ok) {
    throw new Error(response?.error || '未知错误');
  }

  return response.replies;
}

async function generateAndShowPanel(article, composer, tweetText) {
  showLoading(article, composer);

  try {
    const replies = await fetchReplies(tweetText);
    showPanel(replies, composer, article, tweetText);
  } catch (err) {
    showError(err.message || String(err), article, composer, tweetText);
  }
}

function createRegenerateButton(article, composer, tweetText) {
  const btn = document.createElement('button');
  btn.className = 'qr-regenerate';
  btn.type = 'button';
  btn.textContent = '重新生成';
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    await generateAndShowPanel(article, composer, tweetText);
  });
  return btn;
}

function createPanelHeader(title, article, composer, tweetText) {
  const header = document.createElement('div');
  header.className = 'qr-panel-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'qr-panel-title';
  titleEl.textContent = title;

  const actions = document.createElement('div');
  actions.className = 'qr-panel-actions';

  if (tweetText) {
    actions.appendChild(createRegenerateButton(article, composer, tweetText));
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'qr-close';
  closeBtn.textContent = '×';
  closeBtn.title = '关闭';
  closeBtn.addEventListener('click', removePanel);
  actions.appendChild(closeBtn);

  header.appendChild(titleEl);
  header.appendChild(actions);
  return header;
}

function showPanel(replies, composer, article, tweetText) {
  removePanel();

  const panel = document.createElement('div');
  panel.setAttribute(PANEL_ATTR, 'true');
  panel.className = 'qr-panel';
  panel.appendChild(createPanelHeader('选择一条建议回复：', article, composer, tweetText));

  const list = document.createElement('div');
  list.className = 'qr-list';

  replies.forEach((reply) => {
    const row = document.createElement('div');
    row.className = 'qr-item-row';

    const item = document.createElement('button');
    item.className = 'qr-item';
    item.type = 'button';
    item.textContent = reply;
    item.addEventListener('click', async () => {
      await fillComposer(composer, reply);
      row.classList.add('qr-item-selected');
      setTimeout(removePanel, 400);
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'qr-copy';
    copyBtn.type = 'button';
    copyBtn.title = '复制';
    copyBtn.setAttribute('aria-label', '复制');
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" class="qr-copy-icon">
        <path fill="currentColor" d="M7 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6zm2-4a4 4 0 0 0-4 4v12a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V6a4 4 0 0 0-4-4H9zm-2 4a2 2 0 0 1 2-2h1v1a3 3 0 0 0 3 3h7v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6z"/>
      </svg>
    `;
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyReplyText(reply, copyBtn);
    });

    const cardBtn = document.createElement('button');
    cardBtn.className = 'qr-card';
    cardBtn.type = 'button';
    cardBtn.title = '生成文字卡片';
    cardBtn.setAttribute('aria-label', '生成文字卡片');
    cardBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" class="qr-card-icon">
        <path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v12h16V6H4zm3 3h10v2H7V9zm0 4h7v2H7v-2z"/>
      </svg>
    `;
    cardBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      let composer = findComposer(article);
      if (!composer || !isVisible(composer)) {
        article.querySelector('[data-testid="reply"]')?.click();
        composer = await waitForComposer(article);
      }

      if (!composer) {
        alert('请先打开回复框');
        return;
      }

      window.QuickReplyCard?.showCardEditor({ text: reply, article });
    });

    row.appendChild(item);
    row.appendChild(copyBtn);
    row.appendChild(cardBtn);
    list.appendChild(row);
  });

  panel.appendChild(list);
  mountPanel(panel, getPanelMountTarget(article, composer));
}

function showError(message, article, composer, tweetText) {
  removePanel();

  const panel = document.createElement('div');
  panel.setAttribute(PANEL_ATTR, 'true');
  panel.className = 'qr-panel qr-panel-error';
  panel.appendChild(createPanelHeader('生成失败', article, composer, tweetText));

  const errorText = document.createElement('p');
  errorText.className = 'qr-error-text';
  errorText.textContent = message;
  panel.appendChild(errorText);

  mountPanel(panel, getPanelMountTarget(article, composer));
}

function showLoading(article, composer) {
  removePanel();

  const panel = document.createElement('div');
  panel.setAttribute(PANEL_ATTR, 'true');
  panel.className = 'qr-panel qr-panel-loading';
  panel.innerHTML = '<div class="qr-spinner"></div><span>正在生成建议回复…</span>';
  mountPanel(panel, getPanelMountTarget(article, composer));
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function handleQuickReply(article, btn) {
  const tweetText = getTweetText(article);
  if (!tweetText) {
    alert('无法读取帖子内容');
    return;
  }

  btn.disabled = true;
  btn.classList.add('qr-loading');

  let composer = findComposer(article);
  if (!composer || !isVisible(composer)) {
    const replyBtn = article.querySelector('[data-testid="reply"]');
    replyBtn?.click();
    composer = await waitForComposer(article);
  }

  if (!composer) {
    btn.disabled = false;
    btn.classList.remove('qr-loading');
    alert('未找到回复输入框，请先点击回复按钮');
    return;
  }

  composer.focus();
  await generateAndShowPanel(article, composer, tweetText);
  btn.disabled = false;
  btn.classList.remove('qr-loading');
}

function createButton(article, variant = 'action') {
  const btn = document.createElement('button');
  btn.setAttribute(BUTTON_ATTR, variant);
  btn.className = variant === 'inline' ? 'qr-trigger qr-trigger-inline' : 'qr-trigger';
  btn.type = 'button';
  btn.title = 'AI 建议回复';
  btn.setAttribute('aria-label', 'AI 建议回复');
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="qr-icon">
      <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM5 16l.8 2.4L8 19.2l-2.2.8L5 22.4l-.8-2.4L2 19.2l2.2-.8L5 16zm14 0l.8 2.4L20 19.2l-2.2.8 1.4 2.4-.8-2.4L16 19.2l2.2-.8 1.4-2.4z" fill="currentColor"/>
    </svg>
    <span class="qr-label">${variant === 'inline' ? '建议回复' : 'AI'}</span>
  `;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleQuickReply(article, btn);
  });
  return btn;
}

function findActionBar(article) {
  const replyBtn = article.querySelector('[data-testid="reply"]');
  if (!replyBtn) return null;
  return replyBtn.closest('[role="group"]');
}

function findTweetArticles() {
  const articles = new Set([
    ...document.querySelectorAll('article[data-testid="tweet"]'),
    ...document.querySelectorAll('article[role="article"]'),
  ]);
  return [...articles].filter((article) => article.querySelector('[data-testid="reply"]'));
}

function injectActionBarButton(article) {
  if (article.querySelector(`[${BUTTON_ATTR}="action"]`)) return;

  const actionBar = findActionBar(article);
  if (!actionBar) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'qr-action';
  wrapper.appendChild(createButton(article, 'action'));

  const flexRow = actionBar.querySelector(':scope > div') || actionBar;
  flexRow.appendChild(wrapper);
}

function injectInlineReplyButton(article) {
  const inlineReply = findInlineReply(article);
  if (!inlineReply || inlineReply.querySelector(`[${BUTTON_ATTR}="inline"]`)) return;

  const toolbar = inlineReply.querySelector('[data-testid="toolBar"]');
  if (!toolbar) return;

  const bar = document.createElement('div');
  bar.className = 'qr-inline-bar';
  bar.appendChild(createButton(article, 'inline'));
  toolbar.insertAdjacentElement('beforebegin', bar);
}

function scanTweets() {
  findTweetArticles().forEach((article) => {
    injectActionBarButton(article);
    injectInlineReplyButton(article);
  });
}

let scanScheduled = false;
function scheduleScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    scanTweets();
  });
}

const observer = new MutationObserver(scheduleScan);
observer.observe(document.body, { childList: true, subtree: true });
scheduleScan();
