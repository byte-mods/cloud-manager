use actix_web::{web, HttpResponse};
use futures::StreamExt;

use crate::anthropic::AnthropicClient;
use crate::context::build_system_prompt;
use crate::error::AiError;
use crate::models::chat::{AnthropicMessage, ChatRequest, MessageRole};

/// POST /api/v1/ai/chat
///
/// Handles chat requests. When `stream` is true, returns an SSE stream
/// (content-type: text/event-stream). Otherwise returns a JSON ChatResponse.
pub async fn chat(
    client: web::Data<AnthropicClient>,
    body: web::Json<ChatRequest>,
) -> Result<HttpResponse, AiError> {
    let request = body.into_inner();

    if request.messages.is_empty() {
        return Err(AiError::BadRequest("messages must not be empty".into()));
    }

    let system_prompt = build_system_prompt(&request.context);

    let messages: Vec<AnthropicMessage> = request
        .messages
        .iter()
        .map(|m| AnthropicMessage {
            role: match m.role {
                MessageRole::User => "user".to_string(),
                MessageRole::Assistant => "assistant".to_string(),
            },
            content: m.content.clone(),
        })
        .collect();

    if request.stream.unwrap_or(false) {
        // Streaming SSE response
        let event_stream = client.send_message_stream(messages, &system_prompt, None).await?;

        let sse_stream = event_stream.map(|event_result| match event_result {
            Ok(event) => {
                let payload = serde_json::json!({
                    "event": event.event,
                    "data": event.data,
                });
                Ok::<_, actix_web::Error>(
                    bytes::Bytes::from(format!("data: {}\n\n", serde_json::to_string(&payload).unwrap_or_default())),
                )
            }
            Err(e) => {
                let payload = serde_json::json!({
                    "event": "error",
                    "data": e.to_string(),
                });
                Ok(bytes::Bytes::from(format!(
                    "data: {}\n\n",
                    serde_json::to_string(&payload).unwrap_or_default()
                )))
            }
        });

        Ok(HttpResponse::Ok()
            .content_type("text/event-stream")
            .insert_header(("Cache-Control", "no-cache"))
            .insert_header(("Connection", "keep-alive"))
            .streaming(sse_stream))
    } else {
        // Non-streaming JSON response
        let response = client.send_message(messages, &system_prompt, None).await?;
        Ok(HttpResponse::Ok().json(response))
    }
}
