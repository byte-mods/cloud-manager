import { NextRequest } from "next/server";

const CLAUDE_AI_SERVICE_URL = process.env.CLAUDE_AI_SERVICE_URL ?? "http://localhost:8084";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  try {
    const response = await fetch(`${CLAUDE_AI_SERVICE_URL}/api/v1/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers
            .entries()
            .filter(([key]) => ["authorization"].includes(key.toLowerCase()))
        ),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "AI service error" }));
      return Response.json(error, { status: response.status });
    }

    // For streaming responses, pipe the SSE stream
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } catch {
            // Stream ended
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Non-streaming response
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: "AI service unavailable" },
      { status: 503 }
    );
  }
}
