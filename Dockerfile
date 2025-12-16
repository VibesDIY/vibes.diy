FROM node:22-slim AS builder
RUN mkdir -p /build
WORKDIR /build
COPY . /build/
RUN rm -rf /build/node_modules
RUN npm install -g pnpm 
RUN pnpm i
RUN cd /build/vibes.diy/pkg && pnpm run build

CMD ["bash", "-c", "cd /build/vibes.diy/pkg && pnpm run dev"]


#FROM node:22-alpine
#WORKDIR /app
#COPY package*.json ./
#RUN npm ci --production
#COPY --from=builder /app/dist ./dist
#USER node
#CMD ["node", "dist/index.js"]
