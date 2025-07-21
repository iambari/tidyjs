// Core Libraries
import coreLibrary  from 'core';
import { coreUtil } from 'core/utils';

// External
import express         from 'express';
import lodash          from 'lodash';
import mongoose        from 'mongoose';
import React           from 'react';
import { useState }    from 'react';
import type { Schema } from 'mongoose';
import type { FC }     from 'react';

// Internal
import '@/components/Button';

// Relative
import { localFunction } from './local';
import { helper }        from './utils';
import './styles.css';

// This file uses the config from folder/tidyjs.json
// Expected order after formatting:
// 1. Core Libraries (matches "^core")
// 2. External (matches "^[^@.]")
// 3. Internal (matches "^@/")
// 4. Relative (matches "^\.")
// 5. Others (default)

const app = express();

export function testFolderConfig(): void {
  console.log('Using folder-specific configuration');
}