# ---- Base Node ----
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- Dependencies ----
FROM base AS dependencies
RUN npm set progress=false && npm config set depth 0
RUN npm install --only=production 
RUN cp -R node_modules prod_node_modules

# ---- Release ----
FROM base AS release
# Install PM2
RUN npm install pm2 -g

# Copy production node_modules
COPY --from=dependencies /app/prod_node_modules ./node_modules
# Copy app sources
COPY . .

# Expose port and start application
EXPOSE 5000
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
