// Strapi API Client

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Build URL with query parameters
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${STRAPI_URL}/api${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Fetch data from Strapi API
 * Returns null if the request fails (graceful degradation)
 */
export async function fetchStrapi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T | null> {
  const { params, ...fetchOptions } = options;

  // In development, fetch draft content so unpublished changes are visible
  const isDev = process.env.NODE_ENV === 'development';
  const mergedParams = {
    ...params,
    ...(isDev && !params?.status ? { status: 'draft' } : {}),
  };

  const url = buildUrl(endpoint, mergedParams);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add API token for server-side requests
  if (STRAPI_API_TOKEN) {
    headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...headers,
        ...fetchOptions.headers,
      },
      cache: isDev ? 'no-store' : undefined,
      next: isDev ? undefined : {
        revalidate: 60, // Revalidate every 60 seconds (ISR) in production
      },
    });

    if (!response.ok) {
      console.warn(`Strapi API warning: ${response.status} ${response.statusText} for ${endpoint}`);
      return null;
    }

    return response.json();
  } catch (error) {
    console.warn(`Strapi API connection error for ${endpoint}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Get full URL for Strapi media
 */
export function getStrapiMediaUrl(url: string | null | undefined): string {
  if (!url) return '';

  // If URL is already absolute, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Otherwise, prepend Strapi URL
  return `${STRAPI_URL}${url}`;
}

/**
 * Get Strapi URL for external use
 */
export function getStrapiUrl(): string {
  return STRAPI_URL;
}
