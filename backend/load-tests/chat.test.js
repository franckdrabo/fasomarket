// Load test for Real-time Chat (WebSocket via Socket.IO)
// Usage: k6 run chat.test.js
//
// Simulates multiple users:
// - Obtaining real JWT tokens via the auth API (sendOtp + verifyOtp)
// - Connecting to the chat server via WebSocket
// - Joining conversation rooms
// - Sending messages at different rates
//
// NOTE: Socket.IO uses the Engine.IO protocol on top of raw WebSocket.
// This test uses a simplified direct WebSocket connection that works
// with most Socket.IO v4 servers. If the connection fails, check:
// 1. The backend is running and the chat namespace is accessible
// 2. The JWT tokens are valid and the user has conversations
// 3. CORS settings allow the connection

import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import ws from 'k6/ws';
import http from 'k6/http';

// ─── Custom Metrics ────────────────────────────────────────────────────

const connectionDuration = new Trend('ws_connection_duration_ms');
const messageLatency = new Trend('ws_message_latency_ms');
const connectionErrorRate = new Rate('ws_connection_errors');
const messageErrorRate = new Rate('ws_message_errors');
const messagesSent = new Counter('messages_sent');
const messagesReceived = new Counter('messages_received');
const authDuration = new Trend('auth_duration_ms');
const authErrorRate = new Rate('auth_errors');

// ─── Test Options ──────────────────────────────────────────────────────

export const options = {
  scenarios: {
    normal_chat: {
      executor: 'constant-vus',
      vus: __ENV.K6_SMOKE ? 2 : 30,
      duration: __ENV.K6_SMOKE ? '30s' : '3m',
      exec: 'chatScenario',
    },

    heavy_chat: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: __ENV.K6_SMOKE
        ? [{ duration: '10s', target: 5 }]
        : [
            { duration: '30s', target: 50 },
            { duration: '1m', target: 100 },
            { duration: '30s', target: 200 },
            { duration: '1m', target: 200 },
            { duration: '30s', target: 50 },
          ],
      exec: 'chatScenario',
      startTime: '30s',
    },

    connection_storm: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: __ENV.K6_SMOKE ? 5 : 100,
      stages: __ENV.K6_SMOKE
        ? [{ duration: '10s', target: 5 }]
        : [
            { duration: '30s', target: 20 },
            { duration: '20s', target: 100 },
            { duration: '20s', target: 100 },
            { duration: '30s', target: 10 },
          ],
      exec: 'connectionScenario',
      startTime: '1m',
    },
  },

  thresholds: {
    'ws_connection_duration_ms': ['p(95)<2000', 'p(99)<5000'],
    'ws_message_latency_ms': ['p(95)<500', 'p(99)<1000'],
    'ws_connection_errors': ['rate<0.10'],
    'ws_message_errors': ['rate<0.05'],
    'auth_errors': ['rate<0.10'],
  },
};

// ─── Configuration ─────────────────────────────────────────────────────

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';
const AUTH_API = `${BASE_URL}/api/v1/auth`;

// Test phone numbers for load test users
// These must be pre-registered or the auth API must accept them
const TEST_PHONES = [
  '+22501000001', '+22501000002', '+22501000003', '+22501000004',
  '+22501000005', '+22501000006', '+22501000007', '+22501000008',
  '+22501000009', '+22501000010', '+22501000011', '+22501000012',
  '+22501000013', '+22501000014', '+22501000015', '+22501000016',
  '+22501000017', '+22501000018', '+22501000019', '+22501000020',
];

// ─── Auth Setup ───────────────────────────────────────────────────────

// Get a valid JWT token by calling the auth API
// In dev mode, the OTP is logged to console and we can use a known code
function obtainToken(phone) {
  const startTime = Date.now();

  // Step 1: Request OTP
  const otpResponse = http.post(`${AUTH_API}/send-otp`, JSON.stringify({ phone }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'send_otp' },
  });

  if (otpResponse.status !== 201 && otpResponse.status !== 200) {
    authErrorRate.add(1);
    authDuration.add(Date.now() - startTime);
    // Fallback: use a pre-configured token from env if available
    const envToken = __ENV[`TOKEN_${phone.slice(-2)}`];
    if (envToken) return envToken;
    return null;
  }

  // Step 2: Verify OTP with the development OTP code
  // In development, the backend logs the OTP and often uses '000000' or '123456'
  const verifyResponse = http.post(`${AUTH_API}/verify-otp`, JSON.stringify({
    phone,
    code: '123456', // Dev OTP code (adjust based on backend config)
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'verify_otp' },
  });

  authDuration.add(Date.now() - startTime);

  if (verifyResponse.status !== 200 && verifyResponse.status !== 201) {
    authErrorRate.add(1);
    // Try alternate dev codes
    const altCodes = ['000000', '111111', '999999'];
    for (const code of altCodes) {
      const retry = http.post(`${AUTH_API}/verify-otp`, JSON.stringify({ phone, code }), {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'verify_otp_retry' },
      });
      if (retry.status === 200 || retry.status === 201) {
        const body = JSON.parse(retry.body);
        authErrorRate.add(0);
        return body.accessToken || body.token;
      }
    }
    return null;
  }

  authErrorRate.add(0);
  const body = JSON.parse(verifyResponse.body);
  return body.accessToken || body.token;
}

function getPhoneForVu(vuId) {
  return TEST_PHONES[vuId % TEST_PHONES.length];
}

// ─── Socket.IO helpers ──────────────────────────────────────────────────

function createSioPacket(type, data) {
  if (type === 'connect') return '40'; // Socket.IO connect packet for default namespace
  if (type === 'event') return `42${JSON.stringify(data)}`;
  if (type === 'ping') return '2';
  return '';
}

function parseSioPacket(message) {
  if (message === '40' || message.startsWith('40{')) return { type: 'connected' };
  if (message === '3') return { type: 'pong' };
  if (message.startsWith('42')) {
    try {
      const data = JSON.parse(message.substring(2));
      return { type: 'event', event: data[0], data: data[1] };
    } catch (e) {
      return { type: 'unknown', raw: message };
    }
  }
  if (message.startsWith('0')) return { type: 'open' };
  return { type: 'unknown', raw: message };
}

// ─── Chat Message Templates ────────────────────────────────────────────

const messageTemplates = [
  'Bonjour, toujours disponible ?',
  'Oui, je suis interessé par cet article.',
  'Pouvez-vous me donner plus d\'informations ?',
  'Quel est le meilleur prix ?',
  'Je peux passer le voir aujourd\'hui ?',
  'Merci pour votre réponse rapide !',
  'Est-ce que la livraison est possible ?',
  'Je suis à Abidjan, on peut se rencontrer.',
  'D\'accord, je prends !',
  'Pouvez-vous reduire le prix ?',
  'Super, merci beaucoup !',
  'Je vous confirme la transaction.',
];

function getRandomMessage() {
  return messageTemplates[Math.floor(Math.random() * messageTemplates.length)];
}

function getRandomConversationId(vuId) {
  // Utiliser les IDs de conversation réels si fournis par l'env
  const envConvs = (__ENV.K6_CONVERSATION_IDS || '').split(',').filter(Boolean);
  if (envConvs.length > 0) {
    return envConvs[vuId % envConvs.length];
  }
  // Fallback: IDs prévisibles (doivent correspondre à ce que le seed a créé)
  const convIndex = (vuId % 10) + 1;
  return `conv-loadtest-${convIndex}`;
}

// ─── Scenarios ─────────────────────────────────────────────────────────

export function setup() {
  // Pre-obtain tokens for all test users
  const tokens = {};
  for (const phone of TEST_PHONES) {
    const token = obtainToken(phone);
    if (token) tokens[phone] = token;
  }
  return { tokens };
}

export function chatScenario(data) {
  const vuId = __VU;
  const phone = getPhoneForVu(vuId);
  const token = (data && data.tokens && data.tokens[phone]) || __ENV.JWT_TOKEN;

  if (!token) {
    group(`Chat User ${vuId} — Auth Failed`, () => {
      connectionErrorRate.add(1, { reason: 'no_token' });
      console.warn(`[VU ${vuId}] Aucun token disponible pour ${phone}. Ignorer le scénario de chat.`);
    });
    return;
  }

  const conversationId = getRandomConversationId(vuId);
  const url = `${WS_URL}/chat?token=${token}&EIO=4&transport=websocket`;

  group(`Chat User ${vuId}`, () => {
    const startTime = Date.now();

    const res = ws.connect(url, {
      headers: { 'User-Agent': 'k6-loadtest' },
    }, function (socket) {
      socket.on('open', function () {
        connectionDuration.add(Date.now() - startTime);
        socket.send(createSioPacket('connect'));
        socket.send(createSioPacket('event', ['joinConversation', { conversationId }]));
      });

      socket.on('message', function (data) {
        const packet = parseSioPacket(data);
        if (packet.type === 'event') {
          messagesReceived.add(1);
        }
      });

      // Send messages at human-like intervals
      const numMessages = Math.floor(Math.random() * 5) + 2;
      for (let i = 0; i < numMessages; i++) {
        socket.send(createSioPacket('event', [
          'sendMessage',
          { conversationId, contenu: getRandomMessage() },
        ]));
        messagesSent.add(1);
        sleep(Math.random() * 3 + 1);
      }

      socket.send(createSioPacket('ping'));
      sleep(5);
    });

    connectionErrorRate.add(res.status !== 101);
    check(res, { 'WebSocket connected': (r) => r.status === 101 });
  });
}

export function connectionScenario(data) {
  const vuId = __VU + 1000;
  const phone = getPhoneForVu(vuId);
  const token = (data && data.tokens && data.tokens[phone]) || __ENV.JWT_TOKEN;

  if (!token) {
    connectionErrorRate.add(1, { reason: 'no_token' });
    return;
  }

  const conversationId = `conv-loadtest-${(vuId % 20) + 1}`;
  const url = `${WS_URL}/chat?token=${token}&EIO=4&transport=websocket`;

  group(`Connection Storm ${vuId}`, () => {
    const startTime = Date.now();
    const res = ws.connect(url, {
      headers: { 'User-Agent': 'k6-loadtest' },
    }, function (socket) {
      socket.on('open', function () {
        connectionDuration.add(Date.now() - startTime);
        socket.send(createSioPacket('connect'));
        socket.send(createSioPacket('event', [
          'sendMessage',
          { conversationId, contenu: 'Test de connexion rapide' },
        ]));
        messagesSent.add(1);
      });
      sleep(2);
    });

    connectionErrorRate.add(res.status !== 101);
    check(res, { 'Connection storm established': (r) => r.status === 101 });
  });
}
