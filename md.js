"use strict";
// ===== 設定: 読み込む Markdown ファイル (このページからの相対パス or URL) =====
var MD_FILE = "index.txt";
// =====================================================================

// --- Markdown -> HTML (簡易パーサ、外部ライブラリ不使用) ---
// index.html / editor.html から共用される。機能追加はこのファイルに書く。
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// {色}テキスト{/色} -> 背景色付き (色名 or #hex。例: {red}、{#ff0}、{ff0000})
function colorOf(mark) {
  return /^([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(mark) ? "#" + mark : mark;
}

// フォルダパス判定 (\\サーバー\共有\dir または Y:\dir)
function isFolderPath(u) { return /^\\\\/.test(u) || /^[A-Za-z]:[\\\/]/.test(u); }

// \\srv\dir -> file://srv/dir,  Y:\dir -> file:///Y:/dir
function fileUrl(u) {
  return /^\\\\/.test(u) ? "file:" + u.replace(/\\/g, "/") : "file:///" + u.replace(/\\/g, "/");
}

// パス/URLをクリップボードにコピー (http配信ではclipboard APIが使えないのでfallbackあり)
function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t);
  } else {
    var ta = document.createElement("textarea");
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }
}

function copyPath(el) { copyText(el.getAttribute("data-path") || ""); }

// リンク横のコピーボタン
function copyBtn(btn) {
  copyText(btn.getAttribute("data-path") || "");
  btn.textContent = "コピー済";
  setTimeout(function () { btn.textContent = "コピー"; }, 1500);
}

function inline(s) {
  // リンク・コード等を先に生成してプレースホルダ退避し、装飾(* _ ~~)がURLやコード内で誤爆しないようにする
  var stash = [];
  function keep(html) { stash.push(html); return "\u0000" + (stash.length - 1) + "\u0000"; }
  function stripAngle(u) { return u.charAt(0) === "<" ? u.slice(1, -1) : u; }
  function copyBtnTag(rawPath) {
    return '<button type="button" class="cpbtn" data-path="' + rawPath.replace(/"/g, "&quot;") +
           '" onclick="copyBtn(this)">コピー</button>';
  }
  function linkTag(text, url) {
    var raw = url;
    url = url.replace(/"/g, "%22");
    if (isFolderPath(url)) {
      return keep('<a href="' + fileUrl(url) + '" data-path="' + raw.replace(/"/g, "&quot;") +
                '" title="クリックでパスをコピー" onclick="copyPath(this)">' + text + '</a>' + copyBtnTag(raw));
    }
    return keep('<a href="' + url + '">' + text + '</a>' + copyBtnTag(raw));
  }

  s = esc(s);
  s = s.replace(/\{([#A-Za-z0-9]+)\}([\s\S]*?)\{\/\1\}/g, function (_, c, t) {
    return keep('<span style="background-color:' + colorOf(c) + '">' + t + '</span>');
  });
  s = s.replace(/`([^`]+)`/g, function (_, c) { return keep("<code>" + c + "</code>"); });

  // [text](url) / ![alt](src) : URLは ()・※・全角空白を含んでもよい (<>囲みも可)。
  // 閉じていない ) も、直後が空白・句読点でなければURLの一部とみなす (フォルダ名に)を含むため)
  var urlRe = "(<[^>]*>|(?:\\\\.|\\([^()\\u0000-\\u0020]*\\)|\\)(?=[^\\u0000-\\u0020\\u3000()\\[\\]{},.;:!?、。，．！？；：'\"”’）])|[^()\\u0000-\\u0020])+)";
  var urlTail = "(\\s+\"[^\"]*\")?\\s*\\)";
  s = s.replace(new RegExp("!\\[([^\\]]*)\\]\\(" + urlRe + urlTail, "g"), function (_, alt, url) {
    return keep('<img alt="' + alt + '" src="' + stripAngle(url).replace(/"/g, "%22") + '">');
  });
  s = s.replace(new RegExp("\\[([^\\]]+)\\]\\(" + urlRe + urlTail, "g"), function (_, t, url) {
    return linkTag(t, stripAngle(url));
  });
  // http(s) URLの自動リンク
  s = s.replace(/(https?:\/\/[^\s<>"'()]+(?:\([^()\s]*\)[^\s<>"'()]*)*)/g, function (_, u) {
    var t = u.replace(/[.,;:!?、。]+$/, "");
    return keep('<a href="' + t + '">' + t + '</a>' + copyBtnTag(t)) + u.slice(t.length);
  });
  // フォルダパスの自動リンク (行末・半角空白まで。フォルダ名中の全角空白・()・※も含む。末尾の句読点はリンクから外す)
  s = s.replace(/(\\\\[^\u0000-\u0020<>"']+|(?<![A-Za-z0-9_])[A-Za-z]:[\\\/][^\u0000-\u0020<>"']+)/g, function (_, p) {
    var t = p.replace(/[.,;:!?、。]+$/, "");
    return linkTag(t, t) + p.slice(t.length);
  });

  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  s = s.replace(/(^|[^A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  return s.replace(/\u0000(\d+)\u0000/g, function (_, n) { return stash[+n]; });
}

function render(src) {
  var lines = src.replace(/\r\n?/g, "\n").split("\n");
  var html = "", i = 0;

  function isTableLine(l) { return /\|/.test(l) && !/^\s*([-*+]|\d+[.)])\s/.test(l); }
  function isTableSep(l) { return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l) && /-/.test(l); }
  function splitRow(l) {
    return l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split(/(?<!\\)\|/)
      .map(function (c) { return c.trim().replace(/\\\|/g, "|"); });
  }

  while (i < lines.length) {
    var line = lines[i];
    if (/^\s*$/.test(line)) { i++; continue; }

    // コードブロック ```
    if (/^\s*```/.test(line)) {
      var buf = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      html += "<pre><code>" + esc(buf.join("\n")) + "</code></pre>";
      continue;
    }

    // 見出し
    var m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      html += "<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">";
      i++; continue;
    }

    // 水平線
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { html += "<hr>"; i++; continue; }

    // 引用
    if (/^\s*>/.test(line)) {
      var q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      html += "<blockquote>" + render(q.join("\n")) + "</blockquote>";
      continue;
    }

    // テーブル (外側のパイプは省略可。ヘッダと区切り行の列数が一致するものだけ)
    if (isTableLine(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      var head = splitRow(line);
      var aligns = splitRow(lines[i + 1]).map(function (a) {
        if (/^:-+:$/.test(a)) return "center";
        if (/^-+:$/.test(a)) return "right";
        return "";
      });
      if (head.length === aligns.length) {
        i += 2;
        var rows = [];
        while (i < lines.length && isTableLine(lines[i]) && !isTableSep(lines[i])) rows.push(splitRow(lines[i++]));
        // セル全体が {色}...{/色} ならセル自体に背景色を付ける
        function cell(tag, text, align) {
          var style = align ? "text-align:" + align : "";
          var cm = text.match(/^\s*\{([#A-Za-z0-9]+)\}([\s\S]*)\{\/\1\}\s*$/);
          if (cm) { style += (style ? ";" : "") + "background-color:" + colorOf(cm[1]); text = cm[2]; }
          return "<" + tag + (style ? ' style="' + style + '"' : "") + ">" + inline(text) + "</" + tag + ">";
        }
        var t = "<table><thead><tr>";
        for (var j = 0; j < head.length; j++) t += cell("th", head[j], aligns[j]);
        t += "</tr></thead><tbody>";
        rows.forEach(function (r) {
          t += "<tr>";
          for (var j = 0; j < head.length; j++) t += cell("td", r[j] || "", aligns[j]);
          t += "</tr>";
        });
        html += t + "</tbody></table>";
        continue;
      }
    }

    // リスト (-, *, +, 1. / ネストは2段まで)
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      var stack = []; // {indent, ordered}
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        var lm = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        var indent = lm[1].replace(/\t/g, "    ").length;
        var ordered = /\d/.test(lm[2][0]);
        var body = lm[3];
        while (stack.length && indent < stack[stack.length - 1].indent) {
          html += stack.pop().ordered ? "</ol>" : "</ul>";
        }
        if (!stack.length || indent > stack[stack.length - 1].indent) {
          html += ordered ? "<ol>" : "<ul>";
          stack.push({ indent: indent, ordered: ordered });
        } else if (ordered !== stack[stack.length - 1].ordered) {
          html += stack.pop().ordered ? "</ol>" : "</ul>";
          html += ordered ? "<ol>" : "</ul>";
          stack.push({ indent: indent, ordered: ordered });
        }
        body = body.replace(/^\[( |x|X)\]\s+/, function (_, c) {
          return (c === " " ? "\u2610 " : "\u2611 ");
        });
        html += "<li>" + inline(body) + "</li>";
        i++;
      }
      while (stack.length) html += stack.pop().ordered ? "</ol>" : "</ul>";
      continue;
    }

    // 段落 (空行までまとめる)
    var para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
           !/^\s*```/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i]) &&
           !/^\s*>/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) &&
           !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i]) &&
           !(isTableLine(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]) &&
             splitRow(lines[i]).length === splitRow(lines[i + 1]).length)) {
      para.push(lines[i++]);
    }
    html += "<p>" + para.map(inline).join("<br>") + "</p>";
  }
  return html;
}

// --- 読み込み補助 ---
function decode(buf) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch (e) { return new TextDecoder("shift-jis").decode(buf); }
}
