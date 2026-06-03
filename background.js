const DEFAULT_CONFIG = {
  apiMode: 'responses',
  apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/responses',
  model: 'deepseek-v3-2-251201',
  apiKey: '',
  toneGuidance: 'thoughtful, witty, supportive, question-based',
};

async function getConfig() {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG));
  const config = { ...DEFAULT_CONFIG, ...stored };
  config.apiKey = String(config.apiKey || '').trim().replace(/^\uFEFF/, '');
  return config;
}

function sanitizeText(text) {
  return String(text || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function resolveApiMode(config) {
  const url = String(config.apiUrl || '').toLowerCase();
  if (url.includes('chat/completions')) return 'openai';
  if (url.includes('/responses')) return 'responses';
  return config.apiMode === 'openai' ? 'openai' : 'responses';
}

function formatApiError(status, errText) {
  try {
    const err = JSON.parse(errText);
    const message = err.error?.message || err.message || errText;
    const code = err.error?.code || err.error?.type || '';

    if (code === 'bad_response_body' || message.includes('\\x1f')) {
      return [
        'API 网关无法解析上游响应（常见于格式与 URL 不匹配，或第三方代理 gzip 处理异常）。',
        '请检查：',
        '1. Responses API 请用 …/responses，OpenAI 格式请用 …/chat/completions',
        '2. Model 名称是否与接口一致',
        '3. 第三方代理可尝试直连官方接口',
        `详情: ${message}`,
      ].join('\n');
    }

    return `API 请求失败 (${status}): ${message}`;
  } catch {
    return `API 请求失败 (${status}): ${errText.slice(0, 300)}`;
  }
}

function buildPrompt(tweetText, toneGuidance, composeMode) {
  const tone = toneGuidance || DEFAULT_CONFIG.toneGuidance;
  const isQuote = composeMode === 'quote';

  const task = isQuote
    ? `You are helping draft quote-tweet commentary for an X (Twitter) post.
The user will publish a NEW post that embeds the original below (quote tweet), not a threaded reply.

Task: Generate exactly 4 suggested quote-tweet comment options.`
    : `You are helping draft replies for an X (Twitter) post.

Task: Generate exactly 4 suggested reply options.`;

  const styleRules = isQuote
    ? `- Write as standalone commentary above the embedded quoted post
- Do NOT write as a direct @mention thread reply unless the original already uses @mentions
- Suitable for sharing to your own timeline with the quoted post attached`
    : `- Write as replies in the conversation under the post`;

  return `${task}

CRITICAL — Language rule (highest priority):
1. Detect the language of the original post below.
2. Write ALL 4 options in that SAME language only.
3. Do not translate the post. Do not reply in a different language.
4. If the post is in English, options must be English. If Chinese, options must be Chinese. Same for any other language.

Other requirements:
${styleRules}
- Each option must be under 280 characters.
- Vary tone: ${tone}.
- Return ONLY a valid JSON array of 4 strings. No markdown, no explanation.

Original post (may include repost note and embedded content):
"""
${tweetText}
"""`;
}

function extractTextFromResponse(data) {
  if (typeof data.output_text === 'string') {
    return data.output_text;
  }

  const outputs = data.output || [];
  for (const item of outputs) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const block of item.content) {
        if (block.type === 'output_text' && block.text) {
          return block.text;
        }
      }
    }
  }

  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }

  throw new Error('无法解析 API 响应');
}

function parseReplies(text) {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('模型返回格式无效');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('模型未返回有效回复列表');
  }

  return parsed
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 6);
}

function buildRequestBody(config, prompt) {
  const mode = resolveApiMode(config);

  if (mode === 'openai') {
    return {
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
    };
  }

  return {
    model: config.model,
    stream: false,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: prompt,
          },
        ],
      },
    ],
  };
}

async function callLLM(tweetText, composeMode) {
  const config = await getConfig();
  if (!config.apiKey) {
    throw new Error('请先在插件设置中配置 API Key');
  }

  const mode = composeMode === 'quote' ? 'quote' : 'reply';
  const prompt = buildPrompt(sanitizeText(tweetText), config.toneGuidance, mode);
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(buildRequestBody(config, prompt)),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(formatApiError(response.status, errText));
  }

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('API 返回非 JSON 响应，请检查 URL 与 API 格式是否匹配');
  }
  const text = extractTextFromResponse(data);
  return parseReplies(text);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'GENERATE_REPLIES') {
    return false;
  }

  callLLM(message.tweetText, message.composeMode)
    .then((replies) => sendResponse({ ok: true, replies }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));

  return true;
});
