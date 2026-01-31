const FORMS = {
  sg: ["gen_sg", "dat_sg", "acc_sg", "ins_sg"],
  pl: ["nom_pl", "gen_pl", "dat_pl", "acc_pl", "ins_pl"]
};

const FORM_LABELS_JA = {
  gen_sg: "生格単数",
  dat_sg: "与格単数",
  acc_sg: "対格単数",
  ins_sg: "造格単数",
  nom_pl: "主格複数",
  gen_pl: "生格複数",
  dat_pl: "与格複数",
  acc_pl: "対格複数",
  ins_pl: "造格複数"
};

const $ = (id) => document.getElementById(id);

let words = [];
let current = null; // {lemma, formKey, correct}
let stats = { total: 0, correct: 0, wrong: [] };

function normalize(s, yoAsE = true) {
  if (!s) return "";
  s = s.trim().toLowerCase();
  if (yoAsE) s = s.replaceAll("ё", "е");
  s = s.replace(/\s+/g, " ");
  return s;
}

function saveStats() {
  localStorage.setItem("rcp_stats", JSON.stringify(stats));
}

function loadStats() {
  try {
    const raw = localStorage.getItem("rcp_stats");
    if (!raw) return;
    stats = JSON.parse(raw);
  } catch (_) {}
}

function updateScore() {
  const acc = stats.total ? (stats.correct / stats.total) * 100 : 0;
  $("score").textContent = `${stats.correct}/${stats.total} (${acc.toFixed(1)}%)`;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chooseForm(mode) {
  if (mode === "sg") return pickRandom(FORMS.sg);
  if (mode === "pl") return pickRandom(FORMS.pl);
  // mix
  const group = pickRandom(["sg", "pl"]);
  return pickRandom(FORMS[group]);
}

function pickQuestion() {
  const mode = $("mode").value;

  if (mode === "wrong") {
    if (!stats.wrong.length) return null;
    const key = pickRandom(stats.wrong); // lemma|form
    const [lemma, formKey] = key.split("|");
    const w = words.find(x => x.lemma === lemma);
    if (!w) return null;
    return { lemma: w.lemma, formKey, correct: w.forms[formKey] };
  }

  const formKey = chooseForm(mode);
  const w = pickRandom(words);
  const correct = w.forms[formKey];
  if (!correct) return pickQuestion(); // try again
  return { lemma: w.lemma, formKey, correct };
}

function renderQuestion(q) {
  current = q;
  $("tag").textContent = FORM_LABELS_JA[q.formKey] || q.formKey;
  $("lemma").textContent = q.lemma;
  $("answer").value = "";
  $("answer").focus();
  $("result").innerHTML = "";
}

function addWrong(lemma, formKey) {
  const key = `${lemma}|${formKey}`;
  if (!stats.wrong.includes(key)) stats.wrong.push(key);
}

function removeWrong(lemma, formKey) {
  const key = `${lemma}|${formKey}`;
  stats.wrong = stats.wrong.filter(x => x !== key);
}

function checkAnswer() {
  if (!current) return;

  const yoAsE = $("yoAsE").checked;
  const ans = $("answer").value;
  const ok = normalize(ans, yoAsE) === normalize(current.correct, yoAsE);

  stats.total += 1;
  if (ok) {
    stats.correct += 1;
    removeWrong(current.lemma, current.formKey);
    $("result").innerHTML = `<span class="ok">✅ 合ってるよ！</span> 正解: <code>${current.correct}</code>`;
  } else {
    addWrong(current.lemma, current.formKey);
    $("result").innerHTML = `<span class="ng">❌ ちがうよ</span> 正解: <code>${current.correct}</code>`;
  }

  saveStats();
  updateScore();
}

function nextQuestion() {
  const q = pickQuestion();
  if (!q) {
    $("result").innerHTML = `<span class="ng">⚠️ 復習する問題がありません</span>`;
    return;
  }
  renderQuestion(q);
}

async function loadWords() {
  const res = await fetch("words.json");
  if (!res.ok) throw new Error("words.json を読み込めませんでした");
  words = await res.json();
  if (!Array.isArray(words) || !words.length) throw new Error("words.json が空です");
}

function wireUI() {
  $("checkBtn").addEventListener("click", checkAnswer);
  $("nextBtn").addEventListener("click", nextQuestion);
  $("resetBtn").addEventListener("click", () => {
    if (!confirm("成績をリセットしますか？")) return;
    stats = { total: 0, correct: 0, wrong: [] };
    saveStats();
    updateScore();
    nextQuestion();
  });

  $("answer").addEventListener("keydown", (e) => {
    if (e.key === "Enter") checkAnswer();
  });

  $("mode").addEventListener("change", () => {
    // wrong mode but no wrong items -> warn
    if ($("mode").value === "wrong" && !stats.wrong.length) {
      $("result").innerHTML = `<span class="ng">⚠️ まだ間違えた問題がありません</span>`;
    }
    nextQuestion();
  });
}

(async function init() {
  loadStats();
  updateScore();
  wireUI();

  try {
    await loadWords();
    nextQuestion();
  } catch (err) {
    $("result").innerHTML = `<span class="ng">❌ 起動エラー:</span> ${err.message}`;
  }
})();
