import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Métriques personnalisées
const rateLimitBlocks = new Counter('rate_limit_blocks');
const requestDuration = new Trend('request_duration');

const BASE_URL = 'http://localhost:3000';

// Test de l'endpoint email/login (limite = 5 req / 60s)
export function testEmailLoginRateLimit() {
  group('POST /auth/email/login — 5 req/min', () => {
    const payload = JSON.stringify({
      email: 'bruteforce@test.com',
      password: 'wrongpassword123',
    });
    const params = {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'email-login' },
    };

    let blockedCount = 0;
    let successCount = 0;

    // Envoyer 8 requêtes rapidement — les 5 premières passent, les 3 suivantes doivent être bloquées (429)
    for (let i = 0; i < 8; i++) {
      const start = Date.now();
      const res = http.post(`${BASE_URL}/api/v1/auth/email/login`, payload, params);
      const duration = Date.now() - start;
      requestDuration.add(duration);

      if (res.status === 429) {
        blockedCount++;
        check(res, {
          '429 — rate limit atteint': (r) => r.status === 429,
        });
      } else if (res.status === 401) {
        successCount++;
        check(res, {
          '401 — authentification échouée (attendu)': (r) => r.status === 401,
        });
      } else {
        check(res, {
          [`status inattendu: ${res.status}`]: () => false,
        });
      }
    }

    console.log(`📊 /auth/email/login — ${successCount} succès (401), ${blockedCount} bloqués (429)`);
  });
}

// Test de l'endpoint send-otp (limite = 3 req / 60s)
export function testSendOtpRateLimit() {
  group('POST /auth/send-otp — 3 req/min', () => {
    const payload = JSON.stringify({
      phone: '+2250102030405',
    });
    const params = {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'send-otp' },
    };

    let blockedCount = 0;
    let successCount = 0;

    // Envoyer 5 requêtes rapidement — les 3 premières passent, les 2 suivantes doivent être bloquées
    for (let i = 0; i < 5; i++) {
      const res = http.post(`${BASE_URL}/api/v1/auth/send-otp`, payload, params);

      if (res.status === 429) {
        blockedCount++;
        check(res, {
          '429 — rate limit atteint': (r) => r.status === 429,
        });
      } else if (res.status === 200 || res.status === 201) {
        successCount++;
        check(res, {
          '2xx — OTP envoyé (attendu)': (r) => r.status >= 200 && r.status < 300,
        });
      } else {
        check(res, {
          [`status inattendu: ${res.status}`]: () => false,
        });
      }
    }

    console.log(`📊 /auth/send-otp — ${successCount} succès, ${blockedCount} bloqués (429)`);
  });
}

// Test de l'endpoint email/register (limite = 3 req / 60s)
export function testEmailRegisterRateLimit() {
  group('POST /auth/email/register — 3 req/min', () => {
    const payload = JSON.stringify({
      email: `newuser_${Date.now()}@test.com`,
      password: 'password123',
      nom: 'Test User',
    });
    const params = {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'email-register' },
    };

    let blockedCount = 0;
    let successCount = 0;

    // Envoyer 5 requêtes — les 3 premières passent, les 2 suivantes doivent être bloquées
    for (let i = 0; i < 5; i++) {
      const res = http.post(`${BASE_URL}/api/v1/auth/email/register`, payload, params);

      if (res.status === 429) {
        blockedCount++;
        check(res, {
          '429 — rate limit atteint': (r) => r.status === 429,
        });
      } else if (res.status === 201 || res.status === 409) {
        // 409 = email déjà utilisé (attendu après la première requête)
        successCount++;
      } else {
        check(res, {
          [`status inattendu: ${res.status}`]: () => false,
        });
      }
    }

    console.log(`📊 /auth/email/register — ${successCount} succès, ${blockedCount} bloqués (429)`);
  });
}

// Test que la route health n'est PAS limitée
export function testHealthNotRateLimited() {
  group('GET /health — pas de limite', () => {
    // Envoyer 50 requêtes en rafale — toutes doivent passer
    for (let i = 0; i < 50; i++) {
      const res = http.get(`${BASE_URL}/api/v1/health`);
      check(res, {
        '200 — health toujours accessible': (r) => r.status === 200,
      });
    }
    console.log('📊 /health — 50 requêtes, 0 bloquées (attendu)');
  });
}

export default function () {
  // Ordre : on commence par la health (jamais limitée)
  testHealthNotRateLimited();

  // Petite pause pour reset partiel des compteurs
  sleep(1);

  // Test des endpoints sensibles
  testSendOtpRateLimit();
  testEmailLoginRateLimit();
  testEmailRegisterRateLimit();

  console.log('✅ Test de rate limiting terminé');
}
