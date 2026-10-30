const issuer = import.meta.env.VITE_AUTH0_ISSUER?.trim() ?? '';
const audience = import.meta.env.VITE_AUTH0_AUDIENCE?.trim() ?? '';
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID?.trim() ?? '';

let domain = '';
let issuerIsValid = false;

try {
  const parsedIssuer = new URL(issuer);
  issuerIsValid = parsedIssuer.protocol === 'https:' && Boolean(parsedIssuer.hostname);
  domain = parsedIssuer.hostname;
} catch {
  issuerIsValid = false;
}

export const authConfig = {
  audience,
  clientId,
  domain,
  isConfigured: issuerIsValid && Boolean(audience) && Boolean(clientId),
};
