import { MockApi } from './mockApi';
import type { SamanvayApi } from './types';

/**
 * The single API client used by the UI. Swap `new MockApi()` for an HTTP client that implements
 * `SamanvayApi` (see docs/api-contract.md) to move to the FastAPI backend without UI changes.
 */
export const api: SamanvayApi = new MockApi();
