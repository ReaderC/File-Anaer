FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS backend-build
ARG TARGETOS=linux
ARG TARGETARCH=amd64
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum* ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /out/file-anaer ./cmd/server

FROM alpine:3.21 AS runtime
RUN apk add --no-cache ca-certificates fd gdu fclones
WORKDIR /app
COPY --from=backend-build /out/file-anaer /app/file-anaer
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
COPY THIRD_PARTY_NOTICES.md /app/licenses/THIRD_PARTY_NOTICES.md
COPY licenses /app/licenses
ENV PORT=8080
ENV SCAN_ROOTS=/data
EXPOSE 8080
ENTRYPOINT ["/app/file-anaer"]
