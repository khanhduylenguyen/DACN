#!/bin/bash
# ============================================
# Medi Path Ease - Complete Setup Script
# ============================================
# Chạy tất cả setup scripts theo thứ tự
# Usage: ./scripts/setup-all.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# FUNCTIONS
# ============================================
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ============================================
# MAIN SETUP
# ============================================
main() {
    echo ""
    echo "============================================"
    echo "  Medi Path Ease - Complete Setup"
    echo "============================================"
    echo ""
    
    # ============================================
    # BƯỚC 1: Setup DocumentDB
    # ============================================
    echo ""
    echo "--------------------------------------------"
    echo -e "${BLUE}BƯỚC 1: Setup DocumentDB${NC}"
    echo "--------------------------------------------"
    
    read -p "Chạy setup DocumentDB? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$(dirname "$0")"
        ./setup-documentdb.sh
    else
        log_warn "Bỏ qua DocumentDB setup"
    fi
    
    # ============================================
    # BƯỚC 2: Setup EC2 Backend
    # ============================================
    echo ""
    echo "--------------------------------------------"
    echo -e "${BLUE}BƯỚC 2: Setup EC2 Backend${NC}"
    echo "--------------------------------------------"
    
    read -p "Chạy setup EC2 Backend? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$(dirname "$0")"
        ./setup-ec2.sh
    else
        log_warn "Bỏ qua EC2 setup"
    fi
    
    # ============================================
    # BƯỚC 3: Setup Frontend S3 + CloudFront
    # ============================================
    echo ""
    echo "--------------------------------------------"
    echo -e "${BLUE}BƯỚC 3: Setup Frontend S3 + CloudFront${NC}"
    echo "--------------------------------------------"
    
    read -p "Chạy setup Frontend? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$(dirname "$0")"
        ./setup-frontend-s3.sh
    else
        log_warn "Bỏ qua Frontend setup"
    fi
    
    # ============================================
    # BƯỚC 4: Setup CI/CD
    # ============================================
    echo ""
    echo "--------------------------------------------"
    echo -e "${BLUE}BƯỚC 4: Setup CI/CD${NC}"
    echo "--------------------------------------------"
    
    log_info "CI/CD workflow đã được tạo tại: .github/workflows/deploy-ec2.yml"
    log_info ""
    log_info "Để kích hoạt CI/CD, cần thêm GitHub Secrets:"
    echo ""
    echo "  1. AWS_ACCESS_KEY_ID"
    echo "  2. AWS_SECRET_ACCESS_KEY"
    echo "  3. EC2_HOST (IP của EC2 instance)"
    echo "  4. EC2_SSH_KEY (private key content)"
    echo "  5. S3_BUCKET_FRONTEND"
    echo "  6. VITE_API_URL"
    echo "  7. CF_DISTRIBUTION_ID"
    echo ""
    echo "  GitHub → Settings → Secrets and Variables → Actions"
    echo ""
    
    # ============================================
    # PRINT FINAL SUMMARY
    # ============================================
    echo ""
    echo "============================================"
    echo -e "${GREEN}SETUP HOÀN TẤT!${NC}"
    echo "============================================"
    echo ""
    echo -e "${BLUE}Các bước tiếp theo:${NC}"
    echo ""
    echo "  1. Cập nhật backend/.env với:"
    echo "     - DocumentDB endpoint (từ Bước 1)"
    echo "     - EC2 IP (từ Bước 2)"
    echo "     - S3 bucket name (từ Bước 3)"
    echo ""
    echo "  2. Thêm GitHub Secrets (cho CI/CD tự động)"
    echo ""
    echo "  3. Push code lên GitHub để trigger deploy"
    echo ""
    echo "============================================"
}

main "$@"
