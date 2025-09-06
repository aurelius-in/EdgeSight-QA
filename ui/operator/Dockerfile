FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* ./
RUN npm ci || npm install
COPY . .
ARG VITE_CAPTURE_API_BASE
ARG VITE_INFERENCE_API_BASE
ARG VITE_RESULTS_ADAPTER_API_BASE
ENV VITE_CAPTURE_API_BASE=${VITE_CAPTURE_API_BASE}
ENV VITE_INFERENCE_API_BASE=${VITE_INFERENCE_API_BASE}
ENV VITE_RESULTS_ADAPTER_API_BASE=${VITE_RESULTS_ADAPTER_API_BASE}
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


