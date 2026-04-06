FROM node:20-alpine

# Don't run as root — if someone exploits a vuln in our code or deps,
# they shouldn't also have write access to the OS
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy package files first to leverage Docker's layer cache — npm install
# only re-runs when dependencies actually change, not on every code change
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Ownership before switching user
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["node", "index.js"]
