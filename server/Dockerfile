FROM node:20-alpine
RUN apk add --no-cache ffmpeg python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN mkdir -p data uploads
EXPOSE 4000
CMD ["node", "app.js"]
