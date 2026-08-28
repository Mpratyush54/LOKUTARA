FROM node:18

WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy all source files
COPY . .

# Expose backend port
EXPOSE 3010

# Start using PM2 ecosystem
CMD ["pm2-runtime", "ecosystem.config.js"]
