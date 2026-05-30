const DEFAULT_CONFIG = {
  apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/responses',
  model: 'deepseek-v3-2-251201',
  apiKey: '',
};

async function getConfig() {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG));
  return { ...DEFAULT_CONFIG, ...stored };
}

function buildPrompt(tweetText) {
  return `You are helping draft replies for an X (Twitter) post.

Task: Generate exactly 4 suggested reply options.

CRITICAL — Language rule (highest priority):
1. Detect the language of the original post below.
2. Write ALL 4 replies in that SAME language only.
3. Do not translate the post. Do not reply in a different language.
4. If the post is in English, replies must be English. If Chinese, replies must be Chinese. Same for any other language.

Other requirements:
- Each reply must be under 280 characters.
- Vary tone: thoughtful, witty, supportive, question-based.
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

async function callLLM(tweetText) {
  const config = await getConfig();
  if (!config.apiKey) {
    throw new Error('请先在插件设置中配置 API Key');
  }

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: buildPrompt(tweetText),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API 请求失败 (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = extractTextFromResponse(data);
  return parseReplies(text);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'GENERATE_REPLIES') {
    return false;
  }

  callLLM(message.tweetText)
    .then((replies) => sendResponse({ ok: true, replies }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));

  return true;
});
