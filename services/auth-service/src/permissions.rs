use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Module {
    CloudResources,
    SecurityDashboard,
    CostManagement,
    AiAssistant,
    Tutorials,
    UserManagement,
    Networking,
    DataPipelines,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Permission {
    Full,
    Write,
    Read,
    None,
}

/// Return the permission a given role (string) has for a given module.
pub fn get_permission(role: &str, module: &Module) -> Permission {
    match (role, module) {
        ("cloud_architect", Module::CloudResources)    => Permission::Full,
        ("cloud_architect", Module::SecurityDashboard) => Permission::Read,
        ("cloud_architect", Module::CostManagement)    => Permission::Full,
        ("cloud_architect", Module::AiAssistant)       => Permission::Full,
        ("cloud_architect", Module::Tutorials)         => Permission::Write,
        ("cloud_architect", Module::UserManagement)    => Permission::Full,
        ("cloud_architect", Module::Networking)        => Permission::Full,
        ("cloud_architect", Module::DataPipelines)     => Permission::Read,

        ("devops_engineer", Module::CloudResources)    => Permission::Write,
        ("devops_engineer", Module::SecurityDashboard) => Permission::Read,
        ("devops_engineer", Module::CostManagement)    => Permission::Read,
        ("devops_engineer", Module::AiAssistant)       => Permission::Full,
        ("devops_engineer", Module::Tutorials)         => Permission::Write,
        ("devops_engineer", Module::UserManagement)    => Permission::None,
        ("devops_engineer", Module::Networking)        => Permission::Write,
        ("devops_engineer", Module::DataPipelines)     => Permission::Full,

        ("data_engineer", Module::CloudResources)      => Permission::Read,
        ("data_engineer", Module::DataPipelines)       => Permission::Full,
        ("data_engineer", Module::AiAssistant)         => Permission::Full,
        ("data_engineer", _)                           => Permission::Read,

        ("system_admin", Module::UserManagement)       => Permission::Full,
        ("system_admin", Module::CloudResources)       => Permission::Full,
        ("system_admin", Module::SecurityDashboard)    => Permission::Full,
        ("system_admin", _)                            => Permission::Write,

        ("network_admin", Module::Networking)          => Permission::Full,
        ("network_admin", Module::SecurityDashboard)   => Permission::Write,
        ("network_admin", _)                           => Permission::Read,

        (_, Module::Tutorials) => Permission::Read,
        (_, Module::AiAssistant) => Permission::Read,
        _ => Permission::None,
    }
}

/// Check if a role has at least the required permission for a module.
pub fn check_permission(role: &str, module: &Module, required: Permission) -> bool {
    let actual = get_permission(role, module);
    match required {
        Permission::None => true,
        Permission::Read => actual != Permission::None,
        Permission::Write => matches!(actual, Permission::Write | Permission::Full),
        Permission::Full => actual == Permission::Full,
    }
}
