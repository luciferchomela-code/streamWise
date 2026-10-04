FROM node:20-alpine

WORKDIR /app/auth-service

COPY auth-service/package*.json ./
RUN npm install

COPY auth-service/ ./
COPY shared/package*.json ../shared/
RUN cd ../shared && npm install
COPY shared/ ../shared/

EXPOSE 5001

CMD ["npm", "run", "start"]
