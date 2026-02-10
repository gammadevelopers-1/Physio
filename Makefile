# ===========================================
# PhysioGuidance - Project Makefile
# ===========================================
# Everything runs in Docker for consistency
# Run 'make help' to see all available commands
# ===========================================

.PHONY: help dev dev-build dev-down dev-logs dev-restart \
        dev-frontend dev-backend dev-db \
        build build-frontend build-backend \
        deploy-frontend deploy-backend deploy-all setup-gcp \
        logs-frontend logs-backend status urls \
        clean clean-docker shell-frontend shell-backend

# Default target
.DEFAULT_GOAL := help

# ===========================================
# Configuration
# ===========================================
DOCKER_COMPOSE := docker-compose
FRONTEND_DIR := frontend
BACKEND_DIR := backends
INFRA_DIR := infra

# Colors
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m

# ===========================================
# Help
# ===========================================
help: ## Show this help message
	@echo ""
	@echo "$(CYAN)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(CYAN)║         PhysioGuidance - Development Commands              ║$(NC)"
	@echo "$(CYAN)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)Local Development (Docker):$(NC)"
	@echo "  $(CYAN)make dev$(NC)              Start all services (frontend + backend + db)"
	@echo "  $(CYAN)make dev-build$(NC)        Rebuild and start all services"
	@echo "  $(CYAN)make dev-down$(NC)         Stop all services"
	@echo "  $(CYAN)make dev-logs$(NC)         View logs from all services"
	@echo "  $(CYAN)make dev-restart$(NC)      Restart all services"
	@echo ""
	@echo "$(GREEN)Individual Services:$(NC)"
	@echo "  $(CYAN)make dev-frontend$(NC)     Start only frontend"
	@echo "  $(CYAN)make dev-backend$(NC)      Start only backend + database"
	@echo "  $(CYAN)make dev-db$(NC)           Start only database"
	@echo ""
	@echo "$(GREEN)Build:$(NC)"
	@echo "  $(CYAN)make build$(NC)            Build production images"
	@echo "  $(CYAN)make build-frontend$(NC)   Build frontend image"
	@echo "  $(CYAN)make build-backend$(NC)    Build backend image"
	@echo ""
	@echo "$(GREEN)GCP Deployment:$(NC)"
	@echo "  $(CYAN)make setup-gcp$(NC)        One-time GCP setup (run first!)"
	@echo "  $(CYAN)make setup-db-prod$(NC)    Create Cloud SQL database"
	@echo "  $(CYAN)make setup-storage$(NC)    Create Cloud Storage buckets"
	@echo "  $(CYAN)make deploy-frontend$(NC)  Deploy frontend to Cloud Run"
	@echo "  $(CYAN)make deploy-backend$(NC)   Deploy backend to Cloud Run"
	@echo "  $(CYAN)make deploy-all$(NC)       Deploy everything"
	@echo "  $(CYAN)make migrate-prod$(NC)     Run migrations on production"
	@echo "  $(CYAN)make status$(NC)           Show deployed services status"
	@echo "  $(CYAN)make urls$(NC)             Show deployed service URLs"
	@echo ""
	@echo "$(GREEN)Secrets (Production):$(NC)"
	@echo "  $(CYAN)make secrets-list$(NC)     List all secrets"
	@echo "  $(CYAN)make secrets-get$(NC)      Get a secret value"
	@echo "  $(CYAN)make secrets-set$(NC)      Set/create a secret"
	@echo ""
	@echo "$(GREEN)Database (Drizzle):$(NC)"
	@echo "  $(CYAN)make db-generate$(NC)      Generate migration from schema changes"
	@echo "  $(CYAN)make db-migrate$(NC)       Apply pending migrations"
	@echo "  $(CYAN)make db-push$(NC)          Push schema directly (dev only)"
	@echo "  $(CYAN)make db-studio$(NC)        Open Drizzle Studio (database GUI)"
	@echo "  $(CYAN)make db-seed$(NC)          Seed database with test data"
	@echo "  $(CYAN)make db-reset$(NC)         Reset database (push + seed)"
	@echo ""
	@echo "$(GREEN)Utilities:$(NC)"
	@echo "  $(CYAN)make shell-frontend$(NC)   Open shell in frontend container"
	@echo "  $(CYAN)make shell-backend$(NC)    Open shell in backend container"
	@echo "  $(CYAN)make shell-db$(NC)         Open PostgreSQL shell"
	@echo "  $(CYAN)make clean$(NC)            Remove build artifacts"
	@echo "  $(CYAN)make clean-docker$(NC)     Remove all Docker resources"
	@echo ""
	@echo "$(YELLOW)URLs when running:$(NC)"
	@echo "  Frontend:  http://localhost:3000"
	@echo "  Backend:   http://localhost:8080"
	@echo "  API Docs:  http://localhost:8080/api"
	@echo "  pgAdmin:   http://localhost:5050 (make dev-db-tools)"
	@echo ""

# ===========================================
# Local Development (Docker)
# ===========================================
dev: ## Start all services (frontend + backend + database)
	@echo "$(CYAN)Starting all services in Docker...$(NC)"
	@$(DOCKER_COMPOSE) up -d
	@echo ""
	@echo "$(GREEN)Services started!$(NC)"
	@echo "  Frontend:  http://localhost:3000"
	@echo "  Backend:   http://localhost:8080"
	@echo "  Database:  localhost:5432"
	@echo ""
	@echo "$(YELLOW)View logs:$(NC) make dev-logs"
	@echo "$(YELLOW)Stop:$(NC)      make dev-down"

dev-build: ## Rebuild and start all services
	@echo "$(CYAN)Rebuilding all services...$(NC)"
	@$(DOCKER_COMPOSE) up -d --build
	@echo "$(GREEN)Services rebuilt and started!$(NC)"

dev-down: ## Stop all services
	@echo "$(CYAN)Stopping all services...$(NC)"
	@$(DOCKER_COMPOSE) down
	@echo "$(GREEN)Services stopped!$(NC)"

dev-logs: ## View logs from all services
	@$(DOCKER_COMPOSE) logs -f

dev-restart: ## Restart all services
	@$(DOCKER_COMPOSE) restart

dev-frontend: ## Start only frontend
	@echo "$(CYAN)Starting frontend...$(NC)"
	@$(DOCKER_COMPOSE) up -d frontend
	@echo "$(GREEN)Frontend running at http://localhost:3000$(NC)"

dev-backend: ## Start backend + database
	@echo "$(CYAN)Starting backend and database...$(NC)"
	@$(DOCKER_COMPOSE) up -d backend database
	@echo "$(GREEN)Backend running at http://localhost:8080$(NC)"

dev-db: ## Start only database
	@echo "$(CYAN)Starting database...$(NC)"
	@$(DOCKER_COMPOSE) up -d database
	@echo "$(GREEN)Database running at localhost:5432$(NC)"

dev-db-tools: ## Start database with pgAdmin
	@echo "$(CYAN)Starting database with pgAdmin...$(NC)"
	@$(DOCKER_COMPOSE) --profile tools up -d database pgadmin
	@echo "$(GREEN)pgAdmin running at http://localhost:5050$(NC)"
	@echo "  Email: admin@physioguidance.org"
	@echo "  Password: admin"

# ===========================================
# Build Production Images
# ===========================================
build: build-frontend build-backend ## Build all production images

build-frontend: ## Build frontend production image
	@echo "$(CYAN)Building frontend production image...$(NC)"
	@cd $(FRONTEND_DIR) && docker build -t physioguidance-web:latest .
	@echo "$(GREEN)Frontend image built!$(NC)"

build-backend: ## Build backend production image
	@echo "$(CYAN)Building backend production image...$(NC)"
	@docker build -f $(INFRA_DIR)/backend/production/Dockerfile -t physioguidance-api:latest $(BACKEND_DIR)
	@echo "$(GREEN)Backend image built!$(NC)"

# ===========================================
# GCP Deployment
# ===========================================
setup-gcp: ## One-time GCP project setup
	@chmod +x $(INFRA_DIR)/scripts/setup-gcp.sh
	@$(INFRA_DIR)/scripts/setup-gcp.sh

setup-db-prod: ## Create Cloud SQL database (production)
	@chmod +x $(INFRA_DIR)/scripts/setup-database.sh
	@$(INFRA_DIR)/scripts/setup-database.sh

migrate-prod: ## Run migrations on production database
	@chmod +x $(INFRA_DIR)/scripts/migrate-production.sh
	@$(INFRA_DIR)/scripts/migrate-production.sh

setup-storage: ## Create Cloud Storage buckets (production)
	@chmod +x $(INFRA_DIR)/scripts/setup-storage.sh
	@$(INFRA_DIR)/scripts/setup-storage.sh

secrets-list: ## List all production secrets
	@chmod +x $(INFRA_DIR)/scripts/manage-secrets.sh
	@$(INFRA_DIR)/scripts/manage-secrets.sh list

secrets-get: ## Get a secret (usage: make secrets-get SECRET=name)
	@chmod +x $(INFRA_DIR)/scripts/manage-secrets.sh
	@$(INFRA_DIR)/scripts/manage-secrets.sh get $(SECRET)

secrets-set: ## Set a secret (usage: make secrets-set SECRET=name)
	@chmod +x $(INFRA_DIR)/scripts/manage-secrets.sh
	@$(INFRA_DIR)/scripts/manage-secrets.sh set $(SECRET)

deploy-frontend: ## Deploy frontend to Cloud Run
	@chmod +x $(INFRA_DIR)/frontend/deploy.sh
	@$(INFRA_DIR)/frontend/deploy.sh

deploy-backend: ## Deploy backend to Cloud Run
	@chmod +x $(INFRA_DIR)/backend/deploy.sh
	@$(INFRA_DIR)/backend/deploy.sh

deploy-strapi: ## Deploy Strapi CMS to Cloud Run
	@chmod +x $(INFRA_DIR)/strapi/deploy.sh
	@$(INFRA_DIR)/strapi/deploy.sh

deploy-all: ## Deploy all services (backend + strapi + frontend)
	@echo "$(CYAN)Deploying all services to GCP...$(NC)"
	@make deploy-backend
	@make deploy-strapi
	@make deploy-frontend
	@echo "$(GREEN)All services deployed!$(NC)"

# ===========================================
# GCP Utilities
# ===========================================
logs-frontend: ## View frontend Cloud Run logs
	@gcloud run services logs read physioguidance-web --region=us-central1 --limit=50

logs-backend: ## View backend Cloud Run logs
	@gcloud run services logs read physioguidance-api --region=us-central1 --limit=50

status: ## Show status of deployed Cloud Run services
	@echo "$(CYAN)Cloud Run Services$(NC)"
	@echo "=================="
	@gcloud run services list --region=us-central1 2>/dev/null || echo "$(RED)Not authenticated or no services deployed$(NC)"

urls: ## Show deployed service URLs
	@echo "$(CYAN)Deployed URLs$(NC)"
	@echo "============="
	@echo "Frontend: $$(gcloud run services describe physioguidance-web --region=us-central1 --format='value(status.url)' 2>/dev/null || echo 'Not deployed')"
	@echo "Backend:  $$(gcloud run services describe physioguidance-api --region=us-central1 --format='value(status.url)' 2>/dev/null || echo 'Not deployed')"

# ===========================================
# Utilities
# ===========================================
shell-frontend: ## Open shell in frontend container
	@docker exec -it physio-frontend sh

shell-backend: ## Open shell in backend container
	@docker exec -it physio-backend sh

shell-db: ## Open psql in database container
	@docker exec -it physio-database psql -U postgres -d physioguidance

clean: ## Remove build artifacts
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@rm -rf $(FRONTEND_DIR)/.next
	@rm -rf $(BACKEND_DIR)/dist
	@echo "$(GREEN)Cleaned!$(NC)"

clean-docker: ## Remove all Docker resources (containers, volumes, images)
	@echo "$(YELLOW)Removing Docker resources...$(NC)"
	@$(DOCKER_COMPOSE) down -v --rmi local 2>/dev/null || true
	@echo "$(GREEN)Docker resources removed!$(NC)"

# ===========================================
# Database (Drizzle ORM)
# ===========================================
db-generate: ## Generate migration from schema changes
	@echo "$(CYAN)Generating migration...$(NC)"
	@docker exec physio-backend npm run db:generate
	@echo "$(GREEN)Migration generated! Check backends/src/database/migrations$(NC)"

db-migrate: ## Apply pending migrations
	@echo "$(CYAN)Applying migrations...$(NC)"
	@docker exec physio-backend npm run db:migrate
	@echo "$(GREEN)Migrations applied!$(NC)"

db-push: ## Push schema directly (dev only, no migration file)
	@echo "$(CYAN)Pushing schema to database...$(NC)"
	@docker exec physio-backend npm run db:push
	@echo "$(GREEN)Schema pushed!$(NC)"

db-studio: ## Open Drizzle Studio (database GUI)
	@echo "$(CYAN)Opening Drizzle Studio...$(NC)"
	@echo "$(YELLOW)Visit: https://local.drizzle.studio$(NC)"
	@cd $(BACKEND_DIR) && npm run db:studio

db-seed: ## Seed database with test data
	@echo "$(CYAN)Seeding database...$(NC)"
	@docker exec physio-backend npm run db:seed
	@echo "$(GREEN)Database seeded!$(NC)"

db-reset: ## Reset database (push schema + seed)
	@echo "$(YELLOW)Resetting database...$(NC)"
	@docker exec physio-backend npm run db:reset
	@echo "$(GREEN)Database reset!$(NC)"

# ===========================================
# Quick shortcuts
# ===========================================
up: dev ## Alias for 'make dev'
down: dev-down ## Alias for 'make dev-down'
logs: dev-logs ## Alias for 'make dev-logs'
restart: dev-restart ## Alias for 'make dev-restart'
