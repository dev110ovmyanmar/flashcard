import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  incorrectReasonHeading,
  parseIncorrectReasonItems,
  splitGrammarQuestionText,
  splitIncorrectReasonBody,
} from "./grammar-format";

describe("parseIncorrectReasonItems", () => {
  it("parses bullet lines with pattern and em dash", () => {
    const items = parseIncorrectReasonItems(
      "• 2 にかかわらず — ပုံမှန်အားဖြင့် မကိုက်ညီ။\n• 3 にせよ — ရွေးချယ်မှုကို ပြသည်။\n• 4 とはいえ — လေယူလေသိမ်း မတူ။",
    );
    assert.equal(items.length, 3);
    assert.equal(items[0]?.option, "2");
    assert.equal(items[0]?.pattern, "にかかわらず");
    assert.match(items[0]?.body ?? "", /ပုံမှန်/);
    assert.equal(items[0]?.example, "");
    assert.equal(incorrectReasonHeading(items[1]!), "3 にせよ");
  });

  it("parses colon-style headings like 2 わけだ:", () => {
    const items = parseIncorrectReasonItems("2 わけだ: အကြောင်းပြချက်။\n3 ようだ: ခန့်မှန်းချက်။");
    assert.equal(items.length, 2);
    assert.equal(items[0]?.pattern, "わけだ");
    assert.equal(items[1]?.pattern, "ようだ");
  });

  it("keeps 《furigana》 on grammar patterns for hover", () => {
    const items = parseIncorrectReasonItems(
      "2 にかかわらず《にかかわらず》: ‘မည်သို့ပင်ဖြစ်စေ’ ဟု ဆိုလိုပြီး မကိုက်။\n3 にせよ《にせよ》: ရွေးချယ်မှုကို ပြသည်။",
    );
    assert.equal(items.length, 2);
    assert.equal(items[0]?.pattern, "にかかわらず《にかかわらず》");
    assert.match(items[0]?.body ?? "", /မည်သို့ပင်ဖြစ်စေ/);
  });

  it("extracts ဥပမာ example sentences from distractor lines", () => {
    const items = parseIncorrectReasonItems(
      "2 にかかわらず《にかかわらず》: မကိုက်ညီ။ ဥပမာ: 年齢《ねんれい》にかかわらず、誰《だれ》でも参加《さんか》できる。\n3 にせよ《にせよ》: ရွေးချယ်မှု။ 例: 彼《かれ》が来《く》るにせよ来《こ》ないにせよ、会議《かいぎ》は進《すす》める。",
    );
    assert.equal(items.length, 2);
    assert.match(items[0]?.body ?? "", /မကိုက်ညီ/);
    assert.match(items[0]?.example ?? "", /年齢/);
    assert.match(items[1]?.example ?? "", /会議/);
  });

  it("splits jammed bullet paragraphs", () => {
    const items = parseIncorrectReasonItems(
      "• 2 わけだ: wrong here • 3 ようだ: also wrong • 4 そうだ: hearsay only",
    );
    assert.ok(items.length >= 2);
    assert.equal(items[0]?.option, "2");
  });

  it("returns empty for blank input", () => {
    assert.deepEqual(parseIncorrectReasonItems("  "), []);
  });
});

describe("splitIncorrectReasonBody", () => {
  it("splits Burmese reason from ဥပမာ example", () => {
    const split = splitIncorrectReasonBody(
      "မကိုက်ညီ။ ဥပမာ: 年齢《ねんれい》にかかわらず、参加《さんか》できる。",
    );
    assert.match(split.body, /မကိုက်ညီ/);
    assert.match(split.example, /年齢/);
  });

  it("splits garbled ဥpမာ marker (Latin p) like other options", () => {
    const split = splitIncorrectReasonBody(
      "အကြောင်းရင်းကို ပြသည်။ ဥpမာ: 電車が遅れたせいで遅刻した。",
    );
    assert.match(split.body, /အကြောင်းရင်း/);
    assert.equal(split.example, "電車が遅れたせいで遅刻した。");
  });

  it("splits 例: marker preferred by the model prompt", () => {
    const split = splitIncorrectReasonBody(
      "မကိုက်ညီ။ 例: 電車《でんしゃ》が遅《おく》れたせいで遅刻《ちこく》した。",
    );
    assert.match(split.body, /မကိုက်ညီ/);
    assert.match(split.example, /電車/);
  });

  it("returns body only when no example marker", () => {
    assert.deepEqual(splitIncorrectReasonBody("理由だけ。"), {
      body: "理由だけ。",
      example: "",
    });
  });
});

describe("parseIncorrectReasonItems orphan examples", () => {
  it("attaches a wrapped ဥpမာ line to the previous option", () => {
    const items = parseIncorrectReasonItems(
      "3 せいで《せいで》: အကြောင်းရင်းကို ပြသည်။\nဥpမာ: 電車が遅れたせいで遅刻した。",
    );
    assert.equal(items.length, 1);
    assert.equal(items[0]?.option, "3");
    assert.match(items[0]?.body ?? "", /အကြောင်းရင်း/);
    assert.equal(items[0]?.example, "電車が遅れたせいで遅刻した。");
  });
});

describe("splitGrammarQuestionText", () => {
  it("splits a jammed options line into numbered choices", () => {
    const parts = splitGrammarQuestionText(
      "彼は忙しい_____、いつも笑顔で対応してくれる。\n1 にもかかわらず 2 にかかわらず 3 にせよ 4 とはいえ",
    );
    assert.match(parts.stem, /忙しい/);
    assert.equal(parts.options.length, 4);
    assert.equal(parts.options[0]?.label, "1");
    assert.equal(parts.options[0]?.text, "にもかかわらず");
    assert.equal(parts.options[3]?.label, "4");
  });

  it("keeps already dotted one-per-line options", () => {
    const parts = splitGrammarQuestionText(
      "雨_____、試合は行われた。\n1. にもかかわらず\n2. にかかわらず\n3. にせよ\n4. とはいえ",
    );
    assert.equal(parts.options.length, 4);
    assert.equal(parts.options[1]?.label, "2");
    assert.equal(parts.options[1]?.text, "にかかわらず");
  });
});
