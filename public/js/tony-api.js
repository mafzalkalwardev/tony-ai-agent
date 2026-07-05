/**
 * Shared TONY API client — safe JSON, token handling, clear errors.
 */
(() => {
  const TOKEN_KEY = 'tony_api_token';

  function resolveToken() {
    const fromUrl = new URLSearchParams(location.search).get('token');
    const stored = localStorage.getItem(TOKEN_KEY);
    const token = fromUrl || stored || '';
    if (fromUrl && fromUrl !== stored) {
      localStorage.setItem(TOKEN_KEY, fromUrl);
    }
    return token;
  }

  async function parseResponse(response) {
    const ct = response.headers.get('content-type') || '';
    const text = await response.text();
    if (!text) return {};
    if (ct.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(
          text.trim().startsWith('<')
            ? 'Server returned HTML instead of JSON — check gateway is running and API token is correct'
            : `Invalid JSON response: ${text.slice(0, 80)}`
        );
      }
    }
    if (text.trim().startsWith('<')) {
      throw new Error('Server returned HTML — wrong URL or gateway not running. Try: npm run charlie');
    }
    return { raw: text };
  }

  function createApi(getToken = resolveToken) {
    return async function api(path, opts = {}) {
      const token = getToken();
      if (!token && path.startsWith('/api/')) {
        throw new Error('API token missing — enter TONY_API_TOKEN in the auth dialog');
      }

      let response;
      try {
        response = await fetch(path, {
          ...opts,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(opts.headers || {}),
          },
        });
      } catch (e) {
        throw new Error(
          e.message === 'Failed to fetch' || e.message.includes('fetch')
            ? 'Cannot reach TONY gateway — run npm run charlie in terminal'
            : e.message
        );
      }

      const data = await parseResponse(response);
      if (!response.ok) {
        throw new Error(data.error || data.message || `HTTP ${response.status}`);
      }
      return data;
    };
  }

  window.tonyCreateApi = createApi;
  window.tonyResolveToken = resolveToken;
})();
