/*
 * Copyright (c) 2024 TidyJS Contributors
 * 
 * This file demonstrates the multiline comment bug fix.
 * File header comments should be preserved when formatting imports.
 */

import { useState } from 'react';
import Button from '@app/components/Button';
import React from 'react';
import { FC } from 'react';
import type { ReactNode } from 'react';
import utils from '@core/utils';
import { helper } from '../helpers/testHelper';
import './styles.css';

/**
 * Test component to verify import formatting
 * with multiline comments at the beginning
 */
const TestComponent: FC = () => {
    const [count, setCount] = useState(0);
    
    return (
        <div>
            <Button onClick={() => setCount(count + 1)}>
                Count: {count}
            </Button>
        </div>
    );
};

export default TestComponent;