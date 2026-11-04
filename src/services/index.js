import { USE_MOCK_DATA } from '../config';
import { mockService } from './mock/mockService';
import { apiService } from './api/apiService';

export const dataService = USE_MOCK_DATA ? mockService : apiService;
