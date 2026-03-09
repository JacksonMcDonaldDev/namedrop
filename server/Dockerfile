FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN mkdir -p uploads/photos

EXPOSE 3001

CMD ["npm", "run", "dev"]
