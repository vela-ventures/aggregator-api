FROM node:24

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

ENV BASE64_PRIVATE_KEY=$BASE64_PRIVATE_KEY

CMD [ "node", "dist/main.js" ]