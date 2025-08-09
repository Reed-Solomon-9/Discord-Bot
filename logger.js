const winston = require('winston');
const { LogtailTransport } = require('@logtail/winston');
const { Logtail } = require('@logtail/node'); // <-- Correct dependency

// Create the Logtail client first
const logtail = new Logtail('ues1YNiaXsVE6mXFJTLBhhkX');

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
    new LogtailTransport(logtail) // <-- Pass the client to the transport
  ],
});

// Add an error listener here to catch transport connection issues
logger.on('error', (err) => {
  console.error('Better Stack transport error:', err);
});

module.exports = logger;