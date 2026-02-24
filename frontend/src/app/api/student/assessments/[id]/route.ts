import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  process.env.BACKEND_API_URL || "http://physio-backend:8080/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = request.headers.get("authorization") || "";

  const res = await globalThis.fetch(`${BACKEND}/student/assessments/${id}`, {
    headers: { authorization: auth },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
