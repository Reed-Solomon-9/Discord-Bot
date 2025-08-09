const winston = require('winston');
const { Logtail } = require('@logtail/winston'); // Correct import

const logtailTransport = new Logtail('ENVF9A1YDz65qYMHa3kexfcT');

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
    logtailTransport
  ],
});

// Add an error listener here to catch transport connection issues
logtailTransport.on('error', (err) => {
  console.error('Better Stack transport error:', err);
});

module.exports = logger;