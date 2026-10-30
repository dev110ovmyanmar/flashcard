import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { incorrectReasonHeading, parseIncorrectReasonItems } from "./grammar-format";

describe("parseIncorrectReasonItems", () => {
  it("parses bullet lines with pattern and em dash", () => {
    const items = parseIncorrectReasonItems(
      "• 2 にかかわらず — ပုံမှန်အားဖြင့် မကိုက်ညီ။\n• 3 にせよ — ရွေးချယ်မှုကို ပြသည်။\n• 4 とはいえ — လေယူလေသိမ်း မတူ။",
    );
    assert.equal(items.length, 3);
    assert.equal(items[0]?.option, "2");
    assert.equal(items[0]?.pattern, "にかかわらず");
    assert.match(items[0]?.body ?? "", /ပုံမှန်/);
    assert.equal(incorrectReasonHeading(items[1]!), "3 にせよ");
  });

  it("parses colon-style headings like 2 わけだ:", () => {
    const items = parseIncorrectReasonItems("2 わけだ: အကြောင်းပြချက်။\n3 ようだ: ခန့်မှန်းချက်။");
    assert.equal(items.length, 2);
    assert.equal(items[0]?.pattern, "わけだ");
    assert.equal(items[1]?.pattern, "ようだ");
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
