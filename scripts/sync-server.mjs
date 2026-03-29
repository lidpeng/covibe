#!/usr/bin/env node
/**
 * Harness Team Sync Server
 *
 * WebSocket 服务器，用于多人 vibe coding 实时同步。
 * 使用 ws 库处理 WebSocket 协议。
 *
 * 用法:
 *   node sync-server.mjs                    # 默认端口 3456
 *   node sync-server.mjs --port 8080        # 指定端口
 *   node sync-server.mjs --project myproj   # 指定项目名
 */

import { createServer } from 'http';
import { createRequire } from 'module';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const require = createRequire(import.meta.url);
const { WebSocketServer } = require('ws');

// ── 配置 ──
const args = process.argv.slice(2);
const PORT = parseInt(getArg('--port', '3456'));
const PROJECT = getArg('--project', 'default');
const LOG_DIR = getArg('--log-dir', '.teamwork/live');
const TOKEN = getArg('--token', '');

function getArg(name, defaultVal) {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

// ── 状态 ──
const clients = new Map();       // ws -> { name, joinedAt, lastActivity }
const activeEdits = new Map();   // filePath -> { editor, since }
const memberNames = new Set();
const httpMembers = new Map();
const recentMessages = [];
const MAX_RECENT = 100;
const MAX_POST_BODY = 100 * 1024;
const HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000;

// ── 日志 ──
function logSync(msg) {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    const line = JSON.stringify({ ...msg, server_ts: new Date().toISOString() }) + '\n';
    appendFileSync(join(LOG_DIR, 'sync.jsonl'), line);
  } catch {}
}

// ── 发送与广播 ──
function send(ws, data) {
  try {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    if (ws.readyState === 1) ws.send(msg);
  } catch {}
}

function broadcastAll(msg, excludeWs = null) {
  const data = JSON.stringify(msg);
  for (const [ws] of clients) {
    if (ws !== excludeWs && ws.readyState === 1) {
      try { ws.send(data); } catch {}
    }
  }
  recentMessages.push(msg);
  if (recentMessages.length > MAX_RECENT) recentMessages.shift();
  logSync(msg);
}

// ── 消息处理 ──
function handleMessage(ws, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  const client = clients.get(ws);
  if (client) client.lastActivity = Date.now();
  const ts = new Date().toISOString();

  switch (msg.type) {
    case 'join': {
      clients.set(ws, { name: msg.name, joinedAt: ts, lastActivity: Date.now() });
      memberNames.add(msg.name);
      const members = [...memberNames];
      send(ws, { type: 'members', members, project: PROJECT });
      send(ws, { type: 'catchup', messages: recentMessages.slice(-20) });
      const edits = Object.fromEntries(activeEdits);
      send(ws, { type: 'active_edits', edits });
      broadcastAll({ type: 'joined', name: msg.name, ts }, ws);
      console.log(`+ ${msg.name} joined (${clients.size} online)`);
      break;
    }

    case 'editing': {
      if (!client) return;
      const file = msg.file;
      const existing = activeEdits.get(file);
      if (existing && existing.editor !== client.name) {
        send(ws, {
          type: 'conflict', file,
          other_editor: existing.editor, since: existing.since,
          message: `\u26A0\uFE0F ${existing.editor} 正在编辑 ${file}，注意协调！`
        });
        for (const [s, c] of clients) {
          if (c.name === existing.editor) {
            send(s, {
              type: 'conflict', file,
              other_editor: client.name, since: ts,
              message: `\u26A0\uFE0F ${client.name} 也开始编辑 ${file}，注意协调！`
            });
          }
        }
      }
      activeEdits.set(file, { editor: client.name, since: ts });
      broadcastAll({ type: 'editing', name: client.name, file, ts }, ws);
      break;
    }

    case 'done_editing': {
      if (!client) return;
      activeEdits.delete(msg.file);
      broadcastAll({ type: 'done_editing', name: client.name, file: msg.file, ts }, ws);
      break;
    }

    case 'decision': {
      if (!client) return;
      broadcastAll({
        type: 'decision', name: client.name,
        decision_key: msg.decision_key, what: msg.what, why: msg.why,
        decision_type: msg.decision_type || 'human', ts
      });
      console.log(`\uD83D\uDCCB ${client.name} decision: ${msg.what}`);
      break;
    }

    case 'experience': {
      if (!client) return;
      broadcastAll({
        type: 'experience', name: client.name,
        content: msg.content, category: msg.category, tags: msg.tags || [], ts
      });
      console.log(`\uD83D\uDCA1 ${client.name} experience: ${msg.content}`);
      break;
    }

    case 'broadcast': {
      if (!client) return;
      broadcastAll({
        type: 'team_broadcast', name: client.name,
        content: msg.content, priority: msg.priority || 'normal', ts
      });
      console.log(`\uD83D\uDCE2 ${client.name}: ${msg.content}`);
      break;
    }

    case 'heartbeat': {
      if (client) client.lastActivity = Date.now();
      send(ws, { type: 'heartbeat_ack', ts });
      break;
    }
  }
}

// ── HTTP 服务器（REST API）──
const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Covibe-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;
  if (TOKEN && pathname !== '/') {
    const authHeader = req.headers['x-covibe-token'] || new URL(req.url, `http://localhost:${PORT}`).searchParams.get('token');
    if (authHeader !== TOKEN) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '\uD83D\uDD12 Token 不对哦～请检查 HARNESS_SYNC_TOKEN' }));
      return;
    }
  }

  if (req.method === 'GET' && pathname === '/status') {
    const members = [...memberNames];
    const edits = Object.fromEntries(activeEdits);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ project: PROJECT, members, active_edits: edits, online: members.length }));
    return;
  }

  if (req.method === 'GET' && pathname === '/since') {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const since = url.searchParams.get('ts') || '';
    const msgs = recentMessages.filter(m => !since || m.ts > since);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: msgs }));
    return;
  }

  if (req.method === 'POST' && pathname === '/broadcast') {
    let body = '';
    let bodySize = 0;
    req.on('data', chunk => {
      bodySize += chunk.length;
      if (bodySize > MAX_POST_BODY) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body exceeds 100KB limit' }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (bodySize > MAX_POST_BODY) return;
      try {
        const msg = JSON.parse(body);
        const ts = new Date().toISOString();
        const full = { ...msg, ts, source: 'http' };
        if (msg.type === 'editing' && msg.name && msg.file) {
          activeEdits.set(msg.file, { editor: msg.name, since: ts });
        }
        if (msg.type === 'done_editing' && msg.file) {
          activeEdits.delete(msg.file);
        }
        if (msg.type === 'joined' && msg.name) {
          if (!memberNames.has(msg.name)) {
            httpMembers.set(msg.name, { joinedAt: ts, lastActivity: Date.now() });
            memberNames.add(msg.name);
          } else if (httpMembers.has(msg.name)) {
            httpMembers.get(msg.name).lastActivity = Date.now();
          }
        }
        if (msg.type === 'left' && msg.name) {
          httpMembers.delete(msg.name);
          for (const [s, c] of clients) { if (c.name === msg.name) { clients.delete(s); break; } }
          memberNames.delete(msg.name);
          for (const [f, e] of activeEdits) { if (e.editor === msg.name) activeEdits.delete(f); }
        }
        broadcastAll(full);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`Harness Sync Server | Project: ${PROJECT} | Online: ${clients.size}\nWS: ws://localhost:${PORT}\nAPI: GET /status, GET /since?ts=, POST /broadcast`);
});

// ── WebSocket 服务器（ws 库）──
const wss = new WebSocketServer({
  server,
  verifyClient: TOKEN ? (info, cb) => {
    const url = new URL(info.req.url, `http://localhost:${PORT}`);
    if (url.searchParams.get('token') !== TOKEN) {
      cb(false, 401, 'Unauthorized');
      console.log('\uD83D\uDD12 拒绝了一个无效 token 的连接');
    } else {
      cb(true);
    }
  } : undefined
});

wss.on('connection', (ws, req) => {
  ws.on('message', (data) => {
    handleMessage(ws, data.toString());
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      for (const [file, edit] of activeEdits) {
        if (edit.editor === client.name) activeEdits.delete(file);
      }
      if (!httpMembers.has(client.name)) {
        memberNames.delete(client.name);
      }
      broadcastAll({ type: 'left', name: client.name, ts: new Date().toISOString() });
      console.log(`- ${client.name} left (${clients.size - 1} online)`);
    }
    clients.delete(ws);
  });

  ws.on('error', () => {
    clients.delete(ws);
  });
});

// ── 心跳超时清理 ──
const HEARTBEAT_INTERVAL = setInterval(() => {
  const now = Date.now();

  for (const [ws, client] of clients) {
    if (client.lastActivity && (now - client.lastActivity) > HEARTBEAT_TIMEOUT_MS) {
      console.log(`\u23F0 ${client.name} timed out (idle > 2min)`);
      for (const [file, edit] of activeEdits) {
        if (edit.editor === client.name) activeEdits.delete(file);
      }
      if (!httpMembers.has(client.name)) {
        memberNames.delete(client.name);
      }
      broadcastAll({ type: 'left', name: client.name, ts: new Date().toISOString(), reason: 'timeout' });
      clients.delete(ws);
      try { ws.close(); } catch {}
    }
  }

  for (const [name, info] of httpMembers) {
    if ((now - info.lastActivity) > HEARTBEAT_TIMEOUT_MS) {
      console.log(`\u23F0 HTTP member ${name} expired (idle > 2min)`);
      httpMembers.delete(name);
      const hasWsClient = [...clients.values()].some(c => c.name === name);
      if (!hasWsClient) {
        memberNames.delete(name);
      }
      for (const [file, edit] of activeEdits) {
        if (edit.editor === name) activeEdits.delete(file);
      }
      broadcastAll({ type: 'left', name, ts: new Date().toISOString(), reason: 'timeout' });
    }
  }
}, 30_000);
HEARTBEAT_INTERVAL.unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551  \uD83D\uDD17 Harness Team Sync Server                \u2551
\u2551                                              \u2551
\u2551  Project:  ${PROJECT.padEnd(33)}\u2551
\u2551  WebSocket: ws://0.0.0.0:${String(PORT).padEnd(20)}\u2551
\u2551  REST API:  http://0.0.0.0:${String(PORT).padEnd(18)}\u2551
\u2551                                              \u2551
\u2551  Endpoints:                                  \u2551
\u2551    GET  /status     \u2014 \u5728\u7EBF\u6210\u5458\u548C\u7F16\u8F91\u72B6\u6001     \u2551
\u2551    GET  /since?ts=  \u2014 \u83B7\u53D6\u65B0\u6D88\u606F             \u2551
\u2551    POST /broadcast  \u2014 \u5E7F\u64AD\u6D88\u606F\uFF08\u7ED9 Hook \u7528\uFF09 \u2551
\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D
  `);
});
