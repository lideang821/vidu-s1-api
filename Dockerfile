FROM node:20-alpine
WORKDIR /app
COPY examples/node-quickstart/package*.json ./
RUN npm ci --only=production
COPY examples/node-quickstart/ .
ENV NODE_QUICKSTART_PORT=7860
EXPOSE 7860
CMD ["node", "server.js"]
