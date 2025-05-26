// Basic import test file
import React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@mui/material';
import type { User } from './types';
import './styles.css';

export default function BasicComponent() {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    axios.get('/api/user').then(response => {
      setUser(response.data);
    });
  }, []);

  return (
    <div>
      <Button onClick={() => console.log('clicked')}>
        Hello {user?.name}
      </Button>
    </div>
  );
}