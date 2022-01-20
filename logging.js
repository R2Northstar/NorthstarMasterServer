const winston = require('winston');
const fs = require('fs')
fs.truncate('latest.log', 0, function(){})

const myFormat = winston.format.printf(({message, level, timestamp}) => {
    return `${timestamp} [${level}]: ${message}`;
});

let logger = winston.createLogger({
    level: 'debug',
    format: winston.format.json(),
    defaultMeta: { service: 'user-service' },
    transports: [
        //
        // - Write all logs with level `error` and below to `error.log`
        // - Write all logs with level `info` and below to `combined.log`
        //
        new winston.transports.File({
            filename: 'latest.log',
            format: winston.format.combine(
                winston.format.errors({
                    stack: true
                }),
                winston.format.timestamp(),
                winston.format.json(),
            )
        }),
        new winston.transports.File({
            filename: 'error.log',
            format: winston.format.combine(
                winston.format.errors({
                    stack: true
                }),
                winston.format.timestamp(),
                winston.format.json(),
            ),
            level: "error"
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.errors({
                    stack: true
                }),
                winston.format.timestamp({
                    format: 'Do MMM, YYYY hh:mm:ss a Z'
                }),
                myFormat,
            )
        })
    ],
});

// 0 = off
// 1 = error
// 2 = error + auth 
// 3 = error + auth + sync
function logSync(data, level, type="info") {
    if (process.env.SYNC_LOGGING_LEVEL >= level) {
        switch (type) {
            case "info":
                logger.info(data)
                break
            case "error":
                logger.error(data)
                break
            case "warn":
                logger.warn(data)
                break
            case "debug":
                logger.debug(data)
                break
            default:
                console.log("Unknown logging type \"" + type + "\"")
        }
    }
}

function logMonarch(data, type="info") {
    if (process.env.USE_MONARCH_LOGGING == 1) {
        switch (type) {
            case "info":
                logger.info(data)
                break
            case "error":
                logger.error(data)
                break
            case "warn":
                logger.warn(data)
                break
            case "debug":
                logger.debug(data)
                break
            default:
                console.log("Unknown logging type \"" + type + "\"")
        }
    }
}

module.exports = {
    logMonarch,
    logSync,
    logger
}