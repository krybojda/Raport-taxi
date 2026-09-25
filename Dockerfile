FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm config set strict-ssl false \
	&& npm ci --no-audit --no-fund \
	&& npm config delete strict-ssl

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]