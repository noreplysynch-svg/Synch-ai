// Minimal OAuth2 authorization-code flow helpers — no passport dependency needed.

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export const providers = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${APP_URL}/api/auth/oauth/google/callback`,
    scope: 'openid email profile',
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    redirectUri: `${APP_URL}/api/auth/oauth/microsoft/callback`,
    scope: 'openid email profile',
  },
};

export function buildAuthUrl(providerName, state) {
  const p = providers[providerName];
  if (!p || !p.clientId) return null;
  const params = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: p.scope,
    state,
  });
  return `${p.authUrl}?${params.toString()}`;
}

export async function exchangeCodeForUser(providerName, code) {
  const p = providers[providerName];
  const body = new URLSearchParams({
    client_id: p.clientId,
    client_secret: p.clientSecret,
    code,
    redirect_uri: p.redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch(p.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!tokenRes.ok) throw new Error(`${providerName} token exchange failed`);
  const tokenData = await tokenRes.json();

  const userRes = await fetch(p.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userRes.ok) throw new Error(`${providerName} userinfo fetch failed`);
  const profile = await userRes.json();

  return {
    email: profile.email,
    fullName: profile.name || profile.given_name || '',
    providerId: profile.sub || profile.id,
  };
}
