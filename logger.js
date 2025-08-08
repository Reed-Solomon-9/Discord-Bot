const winston = require('winston');

const logger = winston.createLogger({
  level: 'info', // Set the default log level
  format: winston.format.json(), // Use JSON format for better parsing
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(), // Use a simple format for the console
    }),
  ],
});

module.exports = logger;