# Stage 1: Build the application
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Create a minimal image for running the application
FROM node:22-alpine AS runner
WORKDIR /app
# Copy only the necessary files from the build stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/build ./build
RUN npm install --only=production

EXPOSE 3000

# Set the environment variable for production
ENV NODE_ENV=production
# Change origin for your own deployments :)
ENV ORIGIN=https://mechmate.syd.shroomape.com 

# Start the SvelteKit app
CMD ["node","build/index.js"]
