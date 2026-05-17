# Use Node 22 LTS
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy app code
COPY . .

# Build Next.js app
RUN npm run build

# Expose port (Cloud Run default)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
