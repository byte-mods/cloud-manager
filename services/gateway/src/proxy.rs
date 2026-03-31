use crate::config::AppConfig;
use crate::error::GatewayError;
use actix_web::HttpRequest;
use reqwest::Client;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Tracks per-service circuit breaker state.
#[derive(Debug, Clone)]
struct CircuitState {
    failure_count: u64,
    last_failure: Option<Instant>,
    state: BreakerState,
}

#[derive(Debug, Clone, PartialEq)]
enum BreakerState {
    Closed,
    Open,
    HalfOpen,
}

impl Default for CircuitState {
    fn default() -> Self {
        Self {
            failure_count: 0,
            last_failure: None,
            state: BreakerState::Closed,
        }
    }
}

/// HTTP proxy that forwards requests to downstream services with circuit-breaker protection.
#[derive(Clone)]
pub struct ServiceProxy {
    client: Client,
    config: AppConfig,
    circuits: Arc<Mutex<HashMap<String, CircuitState>>>,
    /// Number of consecutive failures before opening the circuit.
    failure_threshold: u64,
    /// How long the circuit stays open before transitioning to half-open.
    recovery_timeout: Duration,
}

impl ServiceProxy {
    pub fn new(config: AppConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            client,
            config,
            circuits: Arc::new(Mutex::new(HashMap::new())),
            failure_threshold: 5,
            recovery_timeout: Duration::from_secs(30),
        }
    }

    /// Forward an incoming gateway request to the appropriate downstream service.
    pub async fn forward(
        &self,
        service_name: &str,
        downstream_path: &str,
        req: &HttpRequest,
        body: actix_web::web::Bytes,
    ) -> Result<actix_web::HttpResponse, GatewayError> {
        let base_url = self
            .config
            .service_url(service_name)
            .ok_or_else(|| GatewayError::UnknownService(service_name.to_owned()))?;

        // Circuit breaker check.
        self.check_circuit(service_name)?;

        let url = format!("{base_url}{downstream_path}");
        let method = reqwest::Method::from_bytes(req.method().as_str().as_bytes())
            .map_err(|_| GatewayError::BadGateway("Invalid HTTP method".to_string()))?;

        // Build outgoing request, preserving relevant headers.
        let mut outgoing = self.client.request(method, &url);

        for (key, value) in req.headers() {
            let name = key.as_str().to_lowercase();
            // Skip hop-by-hop headers.
            if matches!(
                name.as_str(),
                "host" | "connection" | "transfer-encoding" | "keep-alive"
            ) {
                continue;
            }
            outgoing = outgoing.header(name.as_str(), value.to_str().unwrap_or_default());
        }

        // Add trace ID header.
        let request_id = uuid::Uuid::new_v4().to_string();
        outgoing = outgoing.header("X-Request-ID", &request_id);

        let outgoing = outgoing.body(body.to_vec());

        match outgoing.send().await {
            Ok(resp) => {
                self.record_success(service_name);

                let status =
                    actix_web::http::StatusCode::from_u16(resp.status().as_u16()).unwrap();
                let mut builder = actix_web::HttpResponse::build(status);

                for (key, value) in resp.headers() {
                    let name = key.as_str();
                    let val = value.to_str().unwrap_or_default();
                    builder.insert_header((name, val));
                }
                builder.insert_header(("X-Request-ID", request_id.as_str()));

                let response_body = resp
                    .bytes()
                    .await
                    .map_err(|e| GatewayError::BadGateway(e.to_string()))?;

                Ok(builder.body(response_body))
            }
            Err(e) => {
                self.record_failure(service_name);
                tracing::error!(service = service_name, error = %e, "Proxy request failed");
                Err(GatewayError::BadGateway(e.to_string()))
            }
        }
    }

    fn check_circuit(&self, service: &str) -> Result<(), GatewayError> {
        let mut circuits = self.circuits.lock().unwrap();
        let state = circuits
            .entry(service.to_owned())
            .or_insert_with(CircuitState::default);

        match state.state {
            BreakerState::Closed => Ok(()),
            BreakerState::HalfOpen => Ok(()), // allow a trial request
            BreakerState::Open => {
                if let Some(last) = state.last_failure {
                    if last.elapsed() >= self.recovery_timeout {
                        state.state = BreakerState::HalfOpen;
                        tracing::info!(service, "Circuit breaker transitioning to half-open");
                        Ok(())
                    } else {
                        Err(GatewayError::CircuitOpen(service.to_owned()))
                    }
                } else {
                    Ok(())
                }
            }
        }
    }

    fn record_success(&self, service: &str) {
        let mut circuits = self.circuits.lock().unwrap();
        if let Some(state) = circuits.get_mut(service) {
            state.failure_count = 0;
            state.state = BreakerState::Closed;
        }
    }

    fn record_failure(&self, service: &str) {
        let mut circuits = self.circuits.lock().unwrap();
        let state = circuits
            .entry(service.to_owned())
            .or_insert_with(CircuitState::default);
        state.failure_count += 1;
        state.last_failure = Some(Instant::now());
        if state.failure_count >= self.failure_threshold {
            state.state = BreakerState::Open;
            tracing::warn!(
                service,
                failures = state.failure_count,
                "Circuit breaker opened"
            );
        }
    }
}
