FROM node:22.22-alpine AS build
WORKDIR /app
ARG VITE_AUTH0_ISSUER
ARG VITE_AUTH0_AUDIENCE
ARG VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_ISSUER=$VITE_AUTH0_ISSUER \
    VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE \
    VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build/client/ /usr/share/nginx/html/
EXPOSE 80
