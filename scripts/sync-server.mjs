#!/usr/bin/env node
/**
 * Harness Team Sync Server
 * 
 * 轻量级 WebSocket 服务器，用于多人 vibe coding 实时同步。
 * 零外部依赖（使用 Node.js 内置模块）。
 * 
 * 用法:
 *   node sync-server.mjs                    # 默认端口 3456
 *   node sync-server.mjs --port 8080        # 指定端口
 *   node sync-server.mjs --project myproj   # 指定项目名
 * 
 * 消息类型:
 *   join        - 成员加入
 *   leave       - 成员离开
 *   editing     - 正在编辑某文件
 *   decision    - 做了一个决策
 *   experience  - 新增团队经验
 *   broadcast   - 广播消息
 *   conflict    - 文件编辑冲突警告（服务端自动生成）
 *   heartbeat   - 心跳保活
 */

import { createServer } from 'http';
import { createHash } from 'crypto';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ── 配置 ──
const args = process.argv.slice(2);
const PORT = parseInt(getArg('--port', '3456'));
const PROJECT = getArg('--project', 'default');
const LOG_DIR = getArg('--log-dir', '.teamwork/live');
const TOKEN = getArg('--token', '');  // 为空则不校验

function getArg(name, defaultVal) {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

// ── 状态 ──
const clients = new Map();       // ws -> { name, joinedAt }
const activeEdits = new Map();   // filePath -> { editor, since }
const recentMessages = [];       // 最近 100 条消息（新成员 catch-up）
const MAX_RECENT = 100;

// ── 日志 ──
function logSync(msg) {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    const line = JSON.stringify({ ...msg, server_ts: new Date().toISOString() }) + '\n';
    appendFileSync(join(LOG_DIR, 'sync.jsonl'), line);
  } catch {}
}

// ── WebSocket 握手 ──
function acceptWebSocket(req, socket) {
  const key = req.headers['sec-websocket-key'];
  const accept = createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-5AB9DC65B375')
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  return socket;
}

// ── WebSocket 帧编解码 ──
function decodeFrame(buffer) {
  if (buffer.length < 2) return null;
  const opcode = buffer[0] & 0x0f;
  if (opcode === 0x08) return { opcode, data: '' }; // close
  if (opcode === 0x09) return { opcode, data: '' }; // ping
  if (opcode === 0x0a) return { opcode, data: '' }; // pong

  const masked = (buffer[1] & 0x80) !== 0;
  let payloadLen = buffer[1] & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    payloadLen = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    payloadLen = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  let mask = null;
  if (masked) {
    mask = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  const payload = buffer.slice(offset, offset + payloadLen);
  if (mask) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= mask[i % 4];
    }
  }

  return { opcode, data: payload.toString('utf8') };
}

function encodeFrame(data) {
  const payload = Buffer.from(data, 'utf8');
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // text frame, FIN
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}

function send(socket, data) {
  try {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    socket.write(encodeFrame(msg));
  } catch {}
}

function broadcastAll(msg, excludeSocket = null) {
  const data = JSON.stringify(msg);
  for (const [socket] of clients) {
    if (socket !== excludeSocket) {
      try { socket.write(encodeFrame(data)); } catch {}
    }
  }
  recentMessages.push(msg);
  if (recentMessages.length > MAX_RECENT) recentMessages.shift();
  logSync(msg);
}

// ── 消息处理 ──
function handleMessage(socket, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  const client = clients.get(socket);
  const ts = new Date().toISOString();

  switch (msg.type) {
    case 'join': {
      clients.set(socket, { name: msg.name, joinedAt: ts });
      // 发送当前在线成员列表
      const members = [...clients.values()].map(c => c.name);
      send(socket, { type: 'members', members, project: PROJECT });
      // 发送最近消息用于 catch-up
      send(socket, { type: 'catchup', messages: recentMessages.slice(-20) });
      // 发送当前编辑状态
      const edits = Object.fromEntries(activeEdits);
      send(socket, { type: 'active_edits', edits });
      // 广播有人加入
      broadcastAll({ type: 'joined', name: msg.name, ts }, socket);
      console.log(`+ ${msg.name} joined (${clients.size} online)`);
      break;
    }

    case 'editing': {
      if (!client) return;
      const file = msg.file;
      const existing = activeEdits.get(file);
      // 冲突检测：有别人在编辑同一文件
      if (existing && existing.editor !== client.name) {
        send(socket, {
          type: 'conflict',
          file,
          other_editor: existing.editor,
          since: existing.since,
          message: `⚠️ ${existing.editor} 正在编辑 ${file}，注意协调！`
        });
        // 也通知对方
        for (const [s, c] of clients) {
          if (c.name === existing.editor) {
            send(s, {
              type: 'conflict',
              file,
              other_editor: client.name,
              since: ts,
              message: `⚠️ ${client.name} 也开始编辑 ${file}，注意协调！`
            });
          }
        }
      }
      activeEdits.set(file, { editor: client.name, since: ts });
      broadcastAll({ type: 'editing', name: client.name, file, ts }, socket);
      break;
    }

    case 'done_editing': {
      if (!client) return;
      activeEdits.delete(msg.file);
      broadcastAll({ type: 'done_editing', name: client.name, file: msg.file, ts }, socket);
      break;
    }

    case 'decision': {
      if (!client) return;
      broadcastAll({
        type: 'decision',
        name: client.name,
        decision_key: msg.decision_key,
        what: msg.what,
        why: msg.why,
        decision_type: msg.decision_type || 'human',
        ts
      });
      console.log(`📋 ${client.name} decision: ${msg.what}`);
      break;
    }

    case 'experience': {
      if (!client) return;
      broadcastAll({
        type: 'experience',
        name: client.name,
        content: msg.content,
        category: msg.category,
        tags: msg.tags || [],
        ts
      });
      console.log(`💡 ${client.name} experience: ${msg.content}`);
      break;
    }

    case 'broadcast': {
      if (!client) return;
      broadcastAll({
        type: 'team_broadcast',
        name: client.name,
        content: msg.content,
        priority: msg.priority || 'normal',
        ts
      });
      console.log(`📢 ${client.name}: ${msg.content}`);
      break;
    }

    case 'heartbeat': {
      send(socket, { type: 'heartbeat_ack', ts });
      break;
    }
  }
}

// ── HTTP + WebSocket 服务器 ──
const server = createServer((req, res) => {
  // Token 校验中间件
  if (TOKEN) {
    const authHeader = req.headers['x-covibe-token'] || new URL(req.url, `http://localhost:${PORT}`).searchParams.get('token');
    if (authHeader !== TOKEN && req.headers.upgrade?.toLowerCase() !== 'websocket') {
      // REST API 需要 token
      if (req.url !== '/' && !req.url.startsWith('/?')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '🔒 Token 不对哦～请检查 HARNESS_SYNC_TOKEN' }));
        return;
      }
    }
  }

  // REST API 端点（给 Hook 用 curl 调用）
  if (req.method === 'GET' && req.url === '/status') {
    const members = [...clients.values()].map(c => c.name);
    const edits = Object.fromEntries(activeEdits);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ project: PROJECT, members, active_edits: edits, online: clients.size }));
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/since')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const since = url.searchParams.get('ts') || '';
    const msgs = recentMessages.filter(m => !since || m.ts > since);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: msgs }));
    return;
  }

  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const msg = JSON.parse(body);
        broadcastAll({ ...msg, ts: new Date().toISOString(), source: 'http' });
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

server.on('upgrade', (req, socket) => {
  if (req.headers.upgrade?.toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }

  // WebSocket 连接时校验 token（通过 URL query）
  if (TOKEN) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.searchParams.get('token') !== TOKEN) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      console.log('🔒 拒绝了一个无效 token 的连接');
      return;
    }
  }

  acceptWebSocket(req, socket);

  let buffer = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const frame = decodeFrame(buffer);
      if (!frame) break;

      // 计算帧总长度并移除
      let frameLen = 2;
      const payloadLen = buffer[1] & 0x7f;
      const masked = (buffer[1] & 0x80) !== 0;
      if (payloadLen === 126) frameLen = 4;
      else if (payloadLen === 127) frameLen = 10;
      if (masked) frameLen += 4;
      const actualLen = payloadLen === 126 ? buffer.readUInt16BE(2) :
                        payloadLen === 127 ? Number(buffer.readBigUInt64BE(2)) : payloadLen;
      frameLen += actualLen;

      if (buffer.length < frameLen) break;
      buffer = buffer.slice(frameLen);

      if (frame.opcode === 0x08) { // close
        socket.end();
        return;
      }
      if (frame.opcode === 0x09) { // ping → pong
        const pong = Buffer.alloc(2);
        pong[0] = 0x8a; pong[1] = 0x00;
        socket.write(pong);
        continue;
      }
      if (frame.data) handleMessage(socket, frame.data);
    }
  });

  socket.on('close', () => {
    const client = clients.get(socket);
    if (client) {
      // 清理该成员的编辑状态
      for (const [file, edit] of activeEdits) {
        if (edit.editor === client.name) activeEdits.delete(file);
      }
      broadcastAll({ type: 'left', name: client.name, ts: new Date().toISOString() });
      console.log(`- ${client.name} left (${clients.size - 1} online)`);
    }
    clients.delete(socket);
  });

  socket.on('error', () => {
    clients.delete(socket);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  🔗 Harness Team Sync Server                ║
║                                              ║
║  Project:  ${PROJECT.padEnd(33)}║
║  WebSocket: ws://0.0.0.0:${String(PORT).padEnd(20)}║
║  REST API:  http://0.0.0.0:${String(PORT).padEnd(18)}║
║                                              ║
║  Endpoints:                                  ║
║    GET  /status     — 在线成员和编辑状态     ║
║    GET  /since?ts=  — 获取新消息             ║
║    POST /broadcast  — 广播消息（给 Hook 用） ║
╚═════════════════════════��════════════════════╝
  `);
});
