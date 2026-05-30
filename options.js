const DEFAULTS = {
  apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/responses',
  model: 'deepseek-v3-2-251201',
  apiKey: '',
};

const fields = ['apiKey', 'apiUrl', 'model'];

async function loadOptions() {
  const stored = await chrome.storage.sync.get(fields);
  for (const key of fields) {
    document.getElementById(key).value = stored[key] ?? DEFAULTS[key];
  }
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

document.getElementById('save').addEventListener('click', saveOptions);
loadOptions();
