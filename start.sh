#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Cloud Manager — Full Stack Startup Script
# ============================================================================
# Usage:
#   ./start.sh              # Start everything (infra + backend + frontend)
#   ./start.sh frontend     # Frontend only (quickest)
#   ./start.sh backend      # Backend services only
#   ./start.sh infra        # Docker infrastructure only
#   ./start.sh stop         # Stop everything
# ============================================================================

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICES_DIR="$ROOT_DIR/services"
FRONTEND_DIR="$ROOT_DIR/apps/web"
ENV_FILE="$ROOT_DIR/.env.cloud"
PIDS_FILE="$ROOT_DIR/.service-pids"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1"; }
info() { echo -e "${CYAN}[i]${NC} $1"; }
header() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

# ============================================================================
# Prerequisites Check
# ============================================================================
check_prerequisites() {
    header "Checking Prerequisites"

    local missing=0

    if ! command -v docker &>/dev/null; then
        error "Docker is not installed. Install from https://docs.docker.com/get-docker/"
        missing=1
    else
        log "Docker: $(docker --version | head -1)"
    fi

    if ! command -v cargo &>/dev/null; then
        error "Rust/Cargo is not installed. Install from https://rustup.rs/"
        missing=1
    else
        log "Cargo: $(cargo --version)"
    fi

    if ! command -v node &>/dev/null; then
        error "Node.js is not installed. Install from https://nodejs.org/"
        missing=1
    else
        log "Node: $(node --version)"
    fi

    if ! command -v npx &>/dev/null; then
        error "npx not found. Install Node.js 18+"
        missing=1
    fi

    if [ $missing -eq 1 ]; then
        error "Missing prerequisites. Please install them and try again."
        exit 1
    fi

    log "All prerequisites met"
}

# ============================================================================
# Docker Infrastructure
# ============================================================================
start_infra() {
    header "Starting Docker Infrastructure"

    cd "$ROOT_DIR"

    # Check if Docker daemon is running
    if ! docker info &>/dev/null; then
        error "Docker daemon is not running. Please start Docker Desktop."
        exit 1
    fi

    # Start only Redis + PostgreSQL (minimum required)
    log "Starting PostgreSQL + Redis..."
    docker compose up -d postgres redis

    # Wait for services to be healthy
    log "Waiting for PostgreSQL to be ready..."
    for i in $(seq 1 30); do
        if docker exec cloud_manager_postgres pg_isready -U cloud_manager &>/dev/null; then
            log "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "PostgreSQL failed to start within 30 seconds"
            exit 1
        fi
        sleep 1
    done

    log "Waiting for Redis to be ready..."
    for i in $(seq 1 15); do
        if docker exec cloud_manager_redis redis-cli ping 2>/dev/null | grep -q PONG; then
            log "Redis is ready"
            break
        fi
        if [ $i -eq 15 ]; then
            error "Redis failed to start within 15 seconds"
            exit 1
        fi
        sleep 1
    done

    log "Infrastructure is up"
}

# ============================================================================
# Database Migrations
# ============================================================================
run_migrations() {
    header "Running Database Migrations"

    if [ -f "$SERVICES_DIR/migrations/run.sh" ]; then
        cd "$SERVICES_DIR/migrations"
        bash run.sh 2>/dev/null && log "Migrations complete" || warn "Migrations may have already been applied"
    else
        warn "No migration script found, skipping"
    fi
}

# ============================================================================
# Cloud Credentials (from .env.cloud or environment)
# ============================================================================
load_cloud_credentials() {
    header "Loading Cloud Credentials"

    # Create .env.cloud if it doesn't exist
    if [ ! -f "$ENV_FILE" ]; then
        warn "No .env.cloud file found. Creating template..."
        cat > "$ENV_FILE" << 'ENVEOF'
# ============================================================================
# Cloud Manager — Cloud Provider Credentials
# ============================================================================
# Set CLOUD_USE_MOCK_DATA=false to use real cloud APIs.
# Default is true (mock mode) — no credentials needed.
# ============================================================================

CLOUD_USE_MOCK_DATA=true

# --- AWS Credentials ---
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_DEFAULT_REGION=us-east-1

# --- GCP Credentials ---
# GCP_PROJECT_ID=
# GOOGLE_APPLICATION_CREDENTIALS=

# --- Azure Credentials ---
# AZURE_SUBSCRIPTION_ID=
# AZURE_TENANT_ID=
# AZURE_CLIENT_ID=
# AZURE_CLIENT_SECRET=

# --- Redis ---
REDIS_URL=redis://127.0.0.1:6379
ENVEOF
        log "Created $ENV_FILE — edit it to add your cloud credentials"
    fi

    # Source the env file
    set -a
    source "$ENV_FILE"
    set +a

    if [ "${CLOUD_USE_MOCK_DATA:-true}" = "false" ]; then
        info "Real SDK mode — checking credentials..."
        local found=0
        [ -n "${AWS_ACCESS_KEY_ID:-}" ] && log "AWS credentials found" && found=$((found+1))
        [ -n "${GCP_PROJECT_ID:-}" ] && log "GCP project configured: $GCP_PROJECT_ID" && found=$((found+1))
        [ -n "${AZURE_SUBSCRIPTION_ID:-}" ] && log "Azure subscription configured" && found=$((found+1))

        if [ $found -eq 0 ]; then
            warn "No cloud credentials found. Services will fall back to mock data."
            warn "Edit $ENV_FILE or add credentials from the UI at Settings > Cloud Accounts"
        fi
    else
        info "Mock mode enabled (CLOUD_USE_MOCK_DATA=true)"
        info "To use real cloud APIs, set CLOUD_USE_MOCK_DATA=false in $ENV_FILE"
        info "Or add credentials from the UI at Settings > Cloud Accounts"
    fi
}

# ============================================================================
# Build Backend
# ============================================================================
build_backend() {
    header "Building Rust Backend"

    cd "$SERVICES_DIR"
    log "Compiling all services (this may take a few minutes on first run)..."
    cargo build --release 2>&1 | tail -5

    log "Backend build complete"
}

# ============================================================================
# Start Backend Services
# ============================================================================
start_backend() {
    header "Starting Backend Services"

    cd "$SERVICES_DIR"

    # Kill any existing services
    if [ -f "$PIDS_FILE" ]; then
        warn "Stopping existing services..."
        while read -r pid; do
            kill "$pid" 2>/dev/null || true
        done < "$PIDS_FILE"
        rm -f "$PIDS_FILE"
    fi

    local target="$SERVICES_DIR/target/release"

    # Check if release binaries exist
    if [ ! -f "$target/gateway" ]; then
        warn "Release binaries not found, building..."
        build_backend
    fi

    # Start each service
    declare -A services=(
        ["gateway"]="8080"
        ["auth-service"]="8081"
        ["cloud-service"]="8082"
        ["security-service"]="8083"
        ["claude-ai-service"]="8084"
        ["tutorial-service"]="8085"
        ["cost-service"]="8086"
        ["monitoring-service"]="8087"
        ["analytics-service"]="8088"
        ["data-engineering-service"]="8089"
    )

    mkdir -p "$ROOT_DIR/logs"
    > "$PIDS_FILE"

    for service in gateway auth-service cloud-service security-service claude-ai-service tutorial-service cost-service monitoring-service analytics-service data-engineering-service; do
        local port="${services[$service]}"
        local binary="$target/$service"

        if [ ! -f "$binary" ]; then
            warn "Binary not found for $service, skipping"
            continue
        fi

        log "Starting $service on port $port..."
        "$binary" > "$ROOT_DIR/logs/$service.log" 2>&1 &
        local pid=$!
        echo "$pid" >> "$PIDS_FILE"
        sleep 0.3
    done

    # Verify services started
    sleep 2
    local running=0
    for service in gateway auth-service cloud-service security-service cost-service monitoring-service analytics-service data-engineering-service; do
        local port="${services[$service]}"
        if curl -sf "http://localhost:$port/health" &>/dev/null; then
            log "$service is healthy (port $port)"
            running=$((running+1))
        else
            warn "$service may still be starting (port $port)"
        fi
    done

    info "$running services confirmed healthy. Logs in $ROOT_DIR/logs/"
}

# ============================================================================
# Start Frontend
# ============================================================================
start_frontend() {
    header "Starting Frontend"

    cd "$FRONTEND_DIR"

    # Install deps if needed
    if [ ! -d "node_modules" ]; then
        log "Installing frontend dependencies..."
        npm install --silent 2>&1 | tail -3
    fi

    log "Starting Next.js dev server on http://localhost:3000"
    info "Login: admin@cloudmanager.dev / admin123"
    info "Settings > Cloud Accounts to add cloud provider credentials"
    echo ""

    npx next dev
}

# ============================================================================
# Stop Everything
# ============================================================================
stop_all() {
    header "Stopping Cloud Manager"

    # Stop backend services
    if [ -f "$PIDS_FILE" ]; then
        log "Stopping backend services..."
        while read -r pid; do
            kill "$pid" 2>/dev/null || true
        done < "$PIDS_FILE"
        rm -f "$PIDS_FILE"
        log "Backend services stopped"
    fi

    # Stop Docker
    cd "$ROOT_DIR"
    log "Stopping Docker containers..."
    docker compose down 2>/dev/null || true

    log "Everything stopped"
}

# ============================================================================
# Main
# ============================================================================
main() {
    echo ""
    echo -e "${CYAN}  _____ _                 _   __  __"
    echo -e " / ____| |               | | |  \/  |"
    echo -e "| |    | | ___  _   _  __| | | \  / | __ _ _ __   __ _  __ _  ___ _ __"
    echo -e "| |    | |/ _ \| | | |/ _\` | | |\/| |/ _\` | '_ \ / _\` |/ _\` |/ _ \ '__|"
    echo -e "| |____| | (_) | |_| | (_| | | |  | | (_| | | | | (_| | (_| |  __/ |"
    echo -e " \_____|_|\___/ \__,_|\__,_| |_|  |_|\__,_|_| |_|\__,_|\__, |\___|_|"
    echo -e "                                                         __/ |"
    echo -e "                                                        |___/${NC}"
    echo ""

    local mode="${1:-all}"

    case "$mode" in
        frontend)
            check_prerequisites
            start_frontend
            ;;
        backend)
            check_prerequisites
            load_cloud_credentials
            build_backend
            start_backend
            ;;
        infra)
            check_prerequisites
            start_infra
            run_migrations
            ;;
        stop)
            stop_all
            ;;
        all|*)
            check_prerequisites
            start_infra
            run_migrations
            load_cloud_credentials
            build_backend
            start_backend
            start_frontend
            ;;
    esac
}

main "$@"
