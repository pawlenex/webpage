# ============================================================
# PawLenx — Multi-stage Docker Build
# Stage 1: Validate & prepare assets
# Stage 2: Production Nginx server
# ============================================================

# --- Stage 1: Build / Validate ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all source files
COPY . .

# Validate HTML files exist
RUN test -f index.html && echo "✅ index.html found" || (echo "❌ index.html missing" && exit 1)
RUN test -d static && echo "✅ static/ found" || (echo "❌ static/ missing" && exit 1)
RUN test -d css && echo "✅ css/ found" || (echo "❌ css/ missing" && exit 1)
RUN test -d js && echo "✅ js/ found" || (echo "❌ js/ missing" && exit 1)

# --- Stage 2: Production ---
FROM nginx:1.27-alpine AS production

# Remove default nginx config and page
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy website files from builder
COPY --from=builder /app/*.html /usr/share/nginx/html/
COPY --from=builder /app/css /usr/share/nginx/html/css
COPY --from=builder /app/js /usr/share/nginx/html/js
COPY --from=builder /app/static /usr/share/nginx/html/static

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Expose port
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/healthz || exit 1

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
