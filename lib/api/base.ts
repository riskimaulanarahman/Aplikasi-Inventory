function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getServerApiBaseUrl() {
  const value = process.env.API_BASE_URL_SERVER ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) {
    throw new Error('API_BASE_URL_SERVER or NEXT_PUBLIC_API_BASE_URL is not configured.');
  }
  return trimTrailingSlash(value);
}

export function getClientApiBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured.');
  }
  return trimTrailingSlash(value);
}
