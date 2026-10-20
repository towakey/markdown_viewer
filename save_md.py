#!python
# -*- coding: utf-8 -*-
# Markdownファイル保存用CGI (IIS + Python 3.7, 標準モジュールのみ)
# editor.html と同じフォルダに置く。POST {"name": "ファイル名", "content": "内容"} を受け、
# このスクリプトと同じディレクトリ内の .md/.markdown/.txt ファイルに書き込む。
import sys
import io
import os
import json

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLOW_EXT = (".md", ".markdown", ".txt")


def respond(status, obj):
    print("Status: " + status)
    print("Content-Type: application/json; charset=utf-8")
    print()
    sys.stdout.write(json.dumps(obj, ensure_ascii=False))


def main():
    if os.environ.get("REQUEST_METHOD") != "POST":
        respond("405 Method Not Allowed", {"ok": False, "error": "POST only"})
        return
    try:
        length = int(os.environ.get("CONTENT_LENGTH") or 0)
        data = json.loads(sys.stdin.buffer.read(length).decode("utf-8"))
    except Exception:
        respond("400 Bad Request", {"ok": False, "error": "invalid request"})
        return
    name = data.get("name") or ""
    content = data.get("content")
    if content is None:
        respond("400 Bad Request", {"ok": False, "error": "no content"})
        return
    # 同じフォルダ内のファイル名のみ許可 (パス・ディレクトリ外の指定は拒否)
    if (not name or "/" in name or "\\" in name or ":" in name
            or name != os.path.basename(name)
            or not name.lower().endswith(ALLOW_EXT)):
        respond("400 Bad Request", {"ok": False, "error": "invalid file name"})
        return
    try:
        with open(os.path.join(BASE_DIR, name), "w", encoding="utf-8", newline="") as f:
            f.write(content)
    except Exception as e:
        respond("500 Internal Server Error", {"ok": False, "error": str(e)})
        return
    respond("200 OK", {"ok": True})


main()
