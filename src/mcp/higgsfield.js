const config = require('../config');

async function generate(endpoint, input) {
  if (!config.mcp.higgsfield.apiKey) {
    return { ok: false, error: 'HIGGSFIELD_API_KEY not set' };
  }

  const response = await fetch(`${config.mcp.higgsfield.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.mcp.higgsfield.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(120000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.message || data.error || `Higgsfield HTTP ${response.status}` };
  }

  return { ok: true, provider: 'higgsfield', endpoint, result: data };
}

async function textToImage(prompt, options = {}) {
  return generate('/v1/text2image/soul', {
    prompt,
    batch_size: 1,
    quality: options.quality || 'hd',
    ...options,
  });
}

async function imageToVideo(prompt, imageUrl, options = {}) {
  return generate('/veo3.1/image-to-video', {
    prompt,
    image_url: imageUrl,
    duration: options.duration || '6',
    resolution: options.resolution || '720',
    aspect_ratio: options.aspect_ratio || '16:9',
    generate_audio: options.generate_audio || false,
  });
}

function status() {
  return {
    provider: 'higgsfield',
    configured: Boolean(config.mcp.higgsfield.apiKey),
    baseUrl: config.mcp.higgsfield.baseUrl,
  };
}

module.exports = { generate, textToImage, imageToVideo, status };
