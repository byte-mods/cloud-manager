use bytes::Bytes;
use futures::Stream;
use reqwest::Client;
use tokio_stream::StreamExt;

use crate::config::AppConfig;
use crate::error::AiError;
use crate::models::chat::{
    AnthropicMessage, AnthropicRequest, AnthropicResponse, ChatResponse, StreamEvent,
};

#[derive(Clone)]
pub struct AnthropicClient {
    client: Client,
    api_key: String,
    api_url: String,
    model: String,
    max_tokens: u32,
}

impl AnthropicClient {
    pub fn new(config: &AppConfig) -> Self {
        Self {
            client: Client::new(),
            api_key: config.anthropic_api_key.clone(),
            api_url: config.anthropic_api_url.clone(),
            model: config.model.clone(),
            max_tokens: config.max_tokens,
        }
    }

    /// Send a non-streaming message to the Anthropic Messages API.
    pub async fn send_message(
        &self,
        messages: Vec<AnthropicMessage>,
        system: &str,
        max_tokens: Option<u32>,
    ) -> Result<ChatResponse, AiError> {
        let request = AnthropicRequest {
            model: self.model.clone(),
            max_tokens: max_tokens.unwrap_or(self.max_tokens),
            system: system.to_string(),
            messages,
            stream: None,
        };

        let response = self
            .client
            .post(format!("{}/v1/messages", self.api_url))
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AiError::AnthropicApi(format!(
                "API returned {status}: {body}"
            )));
        }

        let api_response: AnthropicResponse = response.json().await?;

        let content = api_response
            .content
            .iter()
            .filter_map(|block| block.text.as_ref())
            .cloned()
            .collect::<Vec<_>>()
            .join("");

        Ok(ChatResponse {
            id: api_response.id,
            content,
            model: api_response.model,
        })
    }

    /// Send a streaming message to the Anthropic Messages API.
    /// Returns a stream of `StreamEvent` items for SSE forwarding.
    pub async fn send_message_stream(
        &self,
        messages: Vec<AnthropicMessage>,
        system: &str,
        max_tokens: Option<u32>,
    ) -> Result<impl Stream<Item = Result<StreamEvent, AiError>>, AiError> {
        let request = AnthropicRequest {
            model: self.model.clone(),
            max_tokens: max_tokens.unwrap_or(self.max_tokens),
            system: system.to_string(),
            messages,
            stream: Some(true),
        };

        let response = self
            .client
            .post(format!("{}/v1/messages", self.api_url))
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AiError::AnthropicApi(format!(
                "API returned {status}: {body}"
            )));
        }

        let byte_stream = response.bytes_stream();

        let event_stream = byte_stream
            .map(|chunk: Result<Bytes, reqwest::Error>| -> Result<StreamEvent, AiError> {
                let chunk = chunk.map_err(|e| AiError::StreamError(e.to_string()))?;
                let text = String::from_utf8_lossy(&chunk);

                // Parse SSE lines from the chunk.
                let mut event_name = String::from("message");
                let mut data_lines = Vec::new();

                for line in text.lines() {
                    if let Some(evt) = line.strip_prefix("event: ") {
                        event_name = evt.trim().to_string();
                    } else if let Some(d) = line.strip_prefix("data: ") {
                        data_lines.push(d.trim().to_string());
                    }
                }

                let data = data_lines.join("\n");

                Ok(StreamEvent {
                    event: event_name,
                    data,
                })
            });

        Ok(event_stream)
    }
}
