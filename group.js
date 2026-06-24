const express = require("express");
const router = express.Router();
require("dotenv").config();
const { sql, config } = require("../config/db");
const crypto = require("crypto");
const nodemailer = require("nodemailer");


router.post("/createGroup", async (req, res) => {
  try {
    let { name, orgid, orgdiv, required } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Group name is required" });
    }

    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("name", sql.NVarChar, name)
      .input("orgid", sql.Int, Number(orgid))
      .input("orgdiv", sql.Int, Number(orgdiv))
      .input("required", sql.Int, Number(required))
      .input("createdAt", sql.DateTime, new Date())
      .query(`INSERT INTO GroupList (GroupName, orgid, orgdivid, recruiterid, Active, createdat)
              OUTPUT INSERTED.Groupid VALUES (@name, @orgid, @orgdiv, @required, 1, @CreatedAt)`);

    res.status(201).json({
      message: "Group created successfully",
      groupId: result.recordset[0].id,
    });
  } catch (error) {
    console.error("Error creating group:", error.message, error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/getGroups", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const orgid = req.query.orgid;
    const orgdivid = req.query.orgdiv;
    const accessType = Number(req.query.accessType);
    const recruiterid = req.query.recruiterId;

  
    if (![1, 2, 3].includes(Number(accessType))) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid access type" });
    }
    // Coerce query params to proper types

    // const result = await pool.request()
    //     .request()
    //     .input("orgid", sql.Int, Number(orgid))
    //     .input("orgdivid", sql.Int, Number(orgdivid))
    //     .input("accessType", sql.Int, Number(accessType))
    //     .query(
    //       `
    // SELECT
    //   g.*,
    //   u.FirstName AS UserFirstName
    // FROM GroupList AS g
    // LEFT JOIN Users AS u
    //  ON u.UserId = TRY_CONVERT(int, REPLACE(REPLACE(g.RecruiterIds, '[', ''), ']', ''))
    //  WHERE g.Active = 1
    //  AND g.OrgId = @orgid
    //  AND g.OrgDivId = @orgdivid
    //  ORDER BY g.GroupId DESC;
    //       `
    //     );

    switch (accessType) {
      case 1:
        query = `
    SELECT
    g.*,
    u.FirstName AS UserFirstName
  FROM GroupList AS g
  LEFT JOIN Users AS u
   ON u.UserId = TRY_CONVERT(int, REPLACE(REPLACE(g.RecruiterIds, '[', ''), ']', ''))
   WHERE g.Active = 1
   AND g.OrgId = @orgid
   ORDER BY g.GroupId DESC;
              `;
        params = [{ name: "orgid", type: sql.Int, value: orgid }];
        break;

      case 2:
        query = `

    SELECT
    g.*,
    u.FirstName AS UserFirstName
  FROM GroupList AS g
  LEFT JOIN Users AS u
   ON u.UserId = TRY_CONVERT(int, REPLACE(REPLACE(g.RecruiterIds, '[', ''), ']', ''))
   WHERE g.Active = 1
   AND g.OrgId = @orgid
   AND g.OrgDivId = @orgdivid
   ORDER BY g.GroupId DESC;
              `;
        params = [
          { name: "orgid", type: sql.Int, value: orgid },
          { name: "orgdivid", type: sql.Int, value: orgdivid },
        ];
        break;

      case 3:
        query = `
    SELECT
    g.*,
    u.FirstName AS UserFirstName
  FROM GroupList AS g
  LEFT JOIN Users AS u
   ON u.UserId = TRY_CONVERT(int, REPLACE(REPLACE(g.RecruiterIds, '[', ''), ']', ''))
   WHERE g.Active = 1
   AND g.OrgId = @orgid
   AND g.OrgDivId = @orgdivid 
    AND g.recruiterid = @recruiterid
   ORDER BY g.GroupId DESC;
                
              `;
        params = [
          { name: "orgid", type: sql.Int, value: orgid },
          { name: "orgdivid", type: sql.Int, value: orgdivid },
          { name: "recruiterid", type: sql.Int, value: recruiterid },
        ];
        break;
    }

    const request = pool.request();
    params.forEach((param) =>
      request.input(param.name, param.type, param.value)
    );
    const result = await request.query(query);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error fetching groups:", error.message, error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/maildetails/:orgid/:orgdiv/:groupid", async (req, res) => {
  const { orgid, orgdiv, groupid } = req.params;

  try {
    const pool = req.app.locals.db;
    const result = await pool
      .request()
      .input("OrgId", orgid)
      .input("orgdiv", orgdiv)
      .input("GroupId", groupid).query(`
SELECT  
  u.firstName,
  j.JobTitle,
  SUM(CAST(JSON_VALUE(mj.value, '$.mail_count') AS INT)) AS mail_count
FROM GroupList g
CROSS APPLY OPENJSON(g.RecruiterIds, '$.history') AS h
CROSS APPLY OPENJSON(h.value, '$.mailJobs') AS mj
JOIN Users u ON JSON_VALUE(mj.value, '$.recrutierid') = u.UserId
JOIN Jobs j ON JSON_VALUE(mj.value, '$.jobid') = j.JobId
WHERE g.OrgId = @OrgId 
  AND g.GroupId = @GroupId
GROUP BY u.firstName, j.JobTitle;
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching mail details by group:", error.message);
    res.status(500).json({ message: error.message });
  }
});

router.get("/getGroupMembers", async (req, res) => {
  try {
    const pool = await sql.connect(config);

    const result = await pool.request().query(`
      SELECT
  g.GroupId        AS Groupid,
  g.GroupName,
  j.candidate_id,
  c.firstname,
  c.email,
  c.phonenumber,
  j.recruiter_userId,
  u.FirstName,
  u.LastName
FROM dbo.GroupList AS g
CROSS APPLY OPENJSON(g.CandidateIds)
  WITH (
    candidate_id      int '$[0]',
    recruiter_userId  int '$[1]'
  ) AS j
JOIN dbo.Candidate AS c
  ON c.candidate_id = j.candidate_id
LEFT JOIN dbo.Users AS u
  ON u.userId = j.recruiter_userId
WHERE g.Active = 1
  AND ISJSON(g.CandidateIds) = 1    -- <— only valid JSON
  AND j.candidate_id IS NOT NULL;

      `);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error fetching groups:", error.message, error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/updateGroupName", async (req, res) => {
  try {
    const { groupId, groupName, update, required, orgdiv } = req.body;

    if (!groupId || !groupName) {
      return res.status(400).json({ message: "Group ID and name required" });
    }

    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("groupName", sql.NVarChar, groupName)
      .input("update", sql.DateTime, update || new Date())
      .input("required", sql.Int, required)
      .input("groupId", sql.Int, groupId)
      .input("orgdiv", sql.Int, orgdiv)
      .query(`
        UPDATE GroupList
        SET GroupName = @groupName,
            lastmodifiedat = @update,
            lastmodifiedid = @required,
            orgdivid = @orgdiv
        WHERE groupid = @groupId
      `);

    res.json({ success: true, message: "Group updated successfully" });
  } catch (err) {
    console.error(" Error updating group:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

router.delete("/Candidatedelete/:id", async (req, res) => {
  try {
    const Candidate = Number(req.params.id);
    if (!Number.isInteger(Candidate)) {
      return res
        .status(400)
        .json({ success: false, message: "Candidate ID required (integer)" });
    }

    const pool = await sql.connect(config);

    const result = await pool.request().input("Candidate", sql.Int, Candidate)
      .query(`
        -- 1) Normalize: rows with NULL / non-JSON become []
        UPDATE g
        SET CandidateIds = '[]'
        FROM dbo.GroupList AS g
        WHERE CandidateIds IS NULL OR ISJSON(CandidateIds) <> 1;

        -- 2) Remove matches and rebuild JSON (array-of-pairs or legacy scalars)
        UPDATE g
        SET CandidateIds = COALESCE(
          (
            SELECT CONCAT('[', STRING_AGG(x.elem, ','), ']')
            FROM (
              /* Keep PAIRS where first element (candidate) is NOT the target
                 A "pair" is any element that is JSON and has $[0] */
              SELECT JSON_QUERY(j.value) AS elem
              FROM OPENJSON(g.CandidateIds) AS j
              WHERE ISJSON(j.value) = 1
                AND JSON_VALUE(j.value, '$[0]') IS NOT NULL
                AND (TRY_CONVERT(int, JSON_VALUE(j.value, '$[0]')) IS NULL
                     OR TRY_CONVERT(int, JSON_VALUE(j.value, '$[0]')) <> @Candidate)

              UNION ALL

              /* Keep LEGACY SCALARS (numbers) that are NOT the target */
              SELECT CAST(TRY_CONVERT(int, j.value) AS NVARCHAR(20)) AS elem
              FROM OPENJSON(g.CandidateIds) AS j
              WHERE ISJSON(j.value) = 0
                AND TRY_CONVERT(int, j.value) IS NOT NULL
                AND TRY_CONVERT(int, j.value) <> @Candidate
            ) AS x
          ),
          '[]'
        )
        FROM dbo.GroupList AS g
        WHERE ISJSON(g.CandidateIds) = 1
          AND EXISTS (
            /* Touch only rows that actually contain the candidate */
            SELECT 1
            FROM OPENJSON(g.CandidateIds) AS j
            WHERE (ISJSON(j.value) = 1
                   AND JSON_VALUE(j.value, '$[0]') IS NOT NULL
                   AND TRY_CONVERT(int, JSON_VALUE(j.value, '$[0]')) = @Candidate)
               OR (ISJSON(j.value) = 0
                   AND TRY_CONVERT(int, j.value) = @Candidate)
          );
      `);

    res.json({
      success: true,
      message: "Candidate deleted (compatible with SQL Server < 2022)",
      rowsAffected: result?.rowsAffected?.[1] ?? 0,
    });
  } catch (err) {
    console.error(" Error deleting candidate:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

router.put("/deleteGroupName/:id", async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);

    if (!groupId) {
      return res
        .status(400)
        .json({ success: false, message: "Group ID is required" });
    }

    const pool = await sql.connect(config);
    await pool.request().input("groupId", sql.Int, groupId).query(`
        UPDATE GroupList
        SET Active = 0
        WHERE groupid = @groupId
      `);

    res.json({ success: true, message: "Group deactivated successfully" });
  } catch (err) {
    console.error(" Error deactivating group:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

const SMTP_HOST = process.env.SMTP_HOST || "smtp.mail.yahoo.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = SMTP_PORT === 465;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  pool: true,
  maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 3),
  maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 500),
  rateDelta: Number(process.env.SMTP_RATE_DELTA || 1000),
  rateLimit: Number(process.env.SMTP_RATE_LIMIT || 6),
});

let _verifyOnce;
async function verifySmtpOnce() {
  if (!_verifyOnce) {
    _verifyOnce = transporter.verify().catch((e) => {
      _verifyOnce = undefined;
      throw e;
    });
  }
  return _verifyOnce;
}

const jobs = global.__emailJobs || (global.__emailJobs = Object.create(null));

function createJob(total) {
  const id = crypto.randomUUID();
  jobs[id] = {
    total,
    sent: 0,
    failed: 0,
    logs: [],
    clients: new Set(),
    aborted: false,
    createdAt: Date.now(),
  };
  return id;
}
function getJob(jobId) {
  return jobs[jobId];
}
function delJob(jobId) {
  delete jobs[jobId];
}

function emit(jobId, payload) {
  const job = getJob(jobId);
  if (!job) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of job.clients) res.write(data);
}

function chunk(arr = [], size = 30) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function isAuthError(err) {
  const msg = String(err?.response || err?.message || "");
  return err?.code === "EAUTH" || /\b535\b/.test(msg);
}
async function runWithConcurrency(items, worker, concurrency) {
  let i = 0,
    active = 0;
  return new Promise((resolve) => {
    const kick = () => {
      while (active < concurrency && i < items.length) {
        const item = items[i++];
        active++;
        Promise.resolve(worker(item))
          .catch(() => {})
          .finally(() => {
            active--;
            if (i >= items.length && active === 0) resolve();
            else kick();
          });
      }
    };
    kick();
  });
}
async function sendOneWithRetry(mail, maxRetries = 2) {
  let attempt = 0;
  for (;;) {
    try {
      return await transporter.sendMail(mail);
    } catch (err) {
      if (isAuthError(err)) {
        err.hardAuthFailure = true;
        throw err;
      }
      if (attempt >= maxRetries) throw err;
      attempt++;
      const delay = Math.min(60000, 2000 * 2 ** (attempt - 1));
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function stripHtml(s = "") {
  return String(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function addDefaultStyle(html, tag, style) {
  const re = new RegExp(`<${tag}(?![^>]*\\bstyle=)`, "gi");
  return html.replace(re, `<${tag} style="${style}"`);
}
function normalizeNote(raw, brand = {}) {
  let html = String(raw || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");

  if (!/<(p|h1|h2|h3|ul|ol|table|blockquote|img|hr)\b/i.test(html)) {
    const paras = html
      .split(/\n{2,}/)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
    html = paras;
  }

  const linkColor = brand.buttonBg || "#2563eb";
  html = addDefaultStyle(
    html,
    "h1",
    "margin:0 0 12px 0;font-size:22px;line-height:28px;font-weight:bold;font-family:Arial, Helvetica, sans-serif;"
  );
  html = addDefaultStyle(
    html,
    "h2",
    "margin:0 0 12px 0;font-size:18px;line-height:24px;font-weight:bold;font-family:Arial, Helvetica, sans-serif;"
  );
  html = addDefaultStyle(
    html,
    "h3",
    "margin:0 0 8px 0;font-size:16px;line-height:22px;font-weight:bold;font-family:Arial, Helvetica, sans-serif;"
  );
  html = addDefaultStyle(
    html,
    "p",
    "margin:0 0 16px 0;font-size:16px;line-height:24px;font-family:Arial, Helvetica, sans-serif;color:#0f172a;"
  );
  html = addDefaultStyle(
    html,
    "ul",
    "margin:0 0 16px 22px;padding:0;font-size:16px;line-height:24px;font-family:Arial, Helvetica, sans-serif;color:#0f172a;"
  );
  html = addDefaultStyle(
    html,
    "ol",
    "margin:0 0 16px 22px;padding:0;font-size:16px;line-height:24px;font-family:Arial, Helvetica, sans-serif;color:#0f172a;"
  );
  html = addDefaultStyle(html, "li", "margin:0 0 8px 0;");
  html = addDefaultStyle(html, "a", `color:${linkColor};text-decoration:none;`);
  html = html.replace(/<img([^>]*?)>/gi, (m, attrs) => {
    if (/style=/.test(attrs)) return `<img${attrs}>`;
    return `<img${attrs} style="display:block;border:0;outline:none;text-decoration:none;max-width:100%;height:auto;">`;
  });
  html = addDefaultStyle(html, "table", "border-collapse:collapse;");
  html = addDefaultStyle(html, "td", "padding:0;");

  return html;
}

function buildEmailHTML({ subject = "", contentHTML = "", brand = {} }) {
  const {
    headerBg = "#0eb2df",
    bodyBg = "#f6f7fb",
    cardBorder = "#eceff7",
    buttonBg = "#2563eb",
    text = "#0f172a",
    subtext = "#64748b",
    faint = "#94a3b8",
    logoUrl = "./assets/images/logos/Tresume.png",
    logoAlt = "Tresume",
  } = brand;

  const preheader = stripHtml(contentHTML).slice(0, 140);

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="viewport" content="width=device-width">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <style type="text/css">body, table, td, a { font-family: Arial, sans-serif !important; }</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${bodyBg};">
  <center role="article" aria-roledescription="email" lang="en" style="width:100%;background:${bodyBg};">
    <!-- Preheader (hidden preview text) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(
      preheader
    )}</div>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;border:1px solid ${cardBorder};overflow:hidden;">
            <!-- Header -->
            <tr>
              <td style="padding:0;background:${headerBg};">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="padding:16px 24px; margin-left:200px;">
                      ${`<h1 style="margin:0;font-size:20px;line-height:28px;color:#ffffff;font-family:Arial, Helvetica, sans-serif;">${escapeHtml(
                        subject
                      )}</h1>`}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:24px;">
                <div style="font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:24px;color:${text};">
                  ${contentHTML}
                </div>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding:0 24px;"><hr style="border:0;border-top:1px solid ${cardBorder};margin:0;"></td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px 24px;background:#fafbff;">
                <p style="margin:0;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:18px;color:${subtext};">
                  You’re receiving this email because you interacted with our service. If this wasn’t you, you can ignore this message.
                </p>
                <p style="margin:8px 0 0;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:18px;color:${faint}; tyext-align:right;">
                  © ${new Date().getFullYear()} Tresume • <a href="#" style="color:${buttonBg};text-decoration:none;">Privacy</a>
                </p>
              </td>
            </tr>
          </table>

          <!-- Unsubscribe / Address -->
          <div style="padding:12px 0;font-family:Arial, Helvetica, sans-serif;font-size:11px;line-height:16px;color:${faint};">
            <a href="<% unsubscribe_url %>" style="color:${faint};text-decoration:underline;">Unsubscribe</a>
          </div>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}

function toIntId(x) {
  const n = Number(x);
  if (Number.isInteger(n)) return n;
  const s = String(x);
  let h = 0x811c9dc5; // FNV-1a 32-bit
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) | 0;
  }
  return Math.abs(h) >>> 0;
}

let upsertGoplist;
try {
  ({ upsertGoplist } = require("./goplist"));
} catch {
  console.warn("upsertGoplist not found; using no-op stub.");
  upsertGoplist = async () => {};
}

async function upsertGroupMailJobsBulk({ groupId, updates }) {
  if (!Number.isInteger(Number(groupId)))
    throw new Error("groupId must be an integer");
  if (!Array.isArray(updates) || updates.length === 0)
    throw new Error("updates must be a non-empty array");

  // JS validation
  for (const u of updates) {
    if (!Number.isInteger(Number(u.recrutierid)))
      throw new Error("updates[].recrutierid must be an integer");
    if (!Number.isInteger(Number(u.jobid)))
      throw new Error("updates[].jobid must be an integer");
    const hasSet = u.set !== undefined && u.set !== null;
    const hasDelta = u.delta !== undefined && u.delta !== null;
    if (!hasSet && !hasDelta)
      throw new Error("each update must include either `set` or `delta`");
    if (hasSet && !Number.isInteger(Number(u.set)))
      throw new Error("updates[].set must be an integer");
    if (hasDelta && !Number.isInteger(Number(u.delta)))
      throw new Error("updates[].delta must be an integer");

    if (u.candidateIds != null && !Array.isArray(u.candidateIds)) {
      throw new Error("updates[].candidateIds must be an array if provided");
    }
  }

  const pool = await sql.connect(config);
  const updatesJson = JSON.stringify(updates);

  const q = `
SET NOCOUNT ON;

DECLARE @json NVARCHAR(MAX);
DECLARE @updatesJson NVARCHAR(MAX) = @updatesJsonParam;
DECLARE @groupId INT = @groupIdParam;

---------------------------------------------------------
-- 1) Parse updates JSON into table (with candidateIds)
---------------------------------------------------------
DECLARE @updates TABLE (
  recrutierid     INT NOT NULL,
  jobid           INT NOT NULL,
  setMail         INT NULL,
  deltaMail       INT NULL,
  candidateIds    NVARCHAR(MAX) NULL   -- JSON ARRAY, e.g. [2491,2203]
);

INSERT INTO @updates (recrutierid, jobid, setMail, deltaMail, candidateIds)
SELECT
  TRY_CONVERT(INT, recrutierid),
  TRY_CONVERT(INT, jobid),
  TRY_CONVERT(INT, [set]),
  TRY_CONVERT(INT, [delta]),
  candidateIds
FROM OPENJSON(@updatesJson)
WITH (
  recrutierid INT            '$.recrutierid',
  jobid       INT            '$.jobid',
  [set]       INT            '$.set',
  [delta]     INT            '$.delta',
  candidateIds NVARCHAR(MAX) '$.candidateIds' AS JSON   -- ARRAY FROM NODE
)
WHERE recrutierid IS NOT NULL AND jobid IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM @updates)
BEGIN
  SELECT RecruiterIds AS after_json
  FROM dbo.GroupList
  WHERE GroupId = @groupId;
  RETURN;
END

---------------------------------------------------------
-- 2) Load current GroupList JSON
---------------------------------------------------------
SELECT @json = RecruiterIds
FROM dbo.GroupList WITH (UPDLOCK, ROWLOCK)
WHERE GroupId = @groupId;

IF (@json IS NULL OR ISJSON(@json) <> 1)
  SET @json = N'{"history": []}';

---------------------------------------------------------
-- 3) Load last mailJobs (history[0])
---------------------------------------------------------
DECLARE @lastMail NVARCHAR(MAX);

SELECT TOP 1 @lastMail = JSON_QUERY(value, '$.mailJobs')
FROM OPENJSON(@json, '$.history')
ORDER BY [key] DESC;

IF (@lastMail IS NULL)
  SET @lastMail = N'[]';

---------------------------------------------------------
-- 4) Load existing mailJobs (candidateIds = JSON array)
---------------------------------------------------------
DECLARE @existing TABLE (
  recrutierid  INT NOT NULL,
  jobid        INT NOT NULL,
  mail_count   INT NOT NULL,
  candidateIds NVARCHAR(MAX) NULL   -- JSON ARRAY
);

INSERT INTO @existing (recrutierid, jobid, mail_count, candidateIds)
SELECT
  TRY_CONVERT(INT, recrutierid),
  TRY_CONVERT(INT, jobid),
  TRY_CONVERT(INT, mail_count),
  candidateIds
FROM OPENJSON(@lastMail)
WITH (
  recrutierid INT            '$.recrutierid',
  jobid       INT            '$.jobid',
  mail_count  INT            '$.mail_count',
  candidateIds NVARCHAR(MAX) '$.candidateIds' AS JSON   -- ARRAY IN DB
);

---------------------------------------------------------
-- 5) Merge candidateIds (simple int array case, build scalar JSON array)
---------------------------------------------------------
IF OBJECT_ID('tempdb..#final', 'U') IS NOT NULL
  DROP TABLE #final;

;WITH Keys AS (
  SELECT DISTINCT recrutierid, jobid FROM @existing
  UNION
  SELECT DISTINCT recrutierid, jobid FROM @updates
),
AllIds AS (
  -- Flatten all candidateIds from existing + updates
  SELECT
    k.recrutierid,
    k.jobid,
    TRY_CONVERT(INT, j.value) AS id
  FROM Keys k
  OUTER APPLY (
    SELECT candidateIds
    FROM @existing e
    WHERE e.recrutierid = k.recrutierid
      AND e.jobid       = k.jobid

    UNION ALL

    SELECT candidateIds
    FROM @updates u
    WHERE u.recrutierid = k.recrutierid
      AND u.jobid       = k.jobid
  ) src
  CROSS APPLY OPENJSON(COALESCE(src.candidateIds, N'[]')) j
)
SELECT
  k.recrutierid,
  k.jobid,
  ISNULL(COUNT(DISTINCT a.id), 0) AS mail_count,
  ISNULL(
    (
      SELECT
        '[' + STRING_AGG(CAST(d.id AS NVARCHAR(20)), ',') + ']'
      FROM (
        SELECT DISTINCT a2.id
        FROM AllIds a2
        WHERE a2.recrutierid = k.recrutierid
          AND a2.jobid       = k.jobid
          AND a2.id IS NOT NULL
      ) AS d
    ),
    N'[]'
  ) AS candidateIds
INTO #final
FROM Keys k
LEFT JOIN AllIds a
  ON a.recrutierid = k.recrutierid
 AND a.jobid       = k.jobid
GROUP BY k.recrutierid, k.jobid;

---------------------------------------------------------
-- 6) Build new JSON
---------------------------------------------------------
DECLARE @newMail NVARCHAR(MAX) = (
  SELECT
    recrutierid,
    jobid,
    mail_count,
    JSON_QUERY(candidateIds) AS candidateIds
  FROM #final
  ORDER BY recrutierid, jobid
  FOR JSON PATH
);

SET @newMail = ISNULL(@newMail, N'[]');

DROP TABLE #final;

---------------------------------------------------------
-- 7) Build new history entry
---------------------------------------------------------
DECLARE @timestamp NVARCHAR(50) =
  CONVERT(VARCHAR(50), SYSDATETIMEOFFSET(), 127);

DECLARE @newEntry NVARCHAR(MAX) =
  N'{"timestamp": "' + @timestamp + '", "mailJobs": ' + @newMail + N'}';

IF @newEntry IS NULL
  SET @newEntry = N'{"timestamp": "' + @timestamp + '", "mailJobs": []}';

SET @json = N'{"history": [' + @newEntry + N']}';

---------------------------------------------------------
-- 8) Save back to DB
---------------------------------------------------------
UPDATE dbo.GroupList
SET RecruiterIds = @json
WHERE GroupId = @groupId;

---------------------------------------------------------
-- 9) Output updated JSON
---------------------------------------------------------
SELECT RecruiterIds AS after_json
FROM dbo.GroupList
WHERE GroupId = @groupId;
`;

  const result = await pool
    .request()
    .input("groupIdParam", sql.Int, Number(groupId))
    .input("updatesJsonParam", sql.NVarChar, updatesJson)
    .query(q);

  return result?.recordset?.[0]?.after_json;
}

router.post("/email/start", async (req, res) => {
  try {
    const {
      to,
      cc = [],
      bcc = [],
      subject,
      note,
      brand = {},
      recruiterId,
      groupId,
      jobId,
      candidateId, 
      extraMailJobs = [],
      batchSize: bs,
      batchConcurrency: bc,
    } = req.body || {};

    if (!Array.isArray(to) || to.length === 0) {
      return res.status(400).json({
        message:
          "`to` must be a non-empty string[] (first item is the visible To).",
      });
    }
    if (!subject || !note) {
      return res
        .status(400)
        .json({ message: "`subject` and `note` are required" });
    }
    if (!recruiterId) {
      return res.status(400).json({ message: "`recruiterId` is required" });
    }
    // if (groupId) {
    //   return res.status(400).json({ message: "`groupId` is required" });
    // }

    const batchSize = Math.max(
      2,
      Number(bs ?? process.env.SMTP_BATCH_SIZE ?? 30)
    );
    const batchConcurrency = Math.max(
      1,
      Math.min(Number(bc ?? process.env.SMTP_BATCH_CONCURRENCY ?? 3), 10)
    );

    const recipientList = bcc.length ? bcc : to.slice(1);
    if (!recipientList.length) {
      return res.status(400).json({
        message:
          "Provide at least one recipient in `bcc` or more than one in `to`.",
      });
    }

    let candidateIdNums;

    if (Array.isArray(candidateId)) {
      if (candidateId.length !== recipientList.length) {
        console.error("candidateId length mismatch:", {
          recipientCount: recipientList.length,
          candidateIdCount: candidateId.length,
        });
        return res.status(400).json({
          message:
            "`candidateId` array length must match number of recipients (bcc or to-slice).",
        });
      }

      candidateIdNums = candidateId.map((id, i) => {
        const n = Number(id);
        if (!Number.isFinite(n)) {
          throw new Error(
            `candidateId[${i}] must be a valid number; got: ${id}`
          );
        }
        return n;
      });
    } else {
      const n = Number(candidateId);
      if (!Number.isFinite(n)) {
        console.error("Invalid candidateId in request body:", candidateId);
        return res.status(400).json({
          message: "`candidateId` must be a valid number or array of numbers",
        });
      }
      candidateIdNums = Array(recipientList.length).fill(n);
    }

    const recipientEntries = recipientList.map((email, idx) => ({
      email,
      candidateId: candidateIdNums[idx],
    }));

    const visibleTo =
      to[0] || process.env.EMAIL_USER || "undisclosed-recipients:;";
    const groups = chunk(recipientEntries, batchSize);

    const mailCandidateIds = new Set();

    const jobKey = createJob(recipientList.length);
    const dbJobId = Number.isInteger(Number(jobId))
      ? Number(jobId)
      : toIntId(jobKey);

    res.json({
      jobId: jobKey,
      dbJobId,
      total: recipientList.length,
      batchSize,
      batchConcurrency,
    });

    const html = buildEmailHTML({
      subject,
      contentHTML: normalizeNote(note, brand),
      brand,
    });
    const text = stripHtml(note);
    const listUnsubURL =
      process.env.UNSUBSCRIBE_URL || "https://example.com/unsub";
    const listUnsubMailto = process.env.REPLY_TO || process.env.EMAIL_USER;

    let aborted = false;

    await runWithConcurrency(
      groups,
      async (group) => {
        if (aborted) return;

        try {
          const bccEmails = group.map((g) => g.email);

          await sendOneWithRetry({
            from: `"${process.env.MAIL_FROM_NAME || "Tresume Team"}" <${
              process.env.EMAIL_USER
            }>`,
            to: visibleTo,
            cc,
            bcc: bccEmails,
            subject,
            html,
            text,
            headers: {
              ...(process.env.REPLY_TO
                ? { "Reply-To": process.env.REPLY_TO }
                : {}),
              "List-Unsubscribe": `<${listUnsubURL}>, <mailto:${listUnsubMailto}?subject=unsubscribe>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          });

          for (const { email: recipient, candidateId: cid } of group) {
            // logs
            jobs[jobKey].sent++;
            jobs[jobKey].logs.push({ recipient, status: "sent" });

            emit(jobKey, { kind: "item", recipient, status: "sent" });

            mailCandidateIds.add(cid);

            try {
              await upsertGoplist({
                recruiterId,
                email: recipient,
                jobId: dbJobId,
                candidateId: cid,
                status: "sent",
              });
            } catch (dbErr) {
              console.error("goplist upsert (sent) failed", recipient, dbErr);
            }
          }
        } catch (err) {
          const msg = err?.message || "send failed";

          for (const { email: recipient, candidateId: cid } of group) {
            jobs[jobKey].failed++;
            jobs[jobKey].logs.push({ recipient, status: "failed", error: msg });
            emit(jobKey, {
              kind: "item",
              recipient,
              status: "failed",
              message: msg,
            });

            try {
              await upsertGoplist({
                recruiterId,
                email: recipient,
                jobId: dbJobId,
                candidateId: cid,
                status: "failed",
                error: msg,
              });
            } catch (dbErr) {
              console.error("goplist upsert (failed) failed", recipient, dbErr);
            }
          }

          if (err.hardAuthFailure) {
            aborted = true;
            jobs[jobKey].aborted = true;
            emit(jobKey, {
              kind: "item",
              recipient: "(batch)",
              status: "aborted",
              message: "Authentication failure (535). Stopping job.",
            });
          }
        }
      },
      batchConcurrency
    );

    emit(jobKey, {
      kind: "done",
      sent: jobs[jobKey].sent,
      failed: jobs[jobKey].failed,
      total: jobs[jobKey].total,
      percent: 100,
      aborted: jobs[jobKey].aborted || false,
    });

    try {
      const finalSent = jobs[jobKey]?.sent ?? 0;

      const mainIdsArray = Array.from(mailCandidateIds)
        .map(Number)
        .filter(Number.isFinite);


      const updates = [
        {
          recrutierid: Number(recruiterId),
          jobid: Number(dbJobId),
          set: Number(finalSent),
          candidateIds: mainIdsArray,
        },
      ];

      if (Array.isArray(extraMailJobs) && extraMailJobs.length > 0) {
        for (const row of extraMailJobs) {
          const cleanIds = Array.isArray(row.candidateIds)
            ? row.candidateIds.map(Number).filter(Number.isFinite)
            : [];

          const toPush = {
            recrutierid: Number(row.recrutierid),
            jobid: Number(row.jobid),
            candidateIds: cleanIds,
          };

          if (row.set !== undefined) toPush.set = Number(row.set);
          if (row.delta !== undefined) toPush.delta = Number(row.delta);
          updates.push(toPush);
        }
      }


      const afterJson = await upsertGroupMailJobsBulk({ groupId, updates });
    } catch (e) {
      console.error("upsertGroupMailJobsBulk error:", e);
    }
  } catch (e) {
    console.error("POST /email/start error", e);
    if (!res.headersSent) res.status(500).json({ message: e.message });
  }
});

router.get("/email/stream", (req, res) => {
  const { jobId } = req.query;
  const job = getJob(jobId);
  if (!job) return res.status(404).end();

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  job.clients.add(res);
  const percent = job.total
    ? Math.round(((job.sent + job.failed) / job.total) * 100)
    : 0;
  res.write(
    `data: ${JSON.stringify({
      kind: "start",
      sent: job.sent,
      failed: job.failed,
      total: job.total,
      percent,
      jobId,
    })}\n\n`
  );

  req.on("close", () => job.clients.delete(res));
});

router.get("/email/status", (req, res) => {
  const { jobId } = req.query;
  const job = getJob(jobId);
  if (!job) return res.status(404).json({ message: "Unknown jobId" });

  const done = job.sent + job.failed >= job.total;
  res.json({
    sent: job.sent,
    failed: job.failed,
    total: job.total,
    logs: job.logs.slice(-10),
    done,
  });
});

router.get("/email/verify", async (_req, res) => {
  try {
    await verifySmtpOnce();
    res.json({ ok: true, message: "SMTP verified" });
  } catch (e) {
    res.status(502).json({ ok: false, message: e.message });
  }
});

module.exports = router;
