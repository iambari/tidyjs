// Intentionally messy imports to test formatter
import { z } from 'zod';
import { readFileSync } from 'fs';
import React, { 
    useState, 
    useEffect, 
    useCallback,
    useMemo 
} from 'react';
import type { NextPage } from 'next';
import { Button, TextField, Card } from '@mui/material';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import _ from 'lodash';
import './global.css';
import type { User, Post, Comment } from '@app/types';
import { validateUser } from '@app/validators';
import { API_ENDPOINTS } from '@app/constants';
import 'reflect-metadata';

const HomePage: NextPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response: AxiosResponse<User[]> = await axios.get(API_ENDPOINTS.USERS);
      const validatedUsers = response.data.filter(validateUser);
      setUsers(validatedUsers);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const userCount = useMemo(() => users.length, [users]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <Card>
      <h1>Users ({userCount})</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        users.map(user => (
          <div key={user.id}>
            <TextField value={user.name} />
            <Button onClick={() => _.debounce(() => console.log(user), 300)()}>
              View {user.name}
            </Button>
          </div>
        ))
      )}
    </Card>
  );
};

export default HomePage;