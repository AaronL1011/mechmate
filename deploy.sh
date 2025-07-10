#!/bin/bash

# Mechmate Self-Hosted Docker Deployment Script
# Simple deployment assuming Docker is already installed

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first:"
        echo "  https://docs.docker.com/engine/install/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first:"
        echo "  https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    print_success "Docker and Docker Compose are available"
}

# Check if port is available
check_port() {
    local port=${1:-3000}
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        print_warning "Port $port is already in use. You may need to stop other services or change the port in .env"
    fi
}

# Create environment file if it doesn't exist
setup_environment() {
    if [[ ! -f .env ]]; then
        print_info "Creating .env file from template..."
        cp .env.example .env
        print_success "Created .env file. You can customize it before starting."
    else
        print_info "Using existing .env file"
    fi
}

# Build and start services
start_services() {
    print_info "Building and starting Mechmate..."
    
    # Use docker compose (new) or docker-compose (legacy) 
    if docker compose version &> /dev/null; then
        docker compose up -d --build
    else
        docker-compose up -d --build
    fi
    
    print_success "Mechmate is starting up..."
}

# Check service health
check_health() {
    print_info "Waiting for services to be healthy..."
    
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "mechmate.*healthy"; then
            print_success "Mechmate is healthy and ready!"
            return 0
        fi
        
        ((attempt++))
        echo -n "."
        sleep 2
    done
    
    print_warning "Health check timeout. Mechmate may still be starting up."
    print_info "Check logs with: docker-compose logs -f mechmate"
}

# Show completion info
show_completion() {
    local ip=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
    local port=$(grep "^PORT=" .env 2>/dev/null | cut -d'=' -f2 || echo "3000")
    
    echo
    echo "======================================"
    echo -e "${GREEN}🔧 Mechmate is now running!${NC}"
    echo "======================================"
    echo
    echo "🌐 Access at: http://$ip:$port"
    echo "📊 Health check: http://$ip:$port/health"
    echo
    echo "🔧 Useful commands:"
    echo "  View logs:    docker-compose logs -f mechmate"
    echo "  Stop:         docker-compose down"
    echo "  Restart:      docker-compose restart mechmate"
    echo "  Update:       docker-compose pull && docker-compose up -d"
    echo
    echo "⚙️  Configuration:"
    echo "  Edit .env file and restart to change settings"
    echo "  Enable AI: Set OPENAI_API_KEY in .env"
    echo "  Enable notifications: Set VAPID keys in .env"
    echo
    echo "📚 Documentation: See DEPLOYMENT.md for advanced configuration"
    echo
}

# Main deployment function
main() {
    echo "======================================"
    echo -e "${BLUE}🔧 Mechmate Self-Hosted Deployment${NC}"
    echo "======================================"
    echo
    
    check_docker
    check_port
    setup_environment
    start_services
    check_health
    show_completion
}

# Run deployment
main "$@"