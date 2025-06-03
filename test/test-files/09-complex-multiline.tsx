// Complex multiline imports test
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
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams
} from 'react-router-dom';

import {
  ThemeProvider,
  createTheme,
  styled,
  useTheme,
  alpha,
  darken,
  lighten
} from '@mui/material/styles';

import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Card,
  CardContent,
  CardActions,
  CardHeader,
  CardMedia,
  Grid,
  Container,
  Box,
  Stack,
  Chip,
  Avatar,
  Badge,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormLabel,
  FormHelperText,
  FormControlLabel,
  RadioGroup,
  Radio,
  Checkbox,
  Select,
  MenuItem,
  InputLabel,
  Switch,
  Slider,
  Autocomplete,
  CircularProgress,
  LinearProgress,
  Skeleton,
  Alert,
  Snackbar,
  Breadcrumbs,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Divider,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon
} from '@mui/material';

import {
  Menu as MenuIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';

import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useIsFetching,
  useIsMutating
} from '@tanstack/react-query';

import {
  useForm,
  Controller,
  FormProvider,
  useFormContext,
  useWatch,
  useController,
  useFieldArray,
  FieldValues,
  FieldPath,
  FieldErrors,
  Control,
  UseFormReturn,
  UseFormSetValue,
  UseFormGetValues,
  UseFormWatch,
  UseFormSetError,
  UseFormClearErrors,
  UseFormReset,
  UseFormTrigger,
  UseFormSetFocus,
  UseFormGetFieldState,
  UseFormUnregister,
  UseFormHandleSubmit
} from 'react-hook-form';

import {
  z as zod,
  ZodSchema,
  ZodError,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodArray,
  ZodObject,
  ZodEnum,
  ZodOptional,
  ZodNullable,
  ZodDefault,
  ZodUnion,
  ZodIntersection,
  ZodTuple,
  ZodRecord,
  ZodMap,
  ZodSet,
  ZodFunction,
  ZodLazy,
  ZodLiteral,
  ZodUndefined,
  ZodNull,
  ZodAny,
  ZodUnknown,
  ZodNever,
  ZodVoid,
  ZodDate,
  ZodType
} from 'zod';

import {
  format,
  parseISO,
  isValid,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  addDays,
  addHours,
  addMinutes,
  subDays,
  subHours,
  subMinutes,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isSameDay,
  isSameWeek,
  isSameMonth,
  isSameYear,
  isAfter,
  isBefore,
  isToday,
  isYesterday,
  isTomorrow,
  isThisWeek,
  isThisMonth,
  isThisYear
} from 'date-fns';

import type {
  ComponentType,
  ReactNode,
  ReactElement,
  FC,
  PropsWithChildren,
  RefObject,
  MutableRefObject,
  HTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  FormHTMLAttributes,
  CSSProperties,
  SyntheticEvent,
  MouseEvent,
  KeyboardEvent,
  ChangeEvent,
  FocusEvent,
  FormEvent,
  ClipboardEvent,
  DragEvent,
  TouchEvent,
  WheelEvent,
  AnimationEvent,
  TransitionEvent
} from 'react';

import type {
  Theme,
  Palette,
  PaletteOptions,
  ThemeOptions,
  Breakpoints,
  BreakpointOverrides,
  Spacing,
  Typography as MuiTypography,
  TypographyOptions,
  Shadows,
  Transitions,
  ZIndex,
  Mixins,
  Components,
  ComponentsProps,
  ComponentsOverrides,
  ComponentsVariants
} from '@mui/material/styles';

// Local imports with multiline destructuring
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

import {
  useAuth,
  useLocalStorage,
  useSessionStorage,
  useDebounce,
  useThrottle,
  useInterval,
  useTimeout,
  useToggle,
  useCounter,
  usePrevious,
  useUpdateEffect,
  useIsMounted,
  useIsOnline,
  useWindowSize,
  useScrollPosition,
  useIntersectionObserver,
  useKeyPress,
  useClickOutside,
  useClipboard,
  useMediaQuery,
  useGeolocation,
  usePermission,
  useBattery,
  useNetworkState,
  useFileSystem,
  useWebShare,
  useVibration,
  useFullscreen,
  useOrientation,
  usePageVisibility,
  useDocumentTitle,
  useFavicon,
  useEventListener,
  useScript,
  useStylesheet,
  useAsync,
  useAsyncFn,
  useAsyncRetry,
  useMountedState,
  useUnmountPromise,
  usePromise,
  useLatest,
  useRafState,
  useSetState,
  useGetSet,
  useRenderInfo,
  useWhyDidYouUpdate,
  useFirstMountState,
  useRendersCount,
  useLogger,
  useMultiStateValidator,
  createReducer,
  createReducerContext,
  createStateContext,
  createGlobalState
} from '@app/hooks';

// Complex interface extending multiple types
interface ComplexComponentProps 
  extends PropsWithChildren<HTMLAttributes<HTMLDivElement>>,
          Pick<Theme, 'palette' | 'typography' | 'spacing'>,
          Partial<UseFormReturn<any>> {
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  onSubmit?: (data: any) => void | Promise<void>;
  onCancel?: () => void;
  onReset?: () => void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  mode?: 'onChange' | 'onBlur' | 'onSubmit' | 'onTouched' | 'all';
  reValidateMode?: 'onChange' | 'onBlur' | 'onSubmit';
  defaultValues?: Record<string, any>;
  values?: Record<string, any>;
  resolver?: (data: any) => Promise<{ values: any; errors: any }>;
  shouldFocusError?: boolean;
  shouldUnregister?: boolean;
  shouldUseNativeValidation?: boolean;
  criteriaMode?: 'firstError' | 'all';
  delayError?: number;
}

// Styled components with complex theming
const StyledContainer = styled(Container)(({ theme }) => ({
  padding: theme.spacing(3),
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
  backgroundColor: alpha(theme.palette.background.paper, 0.8),
  backdropFilter: 'blur(8px)',
  borderRadius: theme.shape.borderRadius * 2,
  boxShadow: theme.shadows[4],
  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
  transition: theme.transitions.create([
    'background-color',
    'box-shadow',
    'border-color'
  ], {
    duration: theme.transitions.duration.standard,
    easing: theme.transitions.easing.easeInOut
  }),
  '&:hover': {
    backgroundColor: alpha(theme.palette.background.paper, 0.9),
    boxShadow: theme.shadows[8],
    borderColor: alpha(theme.palette.primary.main, 0.3)
  },
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(2),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius
  }
}));

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: theme.transitions.create([
    'transform',
    'box-shadow'
  ], {
    duration: theme.transitions.duration.shorter
  }),
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8]
  }
}));

// Main component with all the complex imports
const ComplexComponent: FC<ComplexComponentProps> = memo(forwardRef<
  HTMLDivElement,
  ComplexComponentProps
>(({
  children,
  title,
  subtitle,
  loading = false,
  error = null,
  onSubmit,
  onCancel,
  onReset,
  className,
  ...props
}, ref) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const queryClient = useQueryClient();
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isDirty, isValid }
  } = useForm({
    mode: 'onChange',
    reValidateMode: 'onChange'
  });
  
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isOnline = useIsOnline();
  const windowSize = useWindowSize();
  const scrollPosition = useScrollPosition();
  const isVisible = useIntersectionObserver(containerRef, { threshold: 0.1 });
  
  const debouncedSearch = useDebounce(watch('search'), 300);
  const throttledScroll = useThrottle(scrollPosition, 100);
  
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users', debouncedSearch],
    queryFn: () => UserService.search(debouncedSearch),
    enabled: !!debouncedSearch
  });
  
  const createUserMutation = useMutation({
    mutationFn: UserService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setNotification('User created successfully!');
    },
    onError: (error) => {
      setNotification(`Error: ${error.message}`);
    }
  });
  
  const formattedDate = useMemo(() => {
    return format(selectedDate, 'MMMM do, yyyy');
  }, [selectedDate]);
  
  const isToday = useMemo(() => {
    return isSameDay(selectedDate, new Date());
  }, [selectedDate]);
  
  const handleFormSubmit = useCallback(async (data: any) => {
    try {
      await createUserMutation.mutateAsync(data);
      onSubmit?.(data);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  }, [createUserMutation, onSubmit]);
  
  const handleDateChange = useCallback((date: Date | null) => {
    if (date && isValid(date)) {
      setSelectedDate(date);
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('date', format(date, 'yyyy-MM-dd'));
      setSearchParams(searchParams);
    }
  }, [location.search, setSearchParams]);
  
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsedDate = parseISO(dateParam);
      if (isValid(parsedDate)) {
        setSelectedDate(parsedDate);
      }
    }
  }, [searchParams]);
  
  useEffect(() => {
    if (error) {
      setNotification(error);
    }
  }, [error]);
  
  useInterval(() => {
    // Refresh data every 30 seconds
    queryClient.invalidateQueries({ queryKey: ['users'] });
  }, 30000);
  
  if (loading || usersLoading) {
    return (
      <StyledContainer maxWidth="lg">
        <Grid container spacing={3}>
          {Array.from(new Array(6)).map((_, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <StyledCard>
                <Skeleton variant="rectangular" height={200} />
                <CardContent>
                  <Skeleton variant="text" height={32} />
                  <Skeleton variant="text" height={24} width="60%" />
                </CardContent>
              </StyledCard>
            </Grid>
          ))}
        </Grid>
      </StyledContainer>
    );
  }
  
  return (
    <StyledContainer maxWidth="lg" ref={ref} className={className} {...props}>
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="subtitle1" color="textSecondary">
            {subtitle}
          </Typography>
        )}
        <Box display="flex" alignItems="center" gap={2} mt={2}>
          <Chip
            icon={<CheckIcon />}
            label={isOnline ? 'Online' : 'Offline'}
            color={isOnline ? 'success' : 'error'}
            size="small"
          />
          <Chip
            label={`${windowSize.width}x${windowSize.height}`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={formattedDate}
            color={isToday ? 'primary' : 'default'}
            size="small"
          />
        </Box>
      </Box>
      
      <FormProvider {...{ register, handleSubmit, control, watch, setValue, getValues, formState: { errors, isSubmitting, isDirty, isValid } }}>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Search Users"
                {...register('search')}
                InputProps={{
                  startAdornment: <SearchIcon />,
                  endAdornment: debouncedSearch && (
                    <CircularProgress size={20} />
                  )
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Filter by Role</InputLabel>
                <Select
                  {...register('role')}
                  label="Filter by Role"
                >
                  <MenuItem value="">All Roles</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="user">User</MenuItem>
                  <MenuItem value="moderator">Moderator</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  onClick={onReset}
                  disabled={isSubmitting}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={isSubmitting || !isDirty || !isValid}
                  loading={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </FormProvider>
      
      <Box mt={4}>
        {children}
      </Box>
      
      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setNotification(null)}
          severity={notification?.includes('Error') ? 'error' : 'success'}
          variant="filled"
        >
          {notification}
        </Alert>
      </Snackbar>
    </StyledContainer>
  );
}));

ComplexComponent.displayName = 'ComplexComponent';

export default ComplexComponent;