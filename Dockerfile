FROM node:16.15.0-alpine
WORKDIR /app
COPY package.json /app
RUN npm install && mv /app/node_modules /node_modules
COPY . /app
ENTRYPOINT ["npm", "run", "--"]