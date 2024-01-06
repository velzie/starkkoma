FROM node:16 as builder
WORKDIR /build
COPY ./ /build/
RUN npm run build


FROM nginx:alpine
LABEL org.opencontainers.image.authors="@phoenix_fairy@thetransagenda.gay"
COPY --from=builder /build/dist /usr/share/nginx/html 
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
