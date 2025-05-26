import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useContext,
  createContext,
  memo,
  forwardRef,
  lazy,
  Suspense
} from 'react';

import {
  UserService,
  PostService,
  CommentService,
  AuthService,
  NotificationService,
  AnalyticsService,
  SearchService,
  FileUploadService,
  ImageProcessingService,
  EmailService,
  SmsService,
  PaymentService,
  SubscriptionService,
  ReportingService,
  AuditService,
  CacheService,
  QueueService,
  WebSocketService,
  ChatService,
  VideoCallService
} from '@app/services';