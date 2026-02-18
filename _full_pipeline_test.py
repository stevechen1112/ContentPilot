import paramiko, json, time

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

PROJECT_ID = "22e7d6b9-adab-48d5-97fb-e56205143e33"
KEYWORD = "膝蓋痛原因"

# ===== S2: Keyword / SERP Analysis =====
result = test("S2: Keyword Analysis (Serper)",
    f"""curl -s -X POST http://localhost:3000/api/research/analyze-keyword -H 'Content-Type: application/json' -d '{{"keyword":"{KEYWORD}"}}'""")
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

# Write payload to file on server to avoid escaping
run(f"cat > /tmp/article_payload.json << 'EOFPAYLOAD'\n{article_payload}\nEOFPAYLOAD")

out, err = run(
    "curl -s -m 300 -X POST http://localhost:3000/api/articles/generate -H 'Content-Type: application/json' -d @/tmp/article_payload.json",
    timeout=310
)

try:
    parsed = json.loads(out)
    # Show key fields only
    data = parsed.get("data", {})
    article = data.get("article", data)
    
    title = article.get("title", "N/A")
    content = article.get("content_draft", article.get("content", ""))
    word_count = len(content) if content else 0
    article_id = article.get("id", "N/A")
    status = article.get("status", "N/A")
    
    print(f"  Article ID: {article_id}")
    print(f"  Title: {title}")
    print(f"  Status: {status}")
    print(f"  Content Length: {word_count} chars")
    if content:
        print(f"  Content Preview (first 500 chars):")
        print(f"  {content[:500]}")
    
    s5_ok = bool(content and word_count > 100)
    
    # Check quality data if present
    quality = article.get("quality_report", article.get("qualityReport", None))
    if quality:
        print(f"\n  Quality Report: {json.dumps(quality, ensure_ascii=False, indent=2)[:800]}")
    
except Exception as e:
    print(f"Parse error: {e}")
    print(f"Raw output (first 2000):\n{out[:2000]}")
    s5_ok = False

if err:
    print(f"STDERR: {err[:500]}")
print(f"\n→ S5 結果: {'✅ PASSED' if s5_ok else '❌ FAILED'}")

# ===== Check PM2 logs for errors =====
print(f"\n{'='*60}")
print("PM2 ERROR LOG (last 15 lines after test)")
print(f"{'='*60}")
out, _ = run("tail -15 /root/.pm2/logs/contentpilot-backend-error.log")
print(out)

print(f"\n{'='*60}")
print("PM2 OUT LOG (last 20 lines after test)")
print(f"{'='*60}")
out, _ = run("tail -20 /root/.pm2/logs/contentpilot-backend-out.log")
print(out)

# ===== S6: Quality Check (if article exists) =====
if s5_ok and article_id != "N/A":
    result = test("S6: Quality Report",
        f"""curl -s -m 60 http://localhost:3000/api/articles/{article_id}/quality-report""",
        timeout=70)
    s6_ok = result and "error" not in str(result)
    print(f"\n→ S6 結果: {'✅ PASSED' if s6_ok else '❌ FAILED / NOT IMPLEMENTED'}")
else:
    s6_ok = False

# ===== Summary =====
print(f"\n{'='*60}")
print("FULL PIPELINE SUMMARY")
print(f"{'='*60}")
print(f"  S2 Keyword Analysis (Serper):   {'✅' if s2_ok else '❌'}")
print(f"  S4 Outline Generation (Gemini): {'✅' if s4_ok else '❌'}")
print(f"  S5 Article Generation (Gemini): {'✅' if s5_ok else '❌'}")
print(f"  S6 Quality Report:              {'✅' if s6_ok else '⚠️ skipped/failed'}")

# Cleanup
run("rm -f /tmp/article_payload.json /tmp/test.json")
ssh.close()
