import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_STRAPI_URL =
  process.env.STRAPI_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

export async function GET(request: NextRequest) {
  try {
    const locale = request.nextUrl.searchParams.get("locale") || "en";

    const url = new URL(`${BACKEND_STRAPI_URL}/api/site-setting`);
    url.searchParams.set("locale", locale);
    url.searchParams.set("populate[logo]", "true");

    const headers: HeadersInit = { Accept: "application/json" };
    if (STRAPI_API_TOKEN) {
      headers["Authorization"] = `Bearer ${STRAPI_API_TOKEN}`;
    }

    const response = await fetch(url.toString(), {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Strapi returned " + response.status },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
