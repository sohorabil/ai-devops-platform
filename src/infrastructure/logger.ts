import pino from "pino";
import { config } from "@infrastructure/config.js";

export type Logger = pino.Logger;

// Singleton logger — one instance shared across the whole application
export const logger: Logger = pino({ level: config.LOG_LEVEL });
