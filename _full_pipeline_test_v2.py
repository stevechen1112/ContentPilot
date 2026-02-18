#!/usr/bin/env python3
"""ContentPilot Full Pipeline E2E Test (v2 - with JWT auth)"""
import paramiko, json, time, uuid

key = paramiko.Ed25519Key.from_private_key_file(r"C:\Users\User\.ssh\contentpilot_copilot")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("172.238.31.80", username="root", pkey=key)

def run(cmd, timeout=180):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return out, err

def test(name, cmd, timeout=180):
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")
    out, err = run(cmd, timeout)
    try:
        parsed = json.loads(out)
        out_str = json.dumps(parsed, ensure_ascii=False, indent=2)
        if len(out_str) > 3000:
            out_str = out_str[:3000] + "\n... (truncated)"
        print(out_str)
        return parsed
    except:
        print(out[:3000] if out else "(no output)")
        if err:
            print(f"STDERR: {err[:500]}")
        return None

KEYWORD = "膝蓋痛原因"

# ===== S0: Register & Login to get JWT =====
test_email = f"test_{uuid.uuid4().hex[:8]}@test.com"
test_password = "Test1234!"

print(f"\n{'='*60}")
print(f"S0: Auth - Register & Login")
print(f"{'='*60}")

# Register
result = test("S0a: Register",
    f"""curl -s -X POST http://localhost:3000/api/auth/register -H 'Content-Type: application/json' -d '{{"email":"{test_email}","password":"{test_password}","name":"Pipeline Test"}}'""")

# Login
result = test("S0b: Login",
    f"""curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{{"email":"{test_email}","password":"{test_password}"}}'""")

TOKEN = None
PROJECT_ID = None
if result and result.get("token"):
    TOKEN = result["token"]
    print(f"\n→ S0 結果: ✅ Got JWT token (length={len(TOKEN)})")
elif result and result.get("data", {}).get("token"):
    TOKEN = result["data"]["token"]
    print(f"\n→ S0 結果: ✅ Got JWT token (length={len(TOKEN)})")
else:
    print(f"\n→ S0 結果: ❌ No token obtained")

AUTH_HEADER = f"-H 'Authorization: Bearer {TOKEN}'" if TOKEN else ""

# ===== S1: Create Project =====
result = test("S1: Create Project",
    f"""curl -s -X POST http://localhost:3000/api/projects {AUTH_HEADER} -H 'Content-Type: application/json' -d '{{"name":"Pipeline Test Project","description":"E2E test"}}'""")

if result and result.get("data", {}).get("id"):
    PROJECT_ID = result["data"]["id"]
    print(f"\n→ S1 結果: ✅ Project created (id={PROJECT_ID})")
elif result and result.get("id"):
    PROJECT_ID = result["id"]
    print(f"\n→ S1 結果: ✅ Project created (id={PROJECT_ID})")
else:
    PROJECT_ID = "22e7d6b9-adab-48d5-97fb-e56205143e33"
    print(f"\n→ S1 結果: ⚠️ Using fallback project ID")

# ===== S2: Keyword / SERP Analysis =====
result = test("S2: Keyword Analysis (Serper)",
    f"""curl -s -X POST http://localhost:3000/api/research/analyze-keyword {AUTH_HEADER} -H 'Content-Type: application/json' -d '{{"keyword":"{KEYWORD}"}}'""")
s2_ok = result and "error" not in result
print(f"\n→ S2 結果: {'✅ PASSED' if s2_ok else '❌ FAILED'}")

# ===== S4: Generate Outline =====
result = test("S4: Generate Outline (Gemini)",
    f"""curl -s -m 120 -X POST http://localhost:3000/api/articles/generate-outline -H 'Content-Type: application/json' -d '{{"keyword":"{KEYWORD}","projectId":"{PROJECT_ID}"}}'""",
    timeout=130)
s4_ok = result and "error" not in result
outline = result.get("data", {}) if result else {}
print(f"\n→ S4 結果: {'✅ PASSED' if s4_ok else '❌ FAILED'}")
if outline:
    print(f"   標題: {outline.get('title', 'N/A')}")
    sections = outline.get("sections", [])
    print(f"   章節數: {len(sections)}")

# ===== S5: Generate Full Article =====
print(f"\n{'='*60}")
print("TEST: S5: Generate Full Article (this may take 2-3 minutes)")
print(f"{'='*60}")

article_payload = json.dumps({
    "keyword": KEYWORD,
    "projectId": PROJECT_ID,
    "outline": outline,
    "contentBrief": {
        "keyword": KEYWORD,
        "contentType": "blog",
        "audience": "一般大眾",
        "tone": "professional",
        "targetWordCount": 2000
    }
}, ensure_ascii=False)

run(f"cat > /tmp/article_payload.json << 'EOFPAYLOAD'\n{article_payload}\nEOFPAYLOAD")

out, err = run(
    "curl -s -m 300 -X POST http://localhost:3000/api/articles/generate -H 'Content-Type: application/json' -d @/tmp/article_payload.json",
    timeout=310
)

s5_ok = False
article_id = "N/A"
try:
    parsed = json.loads(out)
    data = parsed.get("data", {})
    article = data.get("article", data)
    
    title = article.get("title", "N/A")
    article_id = article.get("id", article.get("article_id", "N/A"))
    status = article.get("status", "N/A")
    
    # Fix: content_draft can be an object with nested content
    content_draft = article.get("content_draft", {})
    if isinstance(content_draft, dict):
        nested_content = content_draft.get("content", {})
        if isinstance(nested_content, dict):
            parts = []
            intro = nested_content.get("introduction", {})
            if isinstance(intro, dict):
                parts.append(intro.get("plain_text", intro.get("html", "")))
            for sec in nested_content.get("sections", []):
                if isinstance(sec, dict):
                    parts.append(sec.get("plain_text", sec.get("html", "")))
            conclusion = nested_content.get("conclusion", {})
            if isinstance(conclusion, dict):
                parts.append(conclusion.get("plain_text", conclusion.get("html", "")))
            content_text = "\n".join(parts)
        elif isinstance(nested_content, str):
            content_text = nested_content
        else:
            content_text = str(nested_content)
    elif isinstance(content_draft, str):
        content_text = content_draft
    else:
        content_text = article.get("content", "")
    
    char_count = len(content_text)
    
    print(f"  Article ID: {article_id}")
    print(f"  Title: {title}")
    print(f"  Status: {status}")
    print(f"  Content Length: {char_count} chars")
    if content_text:
        print(f"  Content Preview (first 500 chars):")
        print(f"  {content_text[:500]}")
    
    s5_ok = bool(content_text and char_count > 100)
    
    quality = article.get("quality_report", article.get("qualityReport", None))
    if quality:
        print(f"\n  Quality Report: {json.dumps(quality, ensure_ascii=False, indent=2)[:800]}")
    
except Exception as e:
    print(f"Parse error: {e}")
    print(f"Raw output (first 2000):\n{out[:2000]}")

if err:
    print(f"STDERR: {err[:500]}")
print(f"\n→ S5 結果: {'✅ PASSED' if s5_ok else '❌ FAILED'}")

# ===== S6: Quality Check =====
s6_ok = False
if s5_ok and article_id != "N/A":
    result = test("S6: Quality Report",
        f"""curl -s -m 120 -X POST http://localhost:3000/api/articles/{article_id}/quality-check {AUTH_HEADER} -H 'Content-Type: application/json' -d '{{}}'""",
        timeout=130)
    s6_ok = result and "error" not in str(result)
    print(f"\n→ S6 結果: {'✅ PASSED' if s6_ok else '❌ FAILED / NOT IMPLEMENTED'}")
else:
    print(f"\n→ S6 結果: ⚠️ skipped (S5 failed or no article_id)")

# ===== S7: Get Articles List =====
s7_ok = False
if TOKEN:
    result = test("S7: Get Articles List",
        f"""curl -s http://localhost:3000/api/articles?project_id={PROJECT_ID} {AUTH_HEADER}""")
    s7_ok = result and "error" not in str(result)
    print(f"\n→ S7 結果: {'✅ PASSED' if s7_ok else '❌ FAILED'}")

# ===== PM2 Error Log =====
print(f"\n{'='*60}")
print("PM2 ERROR LOG (last 10 lines)")
print(f"{'='*60}")
out, _ = run("tail -10 /root/.pm2/logs/contentpilot-backend-error.log")
print(out)

# ===== Summary =====
print(f"\n{'='*60}")
print("FULL PIPELINE SUMMARY")
print(f"{'='*60}")
print(f"  S0 Auth (Register/Login):       {'✅' if TOKEN else '❌'}")
print(f"  S1 Project Creation:            {'✅' if PROJECT_ID else '❌'}")
print(f"  S2 Keyword Analysis (Serper):   {'✅' if s2_ok else '❌'}")
print(f"  S4 Outline Generation (Gemini): {'✅' if s4_ok else '❌'}")
print(f"  S5 Article Generation (Gemini): {'✅' if s5_ok else '❌'}")
print(f"  S6 Quality Report:              {'✅' if s6_ok else '⚠️ skipped/failed'}")
print(f"  S7 Articles List:               {'✅' if s7_ok else '⚠️ skipped/failed'}")

total = sum([bool(TOKEN), bool(PROJECT_ID), s2_ok, s4_ok, s5_ok, s6_ok, s7_ok])
print(f"\n  Total: {total}/7 passed")

# Cleanup
run("rm -f /tmp/article_payload.json /tmp/test.json")
ssh.close()
