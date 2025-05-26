// App module imports test
import React from 'react';
import { Component } from 'react';
import axios from 'axios';
import { debounce } from 'lodash';
import type { User } from '@app/types/user';
import type { Post } from '@app/types/post';
import { UserService } from '@app/services/user';
import { PostService } from '@app/services/post';
import { AuthGuard } from '@app/guards/auth';
import { ValidationHelper } from '@app/utils/validation';
import { Logger } from '@app/utils/logger';
import { CONFIG } from '@app/config/app';
import { ROUTES } from '@app/constants/routes';
import { formatDate } from '@app/helpers/date';
import { ApiClient } from '@app/api/client';
import { CacheManager } from '@app/cache/manager';
import './component.scss';

interface Props {
  userId: string;
}

interface State {
  user: User | null;
  posts: Post[];
  loading: boolean;
}

@AuthGuard
export class UserDashboard extends Component<Props, State> {
  private userService: UserService;
  private postService: PostService;
  private logger: Logger;
  private cache: CacheManager;

  constructor(props: Props) {
    super(props);
    
    this.userService = new UserService(new ApiClient());
    this.postService = new PostService(new ApiClient());
    this.logger = new Logger('UserDashboard');
    this.cache = new CacheManager();
    
    this.state = {
      user: null,
      posts: [],
      loading: true
    };
  }

  async componentDidMount() {
    await this.loadUserData();
  }

  private loadUserData = debounce(async () => {
    try {
      const [user, posts] = await Promise.all([
        this.userService.getUser(this.props.userId),
        this.postService.getUserPosts(this.props.userId)
      ]);

      if (ValidationHelper.validateUser(user)) {
        this.setState({ user, posts, loading: false });
        this.cache.set(`user_${user.id}`, user, CONFIG.CACHE_TTL);
      }
    } catch (error) {
      this.logger.error('Failed to load user data:', error);
      this.setState({ loading: false });
    }
  }, 300);

  render() {
    const { user, posts, loading } = this.state;

    if (loading) {
      return <div>Loading...</div>;
    }

    return (
      <div className="user-dashboard">
        <h1>{user?.name}</h1>
        <p>Joined: {user ? formatDate(user.createdAt) : 'Unknown'}</p>
        <div className="posts">
          {posts.map(post => (
            <div key={post.id} className="post">
              <h3>{post.title}</h3>
              <p>{post.content}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
}