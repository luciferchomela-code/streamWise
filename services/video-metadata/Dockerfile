FROM node:20-alpine

WORKDIR /app/video-metadata

COPY video-metadata/package*.json ./
RUN npm install

COPY video-metadata/ ./
COPY shared/ ../shared/
RUN ln -s /app/video-metadata/node_modules /app/node_modules

EXPOSE 5002

CMD ["npm", "run", "start"]
