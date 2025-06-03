// Namespace imports test
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as util from 'util';
import * as os from 'os';
import * as querystring from 'querystring';
import * as url from 'url';
import * as zlib from 'zlib';
import express from 'express';
import axios from 'axios';
import _ from 'lodash';
import * as yup from 'yup';
import * as dayjs from 'dayjs';
import * as winston from 'winston';
import * as Redis from 'ioredis';
import * as mongoose from 'mongoose';
import type { User, Post } from './types';

// Using namespace imports
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const redis = new Redis.default({
  host: 'localhost',
  port: 6379
});

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  createdAt: { type: Date, default: Date.now }
});

const UserModel = mongoose.model('User', userSchema);

// React component using namespace import
const App: React.FC = () => {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      logger.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return React.createElement(
    'div',
    null,
    React.createElement('h1', null, 'Users'),
    loading 
      ? React.createElement('p', null, 'Loading...')
      : React.createElement(
          'ul',
          null,
          users.map(user => 
            React.createElement('li', { key: user.id }, user.name)
          )
        )
  );
};

// File operations using namespace imports
class FileManager {
  private readonly tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'app-files');
    this.ensureTempDir();
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async writeFile(filename: string, content: string): Promise<string> {
    const filePath = path.join(this.tempDir, filename);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    
    const compressed = await util.promisify(zlib.gzip)(Buffer.from(content));
    await fs.promises.writeFile(filePath, compressed);
    
    logger.info(`File written: ${filename} (hash: ${hash})`);
    return filePath;
  }

  async readFile(filename: string): Promise<string> {
    const filePath = path.join(this.tempDir, filename);
    const compressed = await fs.promises.readFile(filePath);
    const content = await util.promisify(zlib.gunzip)(compressed);
    
    logger.info(`File read: ${filename}`);
    return content.toString();
  }

  async deleteFile(filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.tempDir, filename);
      await fs.promises.unlink(filePath);
      logger.info(`File deleted: ${filename}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete file: ${filename}`, error);
      return false;
    }
  }

  getFileStats(filename: string): fs.Stats {
    const filePath = path.join(this.tempDir, filename);
    return fs.statSync(filePath);
  }
}

// URL and query parsing
class UrlHelper {
  static parseUrl(urlString: string): url.UrlWithParsedQuery {
    return url.parse(urlString, true);
  }

  static buildUrl(baseUrl: string, params: Record<string, any>): string {
    const query = querystring.stringify(params);
    return `${baseUrl}${query ? '?' + query : ''}`;
  }

  static extractDomain(urlString: string): string | null {
    const parsed = url.parse(urlString);
    return parsed.hostname;
  }
}

// Data validation using yup namespace
const userValidationSchema = yup.object({
  name: yup.string().required().min(2),
  email: yup.string().email().required(),
  age: yup.number().positive().integer().min(18),
  preferences: yup.object({
    newsletter: yup.boolean().default(false),
    notifications: yup.boolean().default(true)
  })
});

// Date manipulation using dayjs namespace
class DateHelper {
  static formatDate(date: Date | string): string {
    return dayjs.default(date).format('YYYY-MM-DD HH:mm:ss');
  }

  static addDays(date: Date | string, days: number): Date {
    return dayjs.default(date).add(days, 'day').toDate();
  }

  static getRelativeTime(date: Date | string): string {
    return dayjs.default(date).fromNow();
  }

  static isExpired(expiryDate: Date | string): boolean {
    return dayjs.default(expiryDate).isBefore(dayjs.default());
  }
}

// Express server setup
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'healthy',
    uptime: DateHelper.formatDate(new Date(Date.now() - uptime * 1000)),
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
    },
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version
  });
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await UserModel.find();
    res.json(users);
  } catch (error) {
    logger.error('Database error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    await userValidationSchema.validate(req.body);
    
    const user = new UserModel(req.body);
    await user.save();
    
    logger.info('User created:', user.toJSON());
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      res.status(400).json({ error: error.message });
    } else {
      logger.error('Database error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Export for use in other modules
export { App, FileManager, UrlHelper, DateHelper };
export default app;