pub mod chat;
pub mod cost;
pub mod iac;
pub mod policy;
pub mod security;
pub mod terminal;

use actix_web::{web, HttpResponse};

use crate::anthropic::AnthropicClient;
use crate::error::AiError;
use crate::models::chat::AnthropicMessage;
use crate::models::iac::{QueryAssistantRequest, QueryAssistantResponse};

/// POST /api/v1/ai/query-assistant
///
/// General-purpose query assistant for cloud management questions.
pub async fn query_assistant(
    client: web::Data<AnthropicClient>,
    body: web::Json<QueryAssistantRequest>,
) -> Result<HttpResponse, AiError> {
    let request = body.into_inner();

    let mut system_prompt = "You are a knowledgeable cloud infrastructure assistant. \
        Answer questions about AWS, GCP, Azure, Kubernetes, DevOps, and cloud architecture. \
        Provide accurate, concise answers with references when possible.\n\n\
        Return your response as JSON with these fields:\n\
        - \"answer\": your detailed answer\n\
        - \"sources\": array of relevant documentation links or references"
        .to_string();

    if let Some(context) = &request.context {
        system_prompt.push_str(&format!(
            "\n\nAdditional context: {}",
            serde_json::to_string_pretty(context).unwrap_or_default()
        ));
    }

    let messages = vec![AnthropicMessage {
        role: "user".to_string(),
        content: request.query,
    }];

    let response = client.send_message(messages, &system_prompt, None).await?;

    let parsed: serde_json::Value =
        serde_json::from_str(&response.content).unwrap_or_else(|_| {
            serde_json::json!({
                "answer": response.content,
                "sources": []
            })
        });

    let assistant_response = QueryAssistantResponse {
        answer: parsed["answer"]
            .as_str()
            .unwrap_or(&response.content)
            .to_string(),
        sources: parsed["sources"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default(),
    };

    Ok(HttpResponse::Ok().json(assistant_response))
}
