import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) app.use(express.static(distPath));

function toInt(v, fallback = 0) { const p = Number.parseInt(v, 10); return Number.isNaN(p) ? fallback : p; }
function escapeHtml(v = '') { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

const LOCK_EXPIRY_MINUTES = 10;
const sesClient = new SESClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const transporter = nodemailer.createTransport({ SES: { ses: sesClient, aws: { SendRawEmailCommand } } });

// ── Audit helper ──────────────────────────────────────────────────
async function logAudit(username, action, details = '') {
  try {
    await pool.query(
      `INSERT INTO audit_log (username, action, details) VALUES ($1, $2, $3)`,
      [username || 'system', action, details]
    );
  } catch (err) { console.error('Audit log error:', err.message); }
}

// ── Admin check helper ────────────────────────────────────────────
async function isAdmin(username) {
  if (!username) return false;
  const r = await pool.query(`SELECT is_admin FROM users WHERE LOWER(username)=LOWER($1)`, [username]);
  return r.rows[0]?.is_admin === true;
}

async function initDB() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS sessions (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP`);
    await pool.query(`CREATE TABLE IF NOT EXISTS manifest (id SERIAL PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, case_id VARCHAR(255) NOT NULL, sku VARCHAR(255) NOT NULL, qty INTEGER NOT NULL, sort_group VARCHAR(255), dealer VARCHAR(255), done BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`ALTER TABLE manifest ADD COLUMN IF NOT EXISTS item_description TEXT`);
    await pool.query(`ALTER TABLE manifest ADD COLUMN IF NOT EXISTS actual_qty INTEGER`);
    await pool.query(`ALTER TABLE manifest ADD COLUMN IF NOT EXISTS remark TEXT`);
    await pool.query(`ALTER TABLE manifest ADD COLUMN IF NOT EXISTS scanned_by VARCHAR(100)`);
    await pool.query(`UPDATE manifest SET item_description='' WHERE item_description IS NULL`);
    await pool.query(`UPDATE manifest SET actual_qty=qty WHERE actual_qty IS NULL`);
    await pool.query(`UPDATE manifest SET remark='' WHERE remark IS NULL`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sku_locks (id SERIAL PRIMARY KEY, session_id INTEGER NOT NULL, case_id VARCHAR(255) NOT NULL, sku VARCHAR(255) NOT NULL, locked_by VARCHAR(255) NOT NULL, locked_at TIMESTAMP DEFAULT NOW(), UNIQUE(session_id,case_id,sku))`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_manifest_session ON manifest(session_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_manifest_case ON manifest(case_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sku_locks ON sku_locks(session_id,case_id,sku)`);
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(100) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`);
    await pool.query(`CREATE TABLE IF NOT EXISTS audit_log (id SERIAL PRIMARY KEY, username VARCHAR(100), action VARCHAR(100) NOT NULL, details TEXT, created_at TIMESTAMP DEFAULT NOW())`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC)`);
    console.log('✓ Database initialized');
  } catch (err) { console.error('Database init error:', err); }
}

async function purgeExpiredLocks() {
  await pool.query(`DELETE FROM sku_locks WHERE locked_at < NOW() - INTERVAL '${LOCK_EXPIRY_MINUTES} minutes'`);
}

async function buildExcel(session, items, total, completed, discrepancyCount, completionRate, actionBy = '') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Inbound Hub Scanner'; wb.created = new Date();

  const ws1 = wb.addWorksheet('Summary');
  ws1.columns = [{header:'Field',key:'field',width:28},{header:'Value',key:'value',width:30}];
  ws1.getRow(1).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0D1B4B'}};c.font={bold:true,color:{argb:'FFFFFFFF'},size:12};c.alignment={vertical:'middle',horizontal:'center'};c.border={bottom:{style:'medium',color:{argb:'FF00C9A7'}}};});
  ws1.getRow(1).height=24;
  const summaryRows=[
    {field:'Session Name',value:session.name},
    {field:'Date',value:new Date(session.created_at).toLocaleString()},
    {field:'Action By',value:actionBy||'—'},
    {field:'Total Items',value:total},
    {field:'Completed',value:completed},
    {field:'Incomplete',value:total-completed},
    {field:'Rows with Discrepancy',value:discrepancyCount},
    {field:'Completion Rate',value:`${completionRate}%`},
  ];
  summaryRows.forEach((row,i)=>{
    const r=ws1.addRow(row); r.height=20; r.getCell('field').font={bold:true};
    if(row.field==='Completion Rate') r.getCell('value').font={bold:true,size:14,color:{argb:completionRate===100?'FF008000':'FFD97706'}};
    if(row.field==='Completed') r.getCell('value').font={bold:true,color:{argb:'FF008000'}};
    if(row.field==='Incomplete') r.getCell('value').font={bold:true,color:{argb:'FFDC2626'}};
    if(row.field==='Action By') r.getCell('value').font={bold:true,color:{argb:'FF0D1B4B'}};
    if(i%2===0) r.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF8FAFB'}});
  });

  const ws2=wb.addWorksheet('Dealer Summary');
  ws2.columns=[{header:'Dealer',key:'dealer',width:28},{header:'Sort Group',key:'sort_group',width:16},{header:'Total Items',key:'total',width:14},{header:'Completed',key:'completed',width:14},{header:'Incomplete',key:'incomplete',width:14},{header:'Original Qty',key:'orig_qty',width:15},{header:'Actual Qty',key:'actual_qty',width:15},{header:'Discrepancy',key:'discrepancy',width:15}];
  ws2.getRow(1).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0D1B4B'}};c.font={bold:true,color:{argb:'FFFFFFFF'},size:11};c.alignment={vertical:'middle',horizontal:'center'};c.border={bottom:{style:'medium',color:{argb:'FF00C9A7'}}};});
  ws2.getRow(1).height=24;
  const dgm={};
  items.forEach(item=>{const k=`${item.dealer}||${item.sort_group}`;if(!dgm[k])dgm[k]={dealer:item.dealer,sort_group:item.sort_group,total:0,completed:0,orig_qty:0,actual_qty:0};dgm[k].total+=1;if(item.done)dgm[k].completed+=1;dgm[k].orig_qty+=toInt(item.qty);dgm[k].actual_qty+=toInt(item.actual_qty);});
  Object.values(dgm).sort((a,b)=>a.dealer.localeCompare(b.dealer)||a.sort_group.localeCompare(b.sort_group)).forEach((row,i)=>{
    const disc=row.actual_qty-row.orig_qty;
    const r=ws2.addRow({dealer:row.dealer,sort_group:row.sort_group,total:row.total,completed:row.completed,incomplete:row.total-row.completed,orig_qty:row.orig_qty,actual_qty:row.actual_qty,discrepancy:disc>0?`+${disc}`:disc});
    r.height=20;
    if(i%2===0)r.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF8FAFB'}});
    if(disc!==0)r.getCell('discrepancy').font={bold:true,color:{argb:disc>0?'FF1D4ED8':'FFDC2626'}};
  });

  const ws3=wb.addWorksheet('Detailed Items');
  ws3.columns=[{header:'Case ID',key:'case_id',width:18},{header:'SKU',key:'sku',width:18},{header:'Description',key:'item_description',width:32},{header:'Dealer',key:'dealer',width:26},{header:'Sort Group',key:'sort_group',width:14},{header:'Original Qty',key:'qty',width:14},{header:'Actual Qty',key:'actual_qty',width:13},{header:'Discrepancy',key:'discrepancy',width:14},{header:'Remark',key:'remark',width:24},{header:'Scanned By',key:'scanned_by',width:18},{header:'Status',key:'status',width:26}];
  ws3.getRow(1).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0D1B4B'}};c.font={bold:true,color:{argb:'FFFFFFFF'},size:11};c.alignment={vertical:'middle',horizontal:'center'};c.border={bottom:{style:'medium',color:{argb:'FF00C9A7'}}};});
  ws3.getRow(1).height=24;
  items.forEach(item=>{
    const disc=toInt(item.discrepancy_qty);
    const status=item.done?disc!==0?'✓ Completed with discrepancy':'✓ Completed':'✗ Incomplete';
    const r=ws3.addRow({case_id:item.case_id,sku:item.sku,item_description:item.item_description,dealer:item.dealer,sort_group:item.sort_group,qty:toInt(item.qty),actual_qty:toInt(item.actual_qty),discrepancy:disc>0?`+${disc}`:disc,remark:item.remark,scanned_by:item.scanned_by||'—',status});
    r.height=19;
    const bg=!item.done?'FFF8D7DA':disc!==0?'FFFFF3CD':'FFD4EDDA';
    r.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:bg}});
    if(disc!==0)r.getCell('discrepancy').font={bold:true,color:{argb:disc>0?'FF1D4ED8':'FFDC2626'}};
  });
  [ws2,ws3].forEach(ws=>ws.autoFilter={from:{row:1,column:1},to:{row:1,column:ws.columns.length}});
  return wb.xlsx.writeBuffer();
}

// ════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const result = await pool.query(
      `SELECT username, is_admin FROM users WHERE LOWER(username)=LOWER($1) AND password_hash=crypt($2,password_hash)`,
      [String(username).trim(), password]
    );
    if (result.rows.length === 0) {
      await logAudit(username, 'LOGIN_FAILED', `Failed login attempt for username: ${username}`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const row = result.rows[0];
    await logAudit(row.username, 'LOGIN', `User logged in`);
    res.json({ ok: true, username: row.username, is_admin: row.is_admin === true });
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Server error' }); }
});

// ════════════════════════════════════════════════════════════════════
// ADMIN — User Management
// ════════════════════════════════════════════════════════════════════
app.get('/api/admin/users', async (req, res) => {
  const requester = req.headers['x-username'];
  if (!await isAdmin(requester)) return res.status(403).json({ error: 'Admin access required' });
  try {
    const result = await pool.query(`SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/users', async (req, res) => {
  const requester = req.headers['x-username'];
  if (!await isAdmin(requester)) return res.status(403).json({ error: 'Admin access required' });
  const { username, password, is_admin } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, is_admin) VALUES ($1, crypt($2, gen_salt('bf')), $3) RETURNING id, username, is_admin, created_at`,
      [String(username).trim(), password, is_admin === true]
    );
    await logAudit(requester, 'USER_CREATED', `Created user: ${username}${is_admin?' (admin)':''}`);
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:username', async (req, res) => {
  const requester = req.headers['x-username'];
  if (!await isAdmin(requester)) return res.status(403).json({ error: 'Admin access required' });
  const target = req.params.username;
  if (target.toLowerCase() === requester.toLowerCase()) return res.status(400).json({ error: 'Cannot delete your own account' });
  try {
    const r = await pool.query(`DELETE FROM users WHERE LOWER(username)=LOWER($1) RETURNING username`, [target]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await logAudit(requester, 'USER_DELETED', `Deleted user: ${target}`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/admin/users/:username/password', async (req, res) => {
  const requester = req.headers['x-username'];
  if (!await isAdmin(requester)) return res.status(403).json({ error: 'Admin access required' });
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'New password required' });
  try {
    const r = await pool.query(
      `UPDATE users SET password_hash=crypt($1,gen_salt('bf')) WHERE LOWER(username)=LOWER($2) RETURNING username`,
      [password, req.params.username]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await logAudit(requester, 'PASSWORD_RESET', `Reset password for: ${req.params.username}`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
// AUDIT LOG
// ════════════════════════════════════════════════════════════════════
app.get('/api/audit', async (req, res) => {
  const requester = req.headers['x-username'];
  if (!await isAdmin(requester)) return res.status(403).json({ error: 'Admin access required' });
  try {
    const limit = toInt(req.query.limit, 100);
    const result = await pool.query(
      `SELECT id, username, action, details, created_at FROM audit_log ORDER BY created_at DESC LIMIT $1`,
      [Math.min(limit, 500)]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
// LOCKS
// ════════════════════════════════════════════════════════════════════
app.post('/api/lock', async (req, res) => {
  const { session_id, case_id, sku, operator } = req.body;
  if (!session_id || !case_id || !sku || !operator) return res.status(400).json({ error: 'session_id, case_id, sku, operator required' });
  try {
    await purgeExpiredLocks();
    const existing = await pool.query(`SELECT locked_by, locked_at FROM sku_locks WHERE session_id=$1 AND case_id=$2 AND sku=$3`, [session_id, case_id, sku]);
    if (existing.rows.length > 0) {
      const lock = existing.rows[0];
      if (lock.locked_by === operator) { await pool.query(`UPDATE sku_locks SET locked_at=NOW() WHERE session_id=$1 AND case_id=$2 AND sku=$3`, [session_id, case_id, sku]); return res.json({ ok: true, locked_by: operator }); }
      return res.status(409).json({ error: 'locked', locked_by: lock.locked_by, locked_at: lock.locked_at });
    }
    await pool.query(`INSERT INTO sku_locks (session_id,case_id,sku,locked_by) VALUES ($1,$2,$3,$4)`, [session_id, case_id, sku, operator]);
    res.json({ ok: true, locked_by: operator });
  } catch (err) { console.error('Lock error:', err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/lock', async (req, res) => {
  const { session_id, case_id, sku, operator } = req.body;
  if (!session_id || !case_id || !sku || !operator) return res.status(400).json({ error: 'session_id, case_id, sku, operator required' });
  try { await pool.query(`DELETE FROM sku_locks WHERE session_id=$1 AND case_id=$2 AND sku=$3 AND locked_by=$4`, [session_id, case_id, sku, operator]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/lock/operator/:operator', async (req, res) => {
  try { await pool.query(`DELETE FROM sku_locks WHERE locked_by=$1`, [req.params.operator]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/lock/operator/:operator/release', async (req, res) => {
  try { await pool.query(`DELETE FROM sku_locks WHERE locked_by=$1`, [req.params.operator]); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
// SESSIONS
// ════════════════════════════════════════════════════════════════════
app.get('/api/sessions', async (req, res) => {
  try { const result = await pool.query('SELECT * FROM sessions ORDER BY created_at DESC'); res.json(result.rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sessions', upload.single('file'), async (req, res) => {
  try {
    const { name, uploaded_by } = req.body;
    if (!name || !req.file) return res.status(400).json({ error: 'Name and CSV file required' });
    const csvText = req.file.buffer.toString('utf-8');
    const records = parse(csvText, { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true });
    const preparedRecords = records.map((record) => {
      const parsedQty = Number.parseInt(record.qty, 10);
      if (!record.case_id || !record.sku || Number.isNaN(parsedQty)) return null;
      return { case_id: String(record.case_id).trim(), sku: String(record.sku).trim(), item_description: String(record.item_description ?? record.description ?? '').trim(), qty: parsedQty, sort_group: String(record.sort_group ?? '').trim(), dealer: String(record.dealer ?? '').trim(), actual_qty: parsedQty, remark: '' };
    }).filter(Boolean);
    if (preparedRecords.length === 0) return res.status(400).json({ error: 'No valid rows in CSV. Required columns: case_id, sku, qty' });
    const sessionResult = await pool.query('INSERT INTO sessions (name) VALUES ($1) RETURNING *', [name]);
    const sessionId = sessionResult.rows[0].id;
    for (const record of preparedRecords) {
      await pool.query(`INSERT INTO manifest (session_id,case_id,sku,item_description,qty,sort_group,dealer,actual_qty,remark) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [sessionId, record.case_id, record.sku, record.item_description, record.qty, record.sort_group, record.dealer, record.actual_qty, record.remark]);
    }
    await logAudit(uploaded_by || 'unknown', 'SESSION_CREATED', `Created session "${name}" with ${preparedRecords.length} rows (ID: ${sessionId})`);
    res.json({ id: sessionId, name, rowsInserted: preparedRecords.length });
  } catch (err) { console.error('Upload error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/sessions/:id', async (req, res) => {
  try { const result = await pool.query('SELECT * FROM sessions WHERE id=$1', [req.params.id]); if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' }); res.json(result.rows[0]); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// REOPEN SESSION
app.patch('/api/sessions/:id/reopen', async (req, res) => {
  const requester = req.body?.reopened_by;
  try {
    const sessionResult = await pool.query('SELECT * FROM sessions WHERE id=$1', [req.params.id]);
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    if (!sessionResult.rows[0].closed_at) return res.status(400).json({ error: 'Session is not closed' });
    await pool.query('UPDATE sessions SET closed_at=NULL WHERE id=$1', [req.params.id]);
    await logAudit(requester || 'unknown', 'SESSION_REOPENED', `Reopened session "${sessionResult.rows[0].name}" (ID: ${req.params.id})`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE SESSION
app.delete('/api/sessions/:id', async (req, res) => {
  const requester = req.headers['x-username'];
  if (!await isAdmin(requester)) return res.status(403).json({ error: 'Admin access required' });
  try {
    const sessionResult = await pool.query('SELECT name FROM sessions WHERE id=$1', [req.params.id]);
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const sessionName = sessionResult.rows[0].name;
    await pool.query('DELETE FROM sessions WHERE id=$1', [req.params.id]);
    await logAudit(requester, 'SESSION_DELETED', `Deleted session "${sessionName}" (ID: ${req.params.id})`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sessions/:id/cases', async (req, res) => {
  try { const result = await pool.query(`SELECT DISTINCT case_id FROM manifest WHERE session_id=$1 ORDER BY case_id`, [req.params.id]); res.json(result.rows.map(r => r.case_id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sessions/:id/case/:caseId/skus', async (req, res) => {
  try {
    await purgeExpiredLocks();
    const result = await pool.query(
      `SELECT m.sku, COUNT(*) AS total, SUM(CASE WHEN m.done THEN 1 ELSE 0 END) AS completed, SUM(m.qty) AS total_qty, COUNT(DISTINCT m.sort_group) AS sort_group_count, l.locked_by, l.locked_at
       FROM manifest m LEFT JOIN sku_locks l ON l.session_id=m.session_id AND l.case_id=m.case_id AND l.sku=m.sku
       WHERE m.session_id=$1 AND m.case_id=$2 GROUP BY m.sku,l.locked_by,l.locked_at ORDER BY m.sku`,
      [req.params.id, req.params.caseId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
    res.json(result.rows.map((row) => { const total=toInt(row.total),completed=toInt(row.completed); return { sku:row.sku, total, completed, total_qty:toInt(row.total_qty), sort_group_count:toInt(row.sort_group_count), percentage:total>0?Math.round((completed/total)*100):0, locked_by:row.locked_by||null, locked_at:row.locked_at||null }; }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sessions/:id/case/:caseId/sku/:sku', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, dealer, sort_group, qty, COALESCE(item_description,'') AS item_description, COALESCE(actual_qty,qty) AS actual_qty, COALESCE(actual_qty,qty)-qty AS discrepancy_qty, COALESCE(remark,'') AS remark, COALESCE(scanned_by,'') AS scanned_by, done FROM manifest WHERE session_id=$1 AND case_id=$2 AND sku=$3 ORDER BY id`, [req.params.id, req.params.caseId, req.params.sku]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'SKU not found' });
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/manifest/:id/done', async (req, res) => {
  try {
    const { actual_qty, remark, done, scanned_by } = req.body || {};
    let parsedActualQty = null;
    if (actual_qty !== undefined && actual_qty !== null && actual_qty !== '') {
      parsedActualQty = Number.parseInt(actual_qty, 10);
      if (Number.isNaN(parsedActualQty) || parsedActualQty < 0) return res.status(400).json({ error: 'actual_qty must be a valid non-negative integer' });
    }
    const result = await pool.query(
      `UPDATE manifest SET done=COALESCE($2,done), actual_qty=COALESCE($3,actual_qty,qty), remark=COALESCE($4,remark,''), scanned_by=COALESCE($5,scanned_by)
       WHERE id=$1 RETURNING id, dealer, sort_group, qty, COALESCE(item_description,'') AS item_description, COALESCE(actual_qty,qty) AS actual_qty, COALESCE(actual_qty,qty)-qty AS discrepancy_qty, COALESCE(remark,'') AS remark, COALESCE(scanned_by,'') AS scanned_by, done`,
      [req.params.id, done === undefined ? null : Boolean(done), parsedActualQty, remark === undefined ? null : String(remark).trim(), scanned_by || null]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Row not found' });
    if (done && scanned_by) {
      await logAudit(scanned_by, 'ITEM_SCANNED', `Marked item ID ${req.params.id} done (dealer: ${result.rows[0].dealer}, sku: ${result.rows[0].sku || ''})`);
    }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sessions/:id/progress', async (req, res) => {
  try {
    const result = await pool.query(`SELECT COUNT(*) as total, SUM(CASE WHEN done THEN 1 ELSE 0 END) as completed FROM manifest WHERE session_id=$1`, [req.params.id]);
    const { total, completed } = result.rows[0];
    res.json({ total:toInt(total), completed:toInt(completed), percentage:toInt(total)>0?Math.round((toInt(completed)/toInt(total))*100):0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sessions/:id/case-progress', async (req, res) => {
  try {
    const result = await pool.query(`SELECT case_id, COUNT(*) as total, SUM(CASE WHEN done THEN 1 ELSE 0 END) as completed FROM manifest WHERE session_id=$1 GROUP BY case_id ORDER BY case_id`, [req.params.id]);
    res.json(result.rows.map(row => ({ case_id:row.case_id, total:toInt(row.total), completed:toInt(row.completed), percentage:toInt(row.total)>0?Math.round((toInt(row.completed)/toInt(row.total))*100):0 })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
// SEND INTERIM REPORT
// ════════════════════════════════════════════════════════════════════
app.post('/api/sessions/:id/complete', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const sent_by = req.body?.sent_by || 'Unknown';
    const sessionResult = await pool.query('SELECT * FROM sessions WHERE id=$1', [sessionId]);
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const session = sessionResult.rows[0];
    const manifestResult = await pool.query(`SELECT case_id, sku, COALESCE(item_description,'') AS item_description, dealer, sort_group, qty, COALESCE(actual_qty,qty) AS actual_qty, COALESCE(actual_qty,qty)-qty AS discrepancy_qty, COALESCE(remark,'') AS remark, COALESCE(scanned_by,'') AS scanned_by, done FROM manifest WHERE session_id=$1 ORDER BY case_id,sku,id`, [sessionId]);
    const items = manifestResult.rows;
    const progressResult = await pool.query(`SELECT COUNT(*) as total, SUM(CASE WHEN done THEN 1 ELSE 0 END) as completed FROM manifest WHERE session_id=$1`, [sessionId]);
    const total=toInt(progressResult.rows[0].total), completed=toInt(progressResult.rows[0].completed);
    const discrepancyCount=items.filter(item=>toInt(item.discrepancy_qty)!==0).length;
    const completionRate=total>0?Math.round((completed/total)*100):0;
    const excelBuffer = await buildExcel(session, items, total, completed, discrepancyCount, completionRate, sent_by);
    const filename = `${session.name.replace(/[^a-zA-Z0-9_-]/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
    const EMAIL_FROM = process.env.EMAIL_FROM || 'sender@example.com';
    const EMAIL_TO   = process.env.EMAIL_TO   || 'admin@example.com';
    const rateColor  = completionRate===100?'#008000':'#D97706';
    const emailHtml = `<div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;"><div style="background:#0D1B4B;padding:24px 32px;border-radius:8px 8px 0 0;"><h1 style="color:#00C9A7;margin:0;font-size:22px;">Inbound Hub Scanner</h1><p style="color:#9FB0D8;margin:6px 0 0;">Interim Sort Report</p></div><div style="background:#F8FAFB;padding:24px 32px;border:1px solid #E5E7EB;"><h2 style="color:#0D1B4B;margin-top:0;">${escapeHtml(session.name)}</h2><p style="color:#64748B;">Report time: <strong>${new Date().toLocaleString()}</strong></p><p style="color:#64748B;">Sent by: <strong style="color:#0D1B4B;">${escapeHtml(sent_by)}</strong></p><table style="border-collapse:collapse;margin:16px 0;"><tr><td style="padding:8px 24px 8px 0;color:#64748B;font-weight:bold;">Total</td><td style="padding:8px 0;font-size:18px;font-weight:bold;color:#0D1B4B;">${total}</td></tr><tr><td style="padding:8px 24px 8px 0;color:#64748B;font-weight:bold;">Completed</td><td style="padding:8px 0;font-size:18px;font-weight:bold;color:#008000;">${completed} ✓</td></tr><tr><td style="padding:8px 24px 8px 0;color:#64748B;font-weight:bold;">Incomplete</td><td style="padding:8px 0;font-size:18px;font-weight:bold;color:#DC2626;">${total-completed} ✗</td></tr><tr><td style="padding:8px 24px 8px 0;color:#64748B;font-weight:bold;">Discrepancies</td><td style="padding:8px 0;font-size:18px;font-weight:bold;color:#D97706;">${discrepancyCount}</td></tr><tr><td style="padding:8px 24px 8px 0;color:#64748B;font-weight:bold;">Rate</td><td style="padding:8px 0;font-size:24px;font-weight:bold;color:${rateColor};">${completionRate}%</td></tr></table><p style="color:#64748B;font-size:13px;">📎 ${filename}</p></div><div style="background:#F8FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;"><p style="color:#9AA3AD;font-size:12px;margin:0;">Interim report · Session still active · ${new Date().toISOString()}</p></div></div>`;
    await transporter.sendMail({ from:EMAIL_FROM, to:EMAIL_TO, subject:`[Interim Report] ${session.name} — ${completionRate}% · Sent by ${sent_by}`, html:emailHtml, attachments:[{filename,content:excelBuffer,contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}] });
    await logAudit(sent_by, 'REPORT_SENT', `Sent interim report for session "${session.name}" (ID: ${sessionId}) — ${completionRate}% complete`);
    console.log(`✓ Interim report sent for session ${sessionId} by ${sent_by}`);
    res.json({ success:true, message:'Report emailed' });
  } catch (err) { console.error('Send report error:', err); res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
// CLOSE SESSION
// ════════════════════════════════════════════════════════════════════
app.post('/api/sessions/:id/close', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const closed_by = req.body?.completed_by || req.body?.closed_by || 'Unknown';
    const sessionResult = await pool.query('SELECT * FROM sessions WHERE id=$1', [sessionId]);
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const session = sessionResult.rows[0];
    if (session.closed_at) return res.status(400).json({ error: 'Session is already closed' });
    await pool.query('UPDATE sessions SET closed_at=NOW() WHERE id=$1', [sessionId]);
    const manifestResult = await pool.query(`SELECT case_id, sku, COALESCE(item_description,'') AS item_description, dealer, sort_group, qty, COALESCE(actual_qty,qty) AS actual_qty, COALESCE(actual_qty,qty)-qty AS discrepancy_qty, COALESCE(remark,'') AS remark, COALESCE(scanned_by,'') AS scanned_by, done FROM manifest WHERE session_id=$1 ORDER BY case_id,sku,id`, [sessionId]);
    const items = manifestResult.rows;
    const progressResult = await pool.query(`SELECT COUNT(*) as total, SUM(CASE WHEN done THEN 1 ELSE 0 END) as completed FROM manifest WHERE session_id=$1`, [sessionId]);
    const total=toInt(progressResult.rows[0].total), completed=toInt(progressResult.rows[0].completed);
    const discrepancyCount=items.filter(item=>toInt(item.discrepancy_qty)!==0).length;
    const completionRate=total>0?Math.round((completed/total)*100):0;
    const excelBuffer = await buildExcel(session, items, total, completed, discrepancyCount, completionRate, closed_by);
    const filename = `FINAL_${session.name.replace(/[^a-zA-Z0-9_-]/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
    const EMAIL_FROM = process.env.EMAIL_FROM || 'sender@example.com';
    const EMAIL_TO   = process.env.EMAIL_TO   || 'admin@example.com';
    const rateColor  = completionRate===100?'#008000':'#D97706';
    const emailHtml = `<div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;"><div style="background:#0D1B4B;padding:24px 32px;border-radius:8px 8px 0 0;"><h1 style="color:#00C9A7;margin:0;font-size:22px;">Inbound Hub Scanner</h1><p style="color:#F87171;margin:6px 0 0;font-weight:bold;">🔒 Session Closed — Final Report</p></div><div style="background:#F8FAFB;padding:24px 32px;border:1px solid #E5E7EB;"><h2 style="color:#0D1B4B;margin-top:0;">${escapeHtml(session.name)}</h2><p style="color:#64748B;">Closed: <strong>${new Date().toLocaleString()}</strong></p><p style="color:#64748B;">Closed by: <strong style="color:#0D1B4B;">${escapeHtml(closed_by)}</strong></p><table style="border-collapse:collapse;margin:16px 0;"><tr><td style="padding:8px 24px 8px 0;color:#64748B;font-weight:bold;">Total</td><td style="padding:8px 0;font-size:18px;font-weight:bold;color:#0D1B4B;">${total}</td></tr><tr><td style="padding:8px 24px 8px 0;color:#64748B;font-weight:bold;">Completed</td><td style="padding:8px 0;font-size:18px;font-weight:bold;color:#008000;">${completed} ✓</td></tr><tr><td style="padding:8px 24px 8px 0;color:#64748B;font-weight:bold;">Incomplete</td><td style="padding:8px 0;font-size:18px;font-weight:bold;color:#DC2626;">${total-completed} ✗</td></tr><tr><td style="padding:8px 24px 8px 0;color:#64748B;font-weight:bold;">Discrepancies</td><td style="padding:8px 0;font-size:18px;font-weight:bold;color:#D97706;">${discrepancyCount}</td></tr><tr><td style="padding:8px 24px 8px 0;color:#64748B;font-weight:bold;">Rate</td><td style="padding:8px 0;font-size:24px;font-weight:bold;color:${rateColor};">${completionRate}%</td></tr></table><p style="color:#64748B;font-size:13px;">📎 ${filename}</p></div><div style="background:#FEF2F2;padding:12px 32px;border:1px solid #FECACA;"><p style="color:#991B1B;font-size:12px;margin:0;">🔒 Session permanently closed by ${escapeHtml(closed_by)}. No further scanning possible.</p></div><div style="background:#F8FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;"><p style="color:#9AA3AD;font-size:12px;margin:0;">Final report · Inbound Hub Scanner · ${new Date().toISOString()}</p></div></div>`;
    await transporter.sendMail({ from:EMAIL_FROM, to:EMAIL_TO, subject:`[SESSION CLOSED] ${session.name} — FINAL: ${completionRate}% · Closed by ${closed_by}`, html:emailHtml, attachments:[{filename,content:excelBuffer,contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}] });
    await logAudit(closed_by, 'SESSION_CLOSED', `Closed session "${session.name}" (ID: ${sessionId}) — final: ${completionRate}% complete`);
    console.log(`✓ Session ${sessionId} closed by ${closed_by}`);
    res.json({ success:true, message:'Session closed and final report emailed.' });
  } catch (err) { console.error('Close session error:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/sessions/:id/dealer-summary', async (req, res) => {
  try {
    const result = await pool.query(`SELECT DISTINCT dealer, sort_group, case_id, sku, qty FROM manifest WHERE session_id=$1 ORDER BY dealer,sort_group,case_id,sku`, [req.params.id]);
    const dealerMap = {};
    result.rows.forEach(row => { if (!dealerMap[row.dealer]) dealerMap[row.dealer]={name:row.dealer,groups:new Set(),cases:[],totalQty:0}; dealerMap[row.dealer].groups.add(row.sort_group); dealerMap[row.dealer].cases.push({case_id:row.case_id,sku:row.sku,sort_group:row.sort_group,qty:row.qty}); dealerMap[row.dealer].totalQty+=row.qty; });
    res.json(Object.values(dealerMap).map(d => ({ ...d, groups: Array.from(d.groups) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) { res.sendFile(indexPath); } else { res.status(404).send('App not built. Run: npm run build'); }
});

const PORT = process.env.PORT || 3000;
initDB().then(() => { app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); });
