// React
import React        from 'react';
import { useState } from 'react';
import type { FC }  from 'react';

// Node Modules
import axios           from 'axios';
import express         from 'express';
import lodash          from 'lodash';
import mongoose        from 'mongoose';
import type { Schema } from 'mongoose';

// Scoped Packages
import { render }       from '@testing-library/react';
import { EventEmitter } from '@types/node';

// Local Files
import { localFunction } from './local';
import { helper }        from './utils';
import './styles.css';

// This file uses the config from subfolder/tidyjs.json
// Expected order after formatting:
// 1. React (matches "^react")
// 2. Node Modules (matches "^[^@/.]")  
// 3. Scoped Packages (matches "^@")
// 4. Local Files (matches "^\.")
// 5. Default (unmatched)

const app = express();

export function testSubfolderConfig(): void {
    console.log("Using subfolder-specific configuration");
}