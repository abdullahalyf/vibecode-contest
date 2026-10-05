# Build tools run only during image creation. The deployed image serves static files.
FROM node:24-alpine AS build
WORKDIR /app
COPY index.html favicon.svg ./
COPY scripts/build.mjs ./scripts/build.mjs
COPY src ./src
COPY data ./data
COPY puku1/engine.js puku1/session.js ./puku1/
COPY puku2/map.js puku2/styles.css ./puku2/
RUN node scripts/build.mjs

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
EXPOSE 8080
CMD ["caddy", "file-server", "--root", "/srv", "--listen", ":8080"]
