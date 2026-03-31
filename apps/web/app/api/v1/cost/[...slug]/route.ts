import { NextRequest, NextResponse } from "next/server";

const COST_SERVICE_URL = process.env.COST_SERVICE_URL ?? "http://localhost:8086";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = slug?.join("/") ?? "";
  const searchParams = request.nextUrl.searchParams.toString();
  const url = searchParams ? `${endpoint}?${searchParams}` : endpoint;

  try {
    const response = await fetch(`${COST_SERVICE_URL}/api/v1/cost/${url}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers
            .entries()
            .filter(([key]) =>
              ["authorization", "x-cloud-region"].includes(key.toLowerCase())
            )
        ),
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Cost service unavailable" },
      { status: 503 }
    );
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
    const response = await fetch(`${COST_SERVICE_URL}/api/v1/cost/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers
            .entries()
            .filter(([key]) =>
              ["authorization", "x-cloud-region"].includes(key.toLowerCase())
            )
        ),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Cost service unavailable" },
      { status: 503 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = slug?.join("/") ?? "";
  const body = await request.json().catch(() => ({}));

  try {
    const response = await fetch(`${COST_SERVICE_URL}/api/v1/cost/${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers
            .entries()
            .filter(([key]) =>
              ["authorization", "x-cloud-region"].includes(key.toLowerCase())
            )
        ),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Cost service unavailable" },
      { status: 503 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = slug?.join("/") ?? "";

  try {
    const response = await fetch(`${COST_SERVICE_URL}/api/v1/cost/${endpoint}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers
            .entries()
            .filter(([key]) =>
              ["authorization", "x-cloud-region"].includes(key.toLowerCase())
            )
        ),
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Cost service unavailable" },
      { status: 503 }
    );
  }
}
