use actix_web::HttpRequest;

/// Derive an audit action name from HTTP method + path.
pub fn derive_action(method: &str, path: &str) -> String {
    let parts: Vec<&str> = path.trim_start_matches("/api/v1/").split('/').collect();
    let service = parts.first().copied().unwrap_or("unknown");
    let resource = parts.get(1).copied().unwrap_or("unknown");
    match method {
        "POST" => format!("{service}.{resource}.create"),
        "PUT" | "PATCH" => format!("{service}.{resource}.update"),
        "DELETE" => format!("{service}.{resource}.delete"),
        _ => format!("{service}.{resource}.read"),
    }
}

/// Extract client IP from request.
pub fn extract_ip(req: &HttpRequest) -> String {
    req.connection_info()
        .realip_remote_addr()
        .unwrap_or("unknown")
        .to_string()
}
