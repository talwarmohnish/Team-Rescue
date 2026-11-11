import {afterEach,vi} from 'vitest';
import {cleanup} from '@testing-library/react';
globalThis.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}};
globalThis.IntersectionObserver=class {observe(){}unobserve(){}disconnect(){}};
window.matchMedia=vi.fn().mockImplementation(query=>({matches:false,media:query,addEventListener(){},removeEventListener(){}}));
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks()});
