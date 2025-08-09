const winston = require('winston');
const { LogtailTransport } = require('@logtail/winston'); // Corrected import name

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new LogtailTransport({
      token: 'YOUR_BETTER_STACK_API_KEY' // Correct way to pass the token
    })
  ],
});

// Add an error listener here to catch transport connection issues
logger.on('error', (err) => {
  console.error('Better Stack transport error:', err);
});

module.exports = logger;