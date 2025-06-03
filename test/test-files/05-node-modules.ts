// Node.js modules and external packages
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, resolve, basename } from 'path';
import { createHash } from 'crypto';
import { promisify } from 'util';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose, { Schema, Document } from 'mongoose';
import redis from 'redis';
import winston from 'winston';
import dotenv from 'dotenv';
import yup from 'yup';
import dayjs from 'dayjs';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

// Types
interface UserDocument extends Document {
  email: string;
  password: string;
  name: string;
  createdAt: Date;
}

interface JWTPayload {
  userId: string;
  email: string;
}

// Schema
const userSchema = new Schema<UserDocument>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model<UserDocument>('User', userSchema);

// Validation schemas
const loginSchema = yup.object({
  email: yup.string().email().required(),
  password: yup.string().min(8).required()
});

const registerSchema = yup.object({
  email: yup.string().email().required(),
  password: yup.string().min(8).required(),
  name: yup.string().min(2).required()
});

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP'
});

// Redis client
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
});

// Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(limiter);
app.use(express.json());

// Auth middleware
const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    (req as any).user = payload;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    res.status(403).json({ error: 'Invalid token' });
  }
};

// Routes
app.post('/register', async (req: Request, res: Response) => {
  try {
    await registerSchema.validate(req.body);
    
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = new User({
      email,
      password: hashedPassword,
      name
    });
    
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
    
    logger.info(`New user registered: ${chalk.green(email)}`);
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        createdAt: dayjs(user.createdAt).format('YYYY-MM-DD HH:mm:ss')
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(400).json({ error: 'Registration failed' });
  }
});

app.post('/login', async (req: Request, res: Response) => {
  try {
    await loginSchema.validate(req.body);
    
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
    
    // Cache user session
    const sessionKey = `session:${user._id}`;
    await redisClient.setex(sessionKey, 86400, JSON.stringify({ userId: user._id, email }));
    
    logger.info(`User logged in: ${chalk.blue(email)}`);
    
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(400).json({ error: 'Login failed' });
  }
});

app.get('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      createdAt: dayjs(user.createdAt).format('YYYY-MM-DD HH:mm:ss')
    });
  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`${chalk.green('✓')} Server running on port ${chalk.cyan(PORT)}`);
});