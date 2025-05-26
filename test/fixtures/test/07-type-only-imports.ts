// Type-only imports test
import type { FC, ReactNode, ComponentProps } from 'react';
import type { NextPage, GetServerSideProps, GetStaticProps } from 'next';
import type { Request, Response, NextFunction } from 'express';
import type { Schema, Document, Model } from 'mongoose';
import type { Redis } from 'ioredis';
import type { Logger } from 'winston';
import type { Config } from 'jest';
import type { Configuration } from 'webpack';
import type { UserConfigFn } from 'vite';
import type { ESLint } from 'eslint';
import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import winston from 'winston';

// Custom types
export type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'moderator';
  createdAt: Date;
  updatedAt: Date;
};

export type Post = {
  id: string;
  title: string;
  content: string;
  authorId: string;
  author?: User;
  tags: string[];
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Comment = {
  id: string;
  content: string;
  postId: string;
  post?: Post;
  authorId: string;
  author?: User;
  parentId?: string;
  parent?: Comment;
  children?: Comment[];
  createdAt: Date;
  updatedAt: Date;
};

// Interface extending types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(userData: Partial<User>): Promise<User>;
  update(id: string, userData: Partial<User>): Promise<User | null>;
  delete(id: string): Promise<boolean>;
  findMany(filters: Partial<User>): Promise<User[]>;
}

export interface PostRepository {
  findById(id: string): Promise<Post | null>;
  findByAuthor(authorId: string): Promise<Post[]>;
  create(postData: Partial<Post>): Promise<Post>;
  update(id: string, postData: Partial<Post>): Promise<Post | null>;
  delete(id: string): Promise<boolean>;
  findPublished(): Promise<Post[]>;
}

// Function type definitions
export type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
export type ErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => void;
export type ValidationSchema<T> = (data: unknown) => data is T;
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

// Generic utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Component props types
export type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
};

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
};

export type FormFieldProps<T = string> = {
  name: string;
  label?: string;
  value: T;
  onChange: (value: T) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

// Page component types
export const HomePage: NextPage = () => {
  return <div>Home Page</div>;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      data: 'server side data'
    }
  };
};

// Service interfaces
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface EmailService {
  sendEmail(to: string, subject: string, body: string): Promise<boolean>;
  sendWelcomeEmail(user: User): Promise<boolean>;
  sendPasswordResetEmail(user: User, resetToken: string): Promise<boolean>;
}

export interface FileStorageService {
  upload(file: Buffer, filename: string): Promise<string>;
  download(filename: string): Promise<Buffer>;
  delete(filename: string): Promise<boolean>;
  getUrl(filename: string): string;
}

// Configuration types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  poolSize?: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface AppConfig {
  port: number;
  host: string;
  environment: 'development' | 'staging' | 'production';
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  upload: {
    maxSize: number;
    allowedTypes: string[];
  };
}

// Implementation example using imported types
class UserService implements UserRepository {
  private logger: Logger;
  
  constructor() {
    this.logger = winston.createLogger();
  }
  
  async findById(id: string): Promise<User | null> {
    this.logger.info(`Finding user by id: ${id}`);
    // Implementation here
    return null;
  }
  
  async findByEmail(email: string): Promise<User | null> {
    this.logger.info(`Finding user by email: ${email}`);
    // Implementation here
    return null;
  }
  
  async create(userData: Partial<User>): Promise<User> {
    this.logger.info('Creating new user');
    // Implementation here
    throw new Error('Not implemented');
  }
  
  async update(id: string, userData: Partial<User>): Promise<User | null> {
    this.logger.info(`Updating user: ${id}`);
    // Implementation here
    return null;
  }
  
  async delete(id: string): Promise<boolean> {
    this.logger.info(`Deleting user: ${id}`);
    // Implementation here
    return false;
  }
  
  async findMany(filters: Partial<User>): Promise<User[]> {
    this.logger.info('Finding users with filters', filters);
    // Implementation here
    return [];
  }
}