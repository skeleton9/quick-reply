const DEFAULTS = {
  apiMode: 'responses',
  apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/responses',
  model: 'deepseek-v3-2-251201',
  apiKey: '',
  toneGuidance: 'thoughtful, witty, supportive, question-based',
};

const MODE_DEFAULTS = {
  responses: {
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/responses',
    model: 'deepseek-v3-2-251201',
  },
  openai: {
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'deepseek-v3-2-251201',
  },
};

const fields = ['apiMode', 'apiKey', 'apiUrl', 'model', 'toneGuidance'];

function updateModeHints() {
  const mode = document.getElementById('apiMode').value;
  const defaults = MODE_DEFAULTS[mode];
  document.getElementById('apiUrl').placeholder = defaults.apiUrl;
  document.getElementById('model').placeholder = defaults.model;
  document.getElementById('apiKeyHint').textContent =
    mode === 'openai'
      ? 'OpenAI 或兼容接口 Key；URL 需为 …/chat/completions'
      : '火山方舟 Responses Key；URL 需为 …/responses';
}

function onModeChange() {
  const mode = document.getElementById('apiMode').value;
  const otherMode = mode === 'openai' ? 'responses' : 'openai';
  const apiUrlEl = document.getElementById('apiUrl');
  const modelEl = document.getElementById('model');
  const currentUrl = apiUrlEl.value.trim();
  const currentModel = modelEl.value.trim();

  if (!currentUrl || currentUrl === MODE_DEFAULTS[otherMode].apiUrl) {
    apiUrlEl.value = MODE_DEFAULTS[mode].apiUrl;
  }
  if (!currentModel || currentModel === MODE_DEFAULTS[otherMode].model) {
    modelEl.value = MODE_DEFAULTS[mode].model;
  }
  updateModeHints();
}

async function loadOptions() {
  const stored = await chrome.storage.sync.get(fields);
  for (const key of fields) {
    document.getElementById(key).value = stored[key] ?? DEFAULTS[key];
  }
  updateModeHints();
}

async function saveOptions() {
  const data = {};
  for (const key of fields) {
    data[key] = document.getElementById(key).value.trim();
  }
  await chrome.storage.sync.set(data);

  const status = document.getElementById('status');
  status.textContent = '已保存';
  setTimeout(() => {
    status.textContent = '';
  }, 2000);
}

document.getElementById('apiMode').addEventListener('change', onModeChange);
document.getElementById('save').addEventListener('click', saveOptions);
loadOptions();
