const config = require('../config');

async function getAccessToken() {
  const { clientId, clientSecret, refreshToken } = config.mcp.quickbooks;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('QuickBooks OAuth not configured (QUICKBOOKS_CLIENT_ID/SECRET/REFRESH_TOKEN)');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(30000),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'QuickBooks token refresh failed');
  return data.access_token;
}

async function query(sql) {
  if (!config.mcp.quickbooks.realmId) {
    return { ok: false, error: 'QUICKBOOKS_REALM_ID not set' };
  }

  try {
    const token = await getAccessToken();
    const base = config.mcp.quickbooks.sandbox
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';
    const url = `${base}/v3/company/${config.mcp.quickbooks.realmId}/query?query=${encodeURIComponent(sql)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(30000),
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.Fault?.Error?.[0]?.Message || `QuickBooks HTTP ${response.status}` };
    }

    return { ok: true, provider: 'quickbooks', query: sql, result: data.QueryResponse || data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function companyInfo() {
  return query('SELECT * FROM CompanyInfo');
}

function status() {
  const qb = config.mcp.quickbooks;
  return {
    provider: 'quickbooks',
    configured: Boolean(qb.clientId && qb.clientSecret && qb.refreshToken && qb.realmId),
    sandbox: qb.sandbox,
  };
}

module.exports = { query, companyInfo, status };
