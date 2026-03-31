import { NextRequest, NextResponse } from "next/server";

const MONITORING_SERVICE_URL = process.env.MONITORING_SERVICE_URL ?? "http://localhost:8087";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = slug?.join("/") ?? "";
  const searchParams = request.nextUrl.searchParams.toString();
  const url = searchParams ? `${endpoint}?${searchParams}` : endpoint;

  try {
    const response = await fetch(`${MONITORING_SERVICE_URL}/api/v1/monitoring/${url}`, {
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
    // Fallback to mock data when service is unavailable
    return NextResponse.json({ error: "Monitoring service unavailable" }, { status: 503 });
  }
}

