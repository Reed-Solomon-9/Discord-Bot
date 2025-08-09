const winston = require('winston');
const { Logtail } = require('@logtail/winston');

const logtailTransport = new Logtail('ENVF9A1YDz65qYMHa3kexfcT')

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
    logtailTransport // Add the Better Stack transport here
  ],
});

module.exports = logger;