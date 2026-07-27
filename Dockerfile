FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application
COPY main.js .

# Expose port
EXPOSE 8080

# Start application
CMD ["npm", "start"]
