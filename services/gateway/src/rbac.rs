use actix_web::{HttpMessage, HttpRequest};

/// Role-based access control check for the gateway.
/// Maps URL paths to modules, then checks the permission matrix.

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Module {
    Compute,
    Storage,
    Networking,
    Database,
    AiMl,
    Security,
    SecurityTesting,
    Monitoring,
    Devops,
    DataEngineering,
    Cost,
    Iot,
    Analytics,
    Tutorials,
    Settings,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Permission {
    Full,
    ReadWrite,
    Read,
    None,
}

/// Map URL path to module.
pub fn path_to_module(path: &str) -> Option<Module> {
    let normalized = path.trim_start_matches("/api/v1/");
    let first_segment = normalized.split('/').next()?;

    match first_segment {
        "cloud" => {
            // Further inspect: /cloud/{provider}/compute, /cloud/{provider}/storage, etc.
            let parts: Vec<&str> = normalized.split('/').collect();
            if parts.len() >= 3 {
                match parts[2] {
                    "compute" => Some(Module::Compute),
                    "storage" => Some(Module::Storage),
                    "networking" => Some(Module::Networking),
                    "database" => Some(Module::Database),
                    "serverless" | "kubernetes" | "containers" | "batch" => Some(Module::Compute),
                    "iot" => Some(Module::Iot),
                    "ml" => Some(Module::AiMl),
                    "dns" | "cdn" | "waf" => Some(Module::Networking),
                    "iam" | "kms" => Some(Module::Security),
                    "devops" => Some(Module::Devops),
                    _ => None,
                }
            } else {
                None
            }
        }
        "security" => Some(Module::Security),
        "monitoring" => Some(Module::Monitoring),
        "cost" => Some(Module::Cost),
        "ai" | "ai-ml" => Some(Module::AiMl),
        "learn" => Some(Module::Tutorials),
        "data-engineering" => Some(Module::DataEngineering),
        "analytics" => Some(Module::Analytics),
        "auth" => Some(Module::Settings),
        _ => None,
    }
}

/// Get permission for a role + module combination.
pub fn get_permission(role: &str, module: Module) -> Permission {
    match (role, module) {
        // Cloud Architect: Full access to everything
        ("cloud_architect", _) => Permission::Full,

        // DevOps Engineer
        ("devops_engineer", Module::Compute) => Permission::Full,
        ("devops_engineer", Module::Devops) => Permission::Full,
        ("devops_engineer", Module::Storage) => Permission::ReadWrite,
        ("devops_engineer", Module::Security) => Permission::ReadWrite,
        ("devops_engineer", Module::DataEngineering) => Permission::ReadWrite,
        ("devops_engineer", Module::Tutorials) => Permission::Full,
        ("devops_engineer", _) => Permission::Read,

        // Data Engineer
        ("data_engineer", Module::DataEngineering) => Permission::Full,
        ("data_engineer", Module::Storage) => Permission::Full,
        ("data_engineer", Module::Database) => Permission::Full,
        ("data_engineer", Module::Analytics) => Permission::Full,
        ("data_engineer", Module::AiMl) => Permission::Full,
        ("data_engineer", Module::Devops) => Permission::ReadWrite,
        ("data_engineer", Module::Tutorials) => Permission::Full,
        ("data_engineer", _) => Permission::Read,

        // System Admin
        ("system_admin", Module::Compute) => Permission::Full,
        ("system_admin", Module::Storage) => Permission::Full,
        ("system_admin", Module::Database) => Permission::Full,
        ("system_admin", Module::Security) => Permission::Full,
        ("system_admin", Module::SecurityTesting) => Permission::Full,
        ("system_admin", Module::Cost) => Permission::Full,
        ("system_admin", Module::Monitoring) => Permission::Full,
        ("system_admin", Module::Networking) => Permission::ReadWrite,
        ("system_admin", Module::Tutorials) => Permission::Full,
        ("system_admin", _) => Permission::Read,

        // Network Admin
        ("network_admin", Module::Networking) => Permission::Full,
        ("network_admin", Module::Security) => Permission::ReadWrite,
        ("network_admin", Module::SecurityTesting) => Permission::ReadWrite,
        ("network_admin", Module::Tutorials) => Permission::Full,
        ("network_admin", _) => Permission::Read,

        // Default: read-only
        (_, Module::Tutorials) => Permission::Full,
        (_, Module::Settings) => Permission::Full,
        _ => Permission::Read,
    }
}

/// Check if a request should be allowed based on JWT role.
pub fn check_access(req: &HttpRequest) -> bool {
    let method = req.method().as_str();
    let path = req.path();

    // Health check and public routes always allowed
    if path == "/health" || path.starts_with("/api/v1/auth/login") || path.starts_with("/api/v1/auth/register") {
        return true;
    }

    // Extract role from JWT claims (set by auth middleware)
    let extensions = req.extensions();
    let role = extensions
        .get::<serde_json::Value>()
        .and_then(|claims| claims.get("role").and_then(|r| r.as_str()))
        .unwrap_or("viewer");

    let module = match path_to_module(path) {
        Some(m) => m,
        None => return true, // Unknown paths are allowed (they'll 404 naturally)
    };

    let permission = get_permission(role, module);

    match method {
        "GET" | "HEAD" | "OPTIONS" => permission != Permission::None,
        "POST" | "PUT" | "PATCH" | "DELETE" => {
            matches!(permission, Permission::Full | Permission::ReadWrite)
        }
        _ => false,
    }
}
