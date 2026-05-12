import { NextRequest, NextResponse } from "next/server";

// Server-side URL for container-to-container communication
const BACKEND_URL =
  process.env.BACKEND_API_URL || "http://physio-backend:8080/api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const params = new URLSearchParams();

    const search = searchParams.get("search");
    const delivery = searchParams.get("delivery");
    const pricing = searchParams.get("pricing");
    const cmeAccredited = searchParams.get("cmeAccredited");
    const language = searchParams.get("language");
    const availability = searchParams.get("availability");
    const scope = searchParams.get("scope");
    const sort = searchParams.get("sort");
    const page = searchParams.get("page");
    const limit = searchParams.get("limit");

    if (search) params.set("search", search);
    if (delivery) params.set("delivery", delivery);
    if (pricing) params.set("pricing", pricing);
    if (cmeAccredited) params.set("cmeAccredited", cmeAccredited);
    if (language) params.set("language", language);
    if (availability) params.set("availability", availability);
    if (scope) params.set("scope", scope);
    if (sort) params.set("sort", sort);
    if (page) params.set("page", page);
    if (limit) params.set("limit", limit);

    const qs = params.toString();
    const url = `${BACKEND_URL}/courses/public${qs ? `?${qs}` : ""}`;

    const response = await globalThis.fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Backend returned " + response.status },
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
