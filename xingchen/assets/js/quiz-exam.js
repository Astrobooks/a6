/* ==========================================================================
   考试模式答题引擎  ExamQuiz
   - 不显示正确答案与解析，交卷后每题只显示 ✓ / ✗
   - 主观题拆空判分，长方程式/理由类设为「选填」不计分
   - 交卷生成「成绩码」，教师端汇总页解析统计
   数据：{"title","examMode":true,"sections":[{title,questions:[...]}]}
   选择题 q：{num,type:"choice",stem:[frag],options:[{label,frags}],table?,answer}
   主观题 q：{num,type:"fill",stem:[frag],parts:[{label,frags,blanks:[{id,ph,accept,manual}]}]}
   ========================================================================== */
(function () {
  "use strict";

  var MARK = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
  var CODE_PREFIX = "XC3-";

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function fragsHtml(frags, dir) {
    var h = "";
    (frags || []).forEach(function (f) {
      if (f.t !== undefined) {
        h += esc(f.t).replace(/\n/g, "<br/>");
      } else if (f.i !== undefined) {
        var cls = f.g ? "xq-fx g" : "xq-fx";
        var st = "height:" + f.h + "px";
        if (f.g && f.w) st += ";max-width:100%";
        h += '<img class="' + cls + '" src="' + dir + esc(f.i) + '" style="' + st +
          '" alt="公式" loading="lazy" title="点击放大"/>';
      } else if (f.h !== undefined) {
        h += f.h;
      }
    });
    return h;
  }

  /* 化学式/数值比对用的归一化 */
  var SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6",
    "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-", "ⁿ": "n" };
  var SUB = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6",
    "₇": "7", "₈": "8", "₉": "9" };

  function norm(s) {
    return String(s == null ? "" : s)
      .replace(/[\s\u3000\u00a0]/g, "")
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ]/g, function (c) { return SUP[c] || c; })
      .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, function (c) { return SUB[c] || c; })
      .replace(/[（(]/g, "(").replace(/[）)]/g, ")")
      .replace(/[：:]/g, ":")
      .replace(/[，,]/g, ",")
      .replace(/[＋]/g, "+").replace(/[－—–−]/g, "-").replace(/[＝]/g, "=")
      .replace(/[。．.]$/g, "")
      .replace(/个$/g, "")
      .toLowerCase();
  }

  function b64e(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /* ---------------- 主类 ---------------- */
  function ExamQuiz(root, data, opts) {
    this.root = root;
    this.data = data;
    this.opts = opts || {};
    this.dir = this.opts.dir || "";
    this.id = this.opts.id || "exam";
    this.picks = {};      // 选择题 num -> letter
    this.vals = {};       // 空 id -> 输入值
    this.submitted = false;
    this.units = this.collectUnits();
    this.build();
  }

  /* 判分单元：选择题 1 个，自动判的空各 1 个 */
  ExamQuiz.prototype.collectUnits = function () {
    var out = [];
    this.data.sections.forEach(function (s) {
      (s.questions || []).forEach(function (q) {
        if (q.type === "choice") {
          out.push({ kind: "choice", num: q.num, q: q });
        } else {
          (q.parts || []).forEach(function (p) {
            (p.blanks || []).forEach(function (b) {
              if (!b.manual && b.accept && b.accept.length) {
                out.push({ kind: "blank", num: q.num, id: b.id, blank: b, part: p });
              }
            });
          });
        }
      });
    });
    return out;
  };

  ExamQuiz.prototype.build = function () {
    var self = this;
    var body = "";
    this.data.sections.forEach(function (sec) {
      body += '<div class="xq-sec-head">' + esc(sec.title || "") +
        '<span class="xq-sec-n">' + (sec.questions || []).length + " 题</span></div>";
      (sec.questions || []).forEach(function (q) {
        body += self.qHtml(q);
      });
    });

    this.root.innerHTML =
      '<div class="xq-bar">' +
      '<span class="xq-bar-t">' + esc(this.opts.title || "在线测试") + "</span>" +
      '<span class="xq-bar-p" id="' + this.id + '-prog">0 / ' + this.units.length + "</span>" +
      '<span class="xq-bar-s"></span>' +
      '<button class="xq-btn primary" data-act="submit" type="button">交卷</button>' +
      "</div>" +
      '<div class="xq-list">' + body + "</div>" +
      '<div class="xq-result" id="' + this.id + '-result"></div>';

    this.bind();
    this.update();
  };

  ExamQuiz.prototype.qHtml = function (q) {
    var d = this.dir;
    var h = '<div class="xq-card" data-num="' + q.num + '" id="' + this.id + '-q' + q.num + '">';
    h += '<div class="xq-head"><span class="xq-no">' + q.num + "</span>" +
      '<span class="xq-tag">' + (q.type === "choice" ? "单选" : "填空") + "</span>" +
      '<span class="xq-mark" data-mark="' + q.num + '"></span></div>';
    h += '<div class="xq-stem">' + fragsHtml(q.stem, d) + "</div>";

    if (q.table) h += '<div class="xq-table">' + String(q.table).replace(/src="/g, 'src="' + d) + "</div>";

    if (q.options && q.options.length) {
      var compact = q.options.every(function (o) { return !o.frags || !o.frags.length; });
      h += '<div class="xq-opts' + (compact ? " compact" : "") + '">';
      q.options.forEach(function (o) {
        h += '<div class="xq-opt" data-num="' + q.num + '" data-label="' + o.label +
          '" role="button" tabindex="0"><span class="xq-dot">' + o.label + "</span>" +
          '<span class="xq-otext">' + (o.frags && o.frags.length ? fragsHtml(o.frags, d) : "") +
          "</span></div>";
      });
      h += "</div>";
    }

    if (q.type === "fill") {
      (q.parts || []).forEach(function (p) {
        h += '<div class="xq-part">';
        h += '<div class="xq-ptext"><b class="xq-plabel">' + esc(p.label) + "</b>" +
          fragsHtml(p.frags, d) + "</div>";
        var bi = 0;
        h += '<div class="xq-blanks">';
        (p.blanks || []).forEach(function (b) {
          h += '<label class="xq-blank" data-id="' + b.id + '">' +
            '<span class="xq-bx">' + (MARK[bi] || "·") + "</span>" +
            '<input class="xq-input" data-id="' + b.id + '" type="text" autocomplete="off" ' +
            'placeholder="' + esc(b.ph || "填写答案") + '"/>' +
            (b.manual ? '<span class="xq-mk">选填</span>' : '<span class="xq-mk"></span>') +
            "</label>";
          bi++;
        });
        h += "</div></div>";
      });
    }

    h += "</div>";
    return h;
  };

  ExamQuiz.prototype.bind = function () {
    var self = this;
    this.root.addEventListener("click", function (e) {
      var act = e.target.closest("[data-act]");
      if (act && act.getAttribute("data-act") === "submit") {
        self.submit();
        return;
      }
      if (act && act.getAttribute("data-act") === "again") {
        self.reset();
        return;
      }
      if (act && act.getAttribute("data-act") === "copy") {
        self.copyCode();
        return;
      }
      var opt = e.target.closest(".xq-opt");
      if (opt && !self.submitted) {
        self.pick(opt.getAttribute("data-num"), opt.getAttribute("data-label"), opt);
        return;
      }
      var img = e.target.closest("img.xq-fx, img.q-table-fx, .xq-table img");
      if (img) self.zoom(img.src);
    });
    this.root.addEventListener("input", function (e) {
      var inp = e.target;
      if (inp.classList && inp.classList.contains("xq-input") && !self.submitted) {
        self.vals[inp.getAttribute("data-id")] = inp.value;
        self.update();
      }
    });
    this.root.addEventListener("keydown", function (e) {
      var opt = e.target.closest(".xq-opt");
      if (opt && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        opt.click();
      }
    });
  };

  ExamQuiz.prototype.pick = function (num, label, el) {
    this.picks[num] = label;
    var card = el.closest(".xq-card");
    card.querySelectorAll(".xq-opt").forEach(function (o) {
      o.classList.toggle("sel", o.getAttribute("data-label") === label);
    });
    this.update();
  };

  ExamQuiz.prototype.update = function () {
    var done = 0;
    this.units.forEach(function (u) {
      if (u.kind === "choice") {
        if (this.picks[u.num]) done++;
      } else {
        if (String(this.vals[u.id] || "").trim()) done++;
      }
    }, this);
    var el = document.getElementById(this.id + "-prog");
    if (el) el.textContent = done + " / " + this.units.length;
  };

  ExamQuiz.prototype.judge = function () {
    var right = 0, answered = 0, detail = {};
    this.units.forEach(function (u) {
      if (u.kind === "choice") {
        var mine = this.picks[u.num];
        var ok = mine && String(mine).toUpperCase() === String(u.q.answer).toUpperCase();
        if (mine) answered++;
        if (ok) right++;
        detail[u.num] = mine || "";
      } else {
        var v = String(this.vals[u.id] || "").trim();
        var ok2 = false;
        if (v) {
          answered++;
          var nv = norm(v);
          ok2 = (u.blank.accept || []).some(function (a) { return norm(a) === nv; });
          if (ok2) right++;
        }
        detail[u.id] = v ? (ok2 ? "1" : "0") : "";
      }
    }, this);
    return { right: right, answered: answered, total: this.units.length, detail: detail };
  };

  ExamQuiz.prototype.submit = function () {
    if (this.submitted) return;
    var res = this.judge();
    var blankCount = this.units.length - res.answered;
    if (blankCount > 0) {
      var msg = "还有 " + blankCount + " 个判分点没有作答，确定现在交卷吗？交卷后不能再修改。";
      if (!window.confirm(msg)) return;
    } else if (!window.confirm("确定交卷吗？交卷后不能再修改答案。")) {
      return;
    }

    this.submitted = true;
    this.result = res;
    this.root.classList.add("xq-locked");

    // 逐题标记对错
    var self = this;
    var byQ = {};
    this.data.sections.forEach(function (s) {
      (s.questions || []).forEach(function (q) {
        if (q.type === "choice") {
          var mine = self.picks[q.num];
          byQ[q.num] = mine ? (String(mine).toUpperCase() === String(q.answer).toUpperCase()) : null;
        } else {
          var any = false, allRight = true, hasUnit = false;
          (q.parts || []).forEach(function (p) {
            (p.blanks || []).forEach(function (b) {
              var box = self.root.querySelector('.xq-blank[data-id="' + b.id + '"]');
              if (!box) return;
              var v = String(self.vals[b.id] || "").trim();
              var mk = box.querySelector(".xq-mk");
              if (b.manual) {
                box.classList.add("manual");
                if (mk) mk.textContent = v ? "已作答" : "未填";
                return;
              }
              hasUnit = true;
              if (!v) {
                box.classList.add("blank");
                if (mk) mk.textContent = "未答";
                allRight = false;
                return;
              }
              any = true;
              var nv = norm(v);
              var ok = (b.accept || []).some(function (a) { return norm(a) === nv; });
              box.classList.add(ok ? "right" : "wrong");
              if (mk) mk.textContent = ok ? "✓" : "✗";
              if (!ok) allRight = false;
            });
          });
          byQ[q.num] = hasUnit ? (any ? allRight : null) : null;
        }
      });
    });

    Object.keys(byQ).forEach(function (n) {
      var el = self.root.querySelector('.xq-mark[data-mark="' + n + '"]');
      var card = self.root.querySelector('.xq-card[data-num="' + n + '"]');
      if (!el) return;
      if (byQ[n] === null) {
        el.textContent = "未答";
        el.className = "xq-mark none";
        if (card) card.classList.add("none");
      } else {
        el.textContent = byQ[n] ? "✓" : "✗";
        el.className = "xq-mark " + (byQ[n] ? "ok" : "no");
        if (card) card.classList.add(byQ[n] ? "ok" : "no");
      }
    });

    // 关闭选项交互
    this.root.querySelectorAll(".xq-input").forEach(function (i) { i.readOnly = true; });

    this.showResult(res, byQ);
  };

  ExamQuiz.prototype.showResult = function (res, byQ) {
    var pct = res.total ? Math.round((res.right / res.total) * 100) : 0;
    var word = pct >= 90 ? "优秀" : pct >= 75 ? "良好" : pct >= 60 ? "合格" : "需加强";
    var wrongNums = Object.keys(byQ).filter(function (n) { return byQ[n] === false; });

    var code = this.makeCode(res);
    this.code = code;

    var box = document.getElementById(this.id + "-result");
    box.innerHTML =
      '<div class="xq-res-head"><span class="xq-res-ico">✓</span>' +
      "<div><h3>已交卷 · 本次得分 " + res.right + " / " + res.total + "</h3>" +
      '<p>正确率 ' + pct + "% · " + word +
      "　每题对错已标在题号旁，本次不显示正确答案。</p></div></div>" +
      '<div class="xq-res-wrong">' +
      (wrongNums.length
        ? "需要回看的题号：" + wrongNums.map(function (n) {
            return '<a href="#' + this.id + "-q" + n + '">' + n + "</a>";
          }, this).join(" ")
        : "全部答对，太棒了！") +
      "</div>" +
      '<div class="xq-code">' +
      "<h4>成绩码（发给老师）</h4>" +
      '<p class="xq-code-tip">复制下面这段码，通过微信／QQ 发给老师。老师汇总后即可看到全班每题情况。</p>' +
      '<textarea class="xq-code-box" id="' + this.id + '-code" readonly>' + esc(code) + "</textarea>" +
      '<div class="xq-code-acts">' +
      '<button class="xq-btn primary" data-act="copy" type="button">复制成绩码</button>' +
      '<button class="xq-btn" data-act="again" type="button">重新作答</button>' +
      "</div>" +
      '<p class="xq-code-sum" id="' + this.id + '-sum">' + esc(this.summaryText(res)) + "</p>" +
      "</div>";

    box.classList.add("on");
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  ExamQuiz.prototype.summaryText = function (res) {
    var who = this.opts.student || {};
    return "姓名：" + (who.name || "—") + "　学号：" + (who.sid || "—") +
      "　得分：" + res.right + "/" + res.total;
  };

  /* 成绩码：XC3-<base64url(JSON)>
     {v:1,q:"chem3",n:姓名,s:学号,t:时间戳,c:"选择题答案",b:"空判定",r:[对,总]} */
  ExamQuiz.prototype.makeCode = function (res) {
    var who = this.opts.student || {};
    var c = "", b = "";
    this.units.forEach(function (u) {
      if (u.kind === "choice") {
        c += this.picks[u.num] || ".";
      } else {
        var v = String(this.vals[u.id] || "").trim();
        b += v ? (res.detail[u.id] === "1" ? "1" : "0") : ".";
      }
    }, this);
    var payload = {
      v: 1,
      q: this.id,
      n: who.name || "",
      s: who.sid || "",
      t: Math.floor(Date.now() / 1000),
      c: c,
      b: b,
      r: [res.right, res.total]
    };
    return CODE_PREFIX + b64e(JSON.stringify(payload));
  };

  ExamQuiz.prototype.copyCode = function () {
    var ta = document.getElementById(this.id + "-code");
    if (!ta) return;
    var ok = false;
    try {
      ta.removeAttribute("readonly");
      ta.select();
      ok = document.execCommand("copy");
      ta.setAttribute("readonly", "readonly");
    } catch (e) { ok = false; }
    if (!ok && navigator.clipboard) {
      navigator.clipboard.writeText(ta.value).then(function () {
        alert("成绩码已复制");
      }, function () {
        alert("复制失败，请长按上面的文字手动复制");
      });
      return;
    }
    alert(ok ? "成绩码已复制" : "复制失败，请长按上面的文字手动复制");
  };

  ExamQuiz.prototype.zoom = function (src) {
    var box = document.getElementById("xq-zoom");
    if (!box) {
      box = document.createElement("div");
      box.id = "xq-zoom";
      box.className = "xq-zoom";
      box.innerHTML = '<button class="xq-zoom-x" type="button">✕</button><img alt="放大查看"/>';
      document.body.appendChild(box);
      box.addEventListener("click", function (e) {
        if (e.target === box || e.target.classList.contains("xq-zoom-x")) {
          box.classList.remove("on");
          document.body.style.overflow = "";
        }
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          box.classList.remove("on");
          document.body.style.overflow = "";
        }
      });
    }
    box.querySelector("img").src = src;
    box.classList.add("on");
    document.body.style.overflow = "hidden";
  };

  ExamQuiz.prototype.reset = function () {
    if (!window.confirm("重新作答将清空本次答案，确定吗？")) return;
    this.picks = {};
    this.vals = {};
    this.submitted = false;
    this.result = null;
    this.root.classList.remove("xq-locked");
    this.build();
    window.scrollTo({ top: this.root.offsetTop - 20, behavior: "smooth" });
  };

  window.ExamEngine = { ExamQuiz: ExamQuiz, norm: norm, CODE_PREFIX: CODE_PREFIX };
})();
