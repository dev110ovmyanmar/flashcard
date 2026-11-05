import assert from "node:assert/strict";
import { test } from "node:test";
import {
  repairBrokenMyanmar,
  stripForeignGlosses,
  stripMetaNumberLabels,
} from "./clean-burmese";

test("strips Thai and mixed Thai–Myanmar tokens like သัပတ", () => {
  // Mixed token containing Thai mai han-akat / po pla is removed as a whole word.
  assert.equal(stripForeignGlosses("သัပတ အတွင်း"), "အတွင်း");
  assert.equal(stripForeignGlosses("တစ် သัပတ အတွင်း"), "တစ် အတွင်း");
  assert.equal(stripForeignGlosses("สัปดาห์ အတွင်း"), "အတွင်း");
  assert.equal(stripForeignGlosses("သတင်းစာ"), "သတင်းစာ");
});

test("strips Korean glosses", () => {
  assert.match(stripForeignGlosses("뿐만 아니라 / ထို့အပြင်"), /ထို့အပြင်/);
  assert.equal(stripForeignGlosses("뿐만 아니라 / ထို့အပြင်").includes("뿐만"), false);
  assert.equal(stripForeignGlosses("하기로 / လုပ်ရန်").includes("하기로"), false);
  assert.match(stripForeignGlosses("하기로 / လုပ်ရန်"), /လုပ်ရန်/);
});

test("strips Devanagari / Hindi tokens like अग", () => {
  assert.equal(stripForeignGlosses("अग").includes("अग"), false);
  assert.equal(stripForeignGlosses("अग / ရှေ့"), "ရှေ့");
  assert.equal(stripForeignGlosses("ရှေ့ अग ဆက်"), "ရှေ့ ဆက်");
  assert.match(stripForeignGlosses("မင်္ဂလာပါ"), /မင်္ဂလာပါ/);
});

test("normalizes ဥပမာ garbles (Latin p / Hebrew pe / Bengali) and strips leftover Hebrew", () => {
  assert.equal(stripForeignGlosses("ဥpမာ: စာကြောင်း"), "ဥပမာ: စာကြောင်း");
  assert.equal(stripForeignGlosses("ဥפမာ: စာကြောင်း"), "ဥပမာ: စာကြောင်း");
  assert.equal(stripForeignGlosses("ဥপমা: စာကြောင်း"), "ဥပမာ: စာကြောင်း");
  assert.equal(stripForeignGlosses("ဥপမာ"), "ဥပမာ");
  assert.equal(stripForeignGlosses("שלום / မင်္ဂလာပါ"), "မင်္ဂလာပါ");
  assert.equal(stripForeignGlosses("ဥပမာ"), "ဥပမာ");
});

test("repairs word-initial kinzi garbage like င်္ဟောင်ဆောင်နေသည်", () => {
  assert.equal(repairBrokenMyanmar("င်္ဟောင်ဆောင်နေသည်။"), "ဟန်ဆောင်နေသည်။");
  assert.equal(stripForeignGlosses("င်္ဟောင်ဆောင်နေသည်။"), "ဟန်ဆောင်နေသည်။");
  // Mid-word kinzi in real words must stay (မင်္ဂလာ, သင်္ချာ).
  assert.equal(repairBrokenMyanmar("မင်္ဂလာပါ"), "မင်္ဂလာပါ");
  assert.equal(repairBrokenMyanmar("သင်္ချာ"), "သင်္ချာ");
});

test("repairs ဟောင်ဆောင် → ဟန်ဆောင် without kinzi", () => {
  assert.equal(repairBrokenMyanmar("သူ ဟောင်ဆောင်နေသည်။"), "သူ ဟန်ဆောင်နေသည်။");
});

test("strips meta number labels like နံပါတ် ၁", () => {
  assert.equal(stripMetaNumberLabels("နံပါတ် ၁ ယောက်ျား: မင်္ဂလာပါ။"), "ယောက်ျား: မင်္ဂလာပါ။");
  assert.equal(stripMetaNumberLabels("နံပါတ်၁။ မိန်းမ: ဟုတ်ကဲ့။"), "မိန်းမ: ဟုတ်ကဲ့။");
  assert.equal(stripForeignGlosses("နံပါတ် ၂ အဆင်ပြေပါတယ်။"), "အဆင်ပြေပါတယ်။");
  assert.equal(stripForeignGlosses("အမှတ် 3 လုပ်မည်။"), "လုပ်မည်။");
});

test("strips Vietnamese Latin tokens like liệu", () => {
  assert.equal(stripForeignGlosses("liệu").includes("liệu"), false);
  assert.equal(stripForeignGlosses("được / ရနိုင်သည်"), "ရနိုင်သည်");
  assert.equal(stripForeignGlosses("မေးခွန်း liệu အဖြေ"), "မေးခွန်း အဖြေ");
  assert.match(stripForeignGlosses("မင်္ဂလာပါ"), /မင်္ဂလာပါ/);
});
