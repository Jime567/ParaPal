FROM node:20-alpine AS build

WORKDIR /app

# Install deps
COPY web-parapal/package*.json ./
RUN npm ci

# Build React app
COPY web-parapal ./
RUN npm run build

FROM nginx:alpine AS runner

EXPOSE 8200

# Replace default site to serve SPA on port 8200
RUN rm /etc/nginx/conf.d/default.conf
COPY web-parapal/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]
