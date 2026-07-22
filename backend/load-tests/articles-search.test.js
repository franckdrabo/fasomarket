// Load test for Article Search API
// Usage: k6 run articles-search.test.js
//
// Simulates multiple users searching for articles with different patterns:
// - General browsing (no filters)
// - Category-based search
// - Text search (full-text)
// - Price range filtering
// - Combined filters

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const searchDuration = new Trend('search_duration_ms');
const errorRate = new Rate('search_errors');
const resultsCount = new Trend('results_count');
const searchesPerMinute = new Counter('searches_per_minute');

// Search configurations to simulate real-world usage
const searchPatterns = [
  // General browsing
  { name: 'all_articles', params: {} },
  { name: 'all_articles_page2', params: { page: 2, limit: 20 } },

  // Category browsing (valeurs correspondant aux enums Prisma)
  { name: 'electronique', params: { categorie: 'ELECTRONIQUE' } },
  { name: 'maison', params: { categorie: 'MAISON' } },
  { name: 'vetements', params: { categorie: 'VETEMENTS' } },
  { name: 'chaussures', params: { categorie: 'CHAUSSURES' } },

  // Text search
  { name: 'search_iphone', params: { q: 'iPhone' } },
  { name: 'search_canape', params: { q: 'canapé' } },

  // Price-based search
  { name: 'price_low', params: { prixMin: 0, prixMax: 50000 } },
  { name: 'price_medium', params: { prixMin: 50000, prixMax: 200000 } },
  { name: 'price_high', params: { prixMin: 200000, prixMax: 1000000 } },

  // Location-based
  { name: 'ville_abidjan', params: { ville: 'Abidjan' } },
  { name: 'ville_dakar', params: { ville: 'Dakar' } },

  // Condition-based
  { name: 'etat_neuf', params: { etat: 'NEUF' } },
  { name: 'etat_bon_etat', params: { etat: 'BON_ETAT' } },

  // Combined filters (realistic heavy queries)
  { name: 'combined_1', params: { q: 'iPhone', categorie: 'ELECTRONIQUE', prixMin: 100000, prixMax: 1000000 } },
  { name: 'combined_2', params: { q: 'table', categorie: 'MAISON', ville: 'Abidjan', etat: 'COMME_NEUF' } },
];

export const options = {
  // Scenarios to simulate different user behaviors
  scenarios: {
    // Scenario 1: Steady load — like normal production traffic
    steady_browsing: {
      executor: 'constant-arrival-rate',
      rate: 50, // 50 searches per second
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 10,
      maxVUs: 50,
      exec: 'browsingScenario',
    },

    // Scenario 2: Spike — simulating a flash sale or peak hour
    spike_search: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { duration: '30s', target: 10 },   // Warm-up
        { duration: '30s', target: 100 },  // Ramp up to 100 req/s
        { duration: '1m', target: 200 },   // Spike at 200 req/s
        { duration: '30s', target: 100 },  // Ramp down
        { duration: '30s', target: 10 },   // Cool down
      ],
      exec: 'spikeScenario',
    },

    // Scenario 3: Heavy filtering — users who apply lots of filters
    heavy_filters: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 100,
      maxDuration: '2m',
      exec: 'heavyFilterScenario',
    },
  },

  thresholds: {
    // 95% of searches should complete within 500ms
    'search_duration_ms': ['p(95)<500', 'p(99)<1000'],
    // Error rate should be below 1%
    'search_errors': ['rate<0.01'],
    // 95% of HTTP requests should complete within 2s
    'http_req_duration': ['p(95)<2000'],
    'http_req_failed': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api/v1';

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildQueryString(params) {
  const entries = Object.entries(params).filter(([_, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

function performSearch(pattern, scenario) {
  const queryString = buildQueryString(pattern.params);
  const url = `${BASE_URL}/articles${queryString}`;

  const response = http.get(url, {
    tags: { name: `search_${pattern.name}`, scenario },
  });

  // Track metrics
  searchDuration.add(response.timings.duration, {
    pattern: pattern.name,
    scenario,
  });

  errorRate.add(response.status >= 400 || response.status === 0, {
    pattern: pattern.name,
    scenario,
  });

  const success = check(response, {
    [`${pattern.name}: status 200`]: (r) => r.status === 200,
    [`${pattern.name}: response time < 2s`]: (r) => r.timings.duration < 2000,
  });

  if (success) {
    try {
      const body = JSON.parse(response.body);
      if (Array.isArray(body)) {
        resultsCount.add(body.length, { pattern: pattern.name, scenario });
      } else if (body.data && Array.isArray(body.data)) {
        resultsCount.add(body.data.length, { pattern: pattern.name, scenario });
      }
    } catch (e) {
      // Ignore parse errors for metrics
    }
  }

  searchesPerMinute.add(1);
}

// ─── Scenarios ────────────────────────────────────────────────────────────

// Steady browsing: users browse articles normally
export function browsingScenario() {
  group('Browsing Articles', () => {
    // Most common: browsing by category or general listing
    const pattern = pickRandom(searchPatterns.slice(0, 15)); // General + category + text + price + location
    performSearch(pattern, 'steady_browsing');
    sleep(Math.random() * 2 + 0.5); // Users think between searches
  });
}

// Spike: sudden burst of traffic (e.g., new articles posted)
export function spikeScenario() {
  group('Spike Search', () => {
    // During spike, users search more aggressively
    const pattern = pickRandom(searchPatterns);
    performSearch(pattern, 'spike');
    // Less thinking time during spike
    sleep(Math.random() * 0.5 + 0.1);
  });
}

// Default export for simple CLI runs with --duration/--vus
export default function() {
  browsingScenario();
}

// Heavy filters: power users with complex queries
export function heavyFilterScenario() {
  group('Heavy Filtering', () => {
    // Heavy users do multiple searches in succession
    const heavyPatterns = searchPatterns.filter((p) =>
      p.name.startsWith('combined_') ||
      p.name.startsWith('search_') ||
      p.name.startsWith('price_')
    );

    // Do 3-5 searches in quick succession
    const numSearches = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < numSearches; i++) {
      const pattern = pickRandom(heavyPatterns);
      performSearch(pattern, 'heavy_filters');
      sleep(0.1); // Very quick between searches
    }

    // Wait before next iteration
    sleep(Math.random() * 3 + 2);
  });
}
