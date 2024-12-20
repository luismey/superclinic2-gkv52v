// @testing-library/jest-dom v5.16.5
import '@testing-library/jest-dom';
// whatwg-fetch v3.6.2
import 'whatwg-fetch';

// Configure test environment timeout
jest.setTimeout(10000);

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  private callback: IntersectionObserverCallback;
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia
global.matchMedia = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

// Configure JSDOM environment options
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost',
    origin: 'http://localhost',
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
    pathname: '/',
    search: '',
    hash: '',
  },
  writable: true,
});

// Configure global error handling for tests
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Ignore specific React-related warnings during tests
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: ReactDOM.render') ||
      args[0].includes('Warning: React.createElement'))
  ) {
    return;
  }
  originalConsoleError.call(console, ...args);
};

// Configure fetch mock defaults
beforeAll(() => {
  // Ensure fetch is available in the test environment
  if (!globalThis.fetch) {
    require('whatwg-fetch');
  }
});

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Add custom matchers for testing accessibility
expect.extend({
  toBeAccessible(received: Element) {
    const { getComputedRole, isInaccessible } = require('@testing-library/dom');
    const role = getComputedRole(received);
    const accessible = !isInaccessible(received);

    return {
      message: () =>
        `expected element with role "${role}" to${
          accessible ? ' not' : ''
        } be accessible`,
      pass: accessible,
    };
  },
});

// Configure default test environment options
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

// Mock scrollTo function
global.scrollTo = jest.fn();

// Configure MutationObserver mock
global.MutationObserver = class {
  constructor(callback: MutationCallback) {
    this.callback = callback;
  }
  private callback: MutationCallback;
  observe() {}
  disconnect() {}
  takeRecords(): MutationRecord[] {
    return [];
  }
};

// Suppress specific console warnings during tests
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  // Ignore specific warnings that are not relevant during testing
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('componentWillReceiveProps') ||
      args[0].includes('componentWillMount'))
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};