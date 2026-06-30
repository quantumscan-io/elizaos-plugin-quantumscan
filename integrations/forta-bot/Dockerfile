FROM node:18-alpine
RUN mkdir /app
WORKDIR /app
COPY . .
RUN npm install --production
CMD ["node", "-e", "require('forta-agent').run()"]
