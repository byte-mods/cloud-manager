import { NextRequest, NextResponse } from "next/server";

const AI_ML_SERVICE_URL = process.env.AI_ML_SERVICE_URL ?? "http://localhost:8082";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = slug?.join("/") ?? "";
  const searchParams = request.nextUrl.searchParams.toString();
  const url = searchParams ? `${endpoint}?${searchParams}` : endpoint;

  try {
    const response = await fetch(`${AI_ML_SERVICE_URL}/api/v1/ai-ml/${url}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers.entries().filter(([key]) =>
            ["authorization", "x-cloud-region", "x-cloud-account"].includes(key.toLowerCase())
          )
        ),
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "AI/ML service unavailable" }, { status: 503 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = slug?.join("/") ?? "";
  const body = await request.json().catch(() => ({}));

  try {
    const response = await fetch(`${AI_ML_SERVICE_URL}/api/v1/ai-ml/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers.entries().filter(([key]) =>
            ["authorization", "x-cloud-region", "x-cloud-account"].includes(key.toLowerCase())
          )
        ),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}

