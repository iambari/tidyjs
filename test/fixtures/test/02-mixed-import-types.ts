// Mixed import types test
import fs from 'fs';
import path, { join, dirname } from 'path';
import * as crypto from 'crypto';
import type { Config } from './config';
import type { Logger } from 'winston';
import { createLogger } from 'winston';
import 'dotenv/config';
import './polyfills';

export interface AppConfig extends Config {
  port: number;
  host: string;
}

export class FileManager {
  private logger: Logger;
  
  constructor(config: AppConfig) {
    this.logger = createLogger();
  }
  
  async readFile(filename: string): Promise<string> {
    const fullPath = join(dirname(__filename), filename);
    const hash = crypto.randomBytes(16).toString('hex');
    return fs.promises.readFile(fullPath, 'utf8');
  }
}