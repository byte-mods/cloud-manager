use uuid::Uuid;

use crate::models::tutorial::{
    Difficulty, LearningPath, QuizQuestion, StepType, Tutorial, TutorialStep, TutorialSummary,
};

/// Returns all predefined learning paths for the five roles.
pub fn get_all_learning_paths() -> Vec<LearningPath> {
    vec![
        devops_engineer_path(),
        cloud_architect_path(),
        security_engineer_path(),
        platform_engineer_path(),
        sre_path(),
    ]
}

/// Returns a learning path for a specific role, if it exists.
pub fn get_learning_path_by_role(role: &str) -> Option<LearningPath> {
    get_all_learning_paths()
        .into_iter()
        .find(|p| p.role.eq_ignore_ascii_case(role))
}

/// Returns all tutorials across all learning paths.
pub fn get_all_tutorials() -> Vec<Tutorial> {
    vec![
        // DevOps tutorials
        intro_to_terraform(),
        cicd_pipelines(),
        container_orchestration(),
        // Cloud Architect tutorials
        multi_cloud_architecture(),
        cost_optimization_strategies(),
        high_availability_design(),
        // Security tutorials
        iam_best_practices(),
        cloud_security_posture(),
        secrets_management(),
        // Platform Engineer tutorials
        kubernetes_platform(),
        service_mesh_setup(),
        observability_stack(),
        // SRE tutorials
        incident_response(),
        slo_sli_design(),
        chaos_engineering(),
    ]
}

/// Returns a single tutorial by its ID.
pub fn get_tutorial_by_id(id: Uuid) -> Option<Tutorial> {
    get_all_tutorials().into_iter().find(|t| t.id == id)
}

// ── DevOps Engineer Path ────────────────────────────────────────────────

fn devops_engineer_path() -> LearningPath {
    LearningPath {
        role: "devops-engineer".to_string(),
        title: "DevOps Engineer Learning Path".to_string(),
        description: "Master CI/CD, Infrastructure as Code, and cloud automation.".to_string(),
        tutorials: vec![
            TutorialSummary {
                id: Uuid::parse_str("10000000-0000-0000-0000-000000000001").unwrap(),
                title: "Introduction to Terraform".to_string(),
                difficulty: Difficulty::Beginner,
                duration_minutes: 45,
            },
            TutorialSummary {
                id: Uuid::parse_str("10000000-0000-0000-0000-000000000002").unwrap(),
                title: "CI/CD Pipelines with GitHub Actions".to_string(),
                difficulty: Difficulty::Intermediate,
                duration_minutes: 60,
            },
            TutorialSummary {
                id: Uuid::parse_str("10000000-0000-0000-0000-000000000003").unwrap(),
                title: "Container Orchestration with Kubernetes".to_string(),
                difficulty: Difficulty::Advanced,
                duration_minutes: 90,
            },
        ],
    }
}

fn cloud_architect_path() -> LearningPath {
    LearningPath {
        role: "cloud-architect".to_string(),
        title: "Cloud Architect Learning Path".to_string(),
        description: "Design scalable, resilient, and cost-effective multi-cloud architectures."
            .to_string(),
        tutorials: vec![
            TutorialSummary {
                id: Uuid::parse_str("20000000-0000-0000-0000-000000000001").unwrap(),
                title: "Multi-Cloud Architecture Patterns".to_string(),
                difficulty: Difficulty::Intermediate,
                duration_minutes: 75,
            },
            TutorialSummary {
                id: Uuid::parse_str("20000000-0000-0000-0000-000000000002").unwrap(),
                title: "Cost Optimization Strategies".to_string(),
                difficulty: Difficulty::Intermediate,
                duration_minutes: 60,
            },
            TutorialSummary {
                id: Uuid::parse_str("20000000-0000-0000-0000-000000000003").unwrap(),
                title: "High Availability Design".to_string(),
                difficulty: Difficulty::Advanced,
                duration_minutes: 90,
            },
        ],
    }
}

fn security_engineer_path() -> LearningPath {
    LearningPath {
        role: "security-engineer".to_string(),
        title: "Security Engineer Learning Path".to_string(),
        description: "Secure cloud infrastructure with IAM, compliance, and threat detection."
            .to_string(),
        tutorials: vec![
            TutorialSummary {
                id: Uuid::parse_str("30000000-0000-0000-0000-000000000001").unwrap(),
                title: "IAM Best Practices".to_string(),
                difficulty: Difficulty::Beginner,
                duration_minutes: 45,
            },
            TutorialSummary {
                id: Uuid::parse_str("30000000-0000-0000-0000-000000000002").unwrap(),
                title: "Cloud Security Posture Management".to_string(),
                difficulty: Difficulty::Intermediate,
                duration_minutes: 60,
            },
            TutorialSummary {
                id: Uuid::parse_str("30000000-0000-0000-0000-000000000003").unwrap(),
                title: "Secrets Management".to_string(),
                difficulty: Difficulty::Intermediate,
                duration_minutes: 50,
            },
        ],
    }
}

fn platform_engineer_path() -> LearningPath {
    LearningPath {
        role: "platform-engineer".to_string(),
        title: "Platform Engineer Learning Path".to_string(),
        description:
            "Build internal developer platforms with Kubernetes, service meshes, and observability."
                .to_string(),
        tutorials: vec![
            TutorialSummary {
                id: Uuid::parse_str("40000000-0000-0000-0000-000000000001").unwrap(),
                title: "Building a Kubernetes Platform".to_string(),
                difficulty: Difficulty::Advanced,
                duration_minutes: 90,
            },
            TutorialSummary {
                id: Uuid::parse_str("40000000-0000-0000-0000-000000000002").unwrap(),
                title: "Service Mesh with Istio".to_string(),
                difficulty: Difficulty::Advanced,
                duration_minutes: 75,
            },
            TutorialSummary {
                id: Uuid::parse_str("40000000-0000-0000-0000-000000000003").unwrap(),
                title: "Observability Stack Setup".to_string(),
                difficulty: Difficulty::Intermediate,
                duration_minutes: 60,
            },
        ],
    }
}

fn sre_path() -> LearningPath {
    LearningPath {
        role: "sre".to_string(),
        title: "Site Reliability Engineer Learning Path".to_string(),
        description:
            "Master incident response, SLO/SLI design, and chaos engineering for reliability."
                .to_string(),
        tutorials: vec![
            TutorialSummary {
                id: Uuid::parse_str("50000000-0000-0000-0000-000000000001").unwrap(),
                title: "Incident Response Procedures".to_string(),
                difficulty: Difficulty::Intermediate,
                duration_minutes: 60,
            },
            TutorialSummary {
                id: Uuid::parse_str("50000000-0000-0000-0000-000000000002").unwrap(),
                title: "SLO and SLI Design".to_string(),
                difficulty: Difficulty::Intermediate,
                duration_minutes: 45,
            },
            TutorialSummary {
                id: Uuid::parse_str("50000000-0000-0000-0000-000000000003").unwrap(),
                title: "Chaos Engineering Fundamentals".to_string(),
                difficulty: Difficulty::Advanced,
                duration_minutes: 75,
            },
        ],
    }
}

// ── Tutorial Definitions ────────────────────────────────────────────────

fn intro_to_terraform() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("10000000-0000-0000-0000-000000000001").unwrap(),
        title: "Introduction to Terraform".to_string(),
        description: "Learn the fundamentals of Terraform for infrastructure provisioning."
            .to_string(),
        difficulty: Difficulty::Beginner,
        duration_minutes: 45,
        provider: None,
        tags: vec!["terraform".into(), "iac".into(), "devops".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("11000000-0000-0000-0000-000000000001").unwrap(),
                title: "What is Infrastructure as Code?".to_string(),
                content: "Infrastructure as Code (IaC) is the practice of managing infrastructure \
                    through machine-readable configuration files rather than manual processes. \
                    Terraform by HashiCorp is one of the most popular IaC tools.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
            TutorialStep {
                id: Uuid::parse_str("11000000-0000-0000-0000-000000000002").unwrap(),
                title: "Your First Terraform Configuration".to_string(),
                content: r#"Create a `main.tf` file:

```hcl
provider "aws" {
  region = "us-west-2"
}

resource "aws_instance" "example" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name = "HelloWorld"
  }
}
```

Run `terraform init` followed by `terraform plan`."#.to_string(),
                step_type: StepType::CodeExample,
                order: 2,
                quiz: None,
            },
            TutorialStep {
                id: Uuid::parse_str("11000000-0000-0000-0000-000000000003").unwrap(),
                title: "Hands-On: Deploy an EC2 Instance".to_string(),
                content: "Using the sandbox environment, deploy your first EC2 instance with Terraform.".to_string(),
                step_type: StepType::HandsOn,
                order: 3,
                quiz: None,
            },
            TutorialStep {
                id: Uuid::parse_str("11000000-0000-0000-0000-000000000004").unwrap(),
                title: "Knowledge Check".to_string(),
                content: "Test your understanding of Terraform basics.".to_string(),
                step_type: StepType::Quiz,
                order: 4,
                quiz: Some(QuizQuestion {
                    question: "What command initializes a Terraform working directory?".to_string(),
                    options: vec![
                        "terraform start".into(),
                        "terraform init".into(),
                        "terraform begin".into(),
                        "terraform setup".into(),
                    ],
                    correct_index: 1,
                    explanation: "`terraform init` downloads providers and initializes the backend.".to_string(),
                }),
            },
        ],
    }
}

fn cicd_pipelines() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("10000000-0000-0000-0000-000000000002").unwrap(),
        title: "CI/CD Pipelines with GitHub Actions".to_string(),
        description: "Build automated CI/CD pipelines for cloud deployments.".to_string(),
        difficulty: Difficulty::Intermediate,
        duration_minutes: 60,
        provider: None,
        tags: vec!["cicd".into(), "github-actions".into(), "automation".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("12000000-0000-0000-0000-000000000001").unwrap(),
                title: "CI/CD Concepts".to_string(),
                content: "Continuous Integration and Continuous Deployment automate the build, test, \
                    and deployment process for your infrastructure and applications.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
            TutorialStep {
                id: Uuid::parse_str("12000000-0000-0000-0000-000000000002").unwrap(),
                title: "GitHub Actions Workflow".to_string(),
                content: r#"Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Infrastructure
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
      - run: terraform init
      - run: terraform plan
      - run: terraform apply -auto-approve
```"#.to_string(),
                step_type: StepType::CodeExample,
                order: 2,
                quiz: None,
            },
        ],
    }
}

fn container_orchestration() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("10000000-0000-0000-0000-000000000003").unwrap(),
        title: "Container Orchestration with Kubernetes".to_string(),
        description: "Deploy and manage containerized applications with Kubernetes.".to_string(),
        difficulty: Difficulty::Advanced,
        duration_minutes: 90,
        provider: None,
        tags: vec!["kubernetes".into(), "containers".into(), "orchestration".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("13000000-0000-0000-0000-000000000001").unwrap(),
                title: "Kubernetes Architecture".to_string(),
                content: "Kubernetes (K8s) is a container orchestration platform with control plane \
                    components (API server, etcd, scheduler, controller manager) and worker nodes.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
            TutorialStep {
                id: Uuid::parse_str("13000000-0000-0000-0000-000000000002").unwrap(),
                title: "Deploying Your First Pod".to_string(),
                content: r#"```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    ports:
    - containerPort: 80
```"#.to_string(),
                step_type: StepType::CodeExample,
                order: 2,
                quiz: None,
            },
        ],
    }
}

fn multi_cloud_architecture() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("20000000-0000-0000-0000-000000000001").unwrap(),
        title: "Multi-Cloud Architecture Patterns".to_string(),
        description: "Design architectures that span AWS, GCP, and Azure.".to_string(),
        difficulty: Difficulty::Intermediate,
        duration_minutes: 75,
        provider: None,
        tags: vec!["architecture".into(), "multi-cloud".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("21000000-0000-0000-0000-000000000001").unwrap(),
                title: "Why Multi-Cloud?".to_string(),
                content: "Multi-cloud strategies provide vendor independence, best-of-breed services, \
                    geographic reach, and resilience against provider outages.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
        ],
    }
}

fn cost_optimization_strategies() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("20000000-0000-0000-0000-000000000002").unwrap(),
        title: "Cost Optimization Strategies".to_string(),
        description: "Reduce cloud spend through rightsizing, reservations, and architecture changes.".to_string(),
        difficulty: Difficulty::Intermediate,
        duration_minutes: 60,
        provider: None,
        tags: vec!["cost".into(), "optimization".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("22000000-0000-0000-0000-000000000001").unwrap(),
                title: "Cloud Cost Fundamentals".to_string(),
                content: "Understanding cloud billing models: on-demand, reserved, spot/preemptible, \
                    and committed use discounts.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
        ],
    }
}

fn high_availability_design() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("20000000-0000-0000-0000-000000000003").unwrap(),
        title: "High Availability Design".to_string(),
        description: "Design systems for 99.99% uptime across cloud providers.".to_string(),
        difficulty: Difficulty::Advanced,
        duration_minutes: 90,
        provider: None,
        tags: vec!["ha".into(), "reliability".into(), "architecture".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("23000000-0000-0000-0000-000000000001").unwrap(),
                title: "HA Fundamentals".to_string(),
                content: "High availability is achieved through redundancy, failover, load balancing, \
                    and multi-region deployment.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
        ],
    }
}

fn iam_best_practices() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("30000000-0000-0000-0000-000000000001").unwrap(),
        title: "IAM Best Practices".to_string(),
        description: "Implement least-privilege IAM policies across cloud providers.".to_string(),
        difficulty: Difficulty::Beginner,
        duration_minutes: 45,
        provider: None,
        tags: vec!["iam".into(), "security".into(), "least-privilege".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("31000000-0000-0000-0000-000000000001").unwrap(),
                title: "Principle of Least Privilege".to_string(),
                content: "Grant only the minimum permissions needed. Start with zero access and add \
                    permissions as required.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
        ],
    }
}

fn cloud_security_posture() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("30000000-0000-0000-0000-000000000002").unwrap(),
        title: "Cloud Security Posture Management".to_string(),
        description: "Continuously monitor and remediate security misconfigurations.".to_string(),
        difficulty: Difficulty::Intermediate,
        duration_minutes: 60,
        provider: None,
        tags: vec!["cspm".into(), "security".into(), "compliance".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("32000000-0000-0000-0000-000000000001").unwrap(),
                title: "What is CSPM?".to_string(),
                content: "Cloud Security Posture Management continuously assesses cloud environments \
                    against security benchmarks and compliance frameworks.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
        ],
    }
}

fn secrets_management() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("30000000-0000-0000-0000-000000000003").unwrap(),
        title: "Secrets Management".to_string(),
        description: "Securely store and rotate secrets using cloud-native vaults.".to_string(),
        difficulty: Difficulty::Intermediate,
        duration_minutes: 50,
        provider: None,
        tags: vec!["secrets".into(), "vault".into(), "security".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("33000000-0000-0000-0000-000000000001").unwrap(),
                title: "Secrets Management Overview".to_string(),
                content: "Never hard-code secrets. Use AWS Secrets Manager, GCP Secret Manager, \
                    Azure Key Vault, or HashiCorp Vault.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
        ],
    }
}

fn kubernetes_platform() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("40000000-0000-0000-0000-000000000001").unwrap(),
        title: "Building a Kubernetes Platform".to_string(),
        description: "Create an internal developer platform on Kubernetes.".to_string(),
        difficulty: Difficulty::Advanced,
        duration_minutes: 90,
        provider: None,
        tags: vec!["kubernetes".into(), "platform".into(), "idp".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("41000000-0000-0000-0000-000000000001").unwrap(),
                title: "Platform Engineering Principles".to_string(),
                content: "An Internal Developer Platform (IDP) provides self-service infrastructure \
                    with guardrails, reducing cognitive load for developers.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
        ],
    }
}

fn service_mesh_setup() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("40000000-0000-0000-0000-000000000002").unwrap(),
        title: "Service Mesh with Istio".to_string(),
        description: "Configure Istio for traffic management, security, and observability.".to_string(),
        difficulty: Difficulty::Advanced,
        duration_minutes: 75,
        provider: None,
        tags: vec!["istio".into(), "service-mesh".into(), "networking".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("42000000-0000-0000-0000-000000000001").unwrap(),
                title: "Service Mesh Concepts".to_string(),
                content: "A service mesh provides infrastructure-level networking features like \
                    mTLS, traffic splitting, retries, and circuit breaking.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
        ],
    }
}

fn observability_stack() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("40000000-0000-0000-0000-000000000003").unwrap(),
        title: "Observability Stack Setup".to_string(),
        description: "Set up Prometheus, Grafana, and Loki for full-stack observability.".to_string(),
        difficulty: Difficulty::Intermediate,
        duration_minutes: 60,
        provider: None,
        tags: vec!["observability".into(), "prometheus".into(), "grafana".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("43000000-0000-0000-0000-000000000001").unwrap(),
                title: "Three Pillars of Observability".to_string(),
                content: "Metrics, logs, and traces form the three pillars of observability. \
                    Each provides a different lens into system behavior.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
        ],
    }
}

fn incident_response() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("50000000-0000-0000-0000-000000000001").unwrap(),
        title: "Incident Response Procedures".to_string(),
        description: "Establish effective incident response workflows.".to_string(),
        difficulty: Difficulty::Intermediate,
        duration_minutes: 60,
        provider: None,
        tags: vec!["incident-response".into(), "sre".into(), "runbooks".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("51000000-0000-0000-0000-000000000001").unwrap(),
                title: "Incident Response Lifecycle".to_string(),
                content: "Detection, triage, mitigation, resolution, and post-mortem form the \
                    incident response lifecycle.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
        ],
    }
}

fn slo_sli_design() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("50000000-0000-0000-0000-000000000002").unwrap(),
        title: "SLO and SLI Design".to_string(),
        description: "Define meaningful SLOs and SLIs for your services.".to_string(),
        difficulty: Difficulty::Intermediate,
        duration_minutes: 45,
        provider: None,
        tags: vec!["slo".into(), "sli".into(), "reliability".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("52000000-0000-0000-0000-000000000001").unwrap(),
                title: "SLI, SLO, and SLA".to_string(),
                content: "SLIs measure service behavior, SLOs set targets for those indicators, \
                    and SLAs are contractual commitments based on SLOs.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
        ],
    }
}

fn chaos_engineering() -> Tutorial {
    Tutorial {
        id: Uuid::parse_str("50000000-0000-0000-0000-000000000003").unwrap(),
        title: "Chaos Engineering Fundamentals".to_string(),
        description: "Proactively test system resilience with controlled experiments.".to_string(),
        difficulty: Difficulty::Advanced,
        duration_minutes: 75,
        provider: None,
        tags: vec!["chaos".into(), "resilience".into(), "testing".into()],
        steps: vec![
            TutorialStep {
                id: Uuid::parse_str("53000000-0000-0000-0000-000000000001").unwrap(),
                title: "Principles of Chaos Engineering".to_string(),
                content: "Chaos engineering introduces controlled failures to discover system \
                    weaknesses before they cause real outages.".to_string(),
                step_type: StepType::Content,
                order: 1,
                quiz: None,
            },
        ],
    }
}
