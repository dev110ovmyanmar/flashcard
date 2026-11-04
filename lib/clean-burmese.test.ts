import assert from "node:assert/strict";
import { test } from "node:test";
import { repairBrokenMyanmar, stripForeignGlosses } from "./clean-burmese";

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
});

test("strips Devanagari / Hindi tokens like अग", () => {
  assert.equal(stripForeignGlosses("अग").includes("अग"), false);
  assert.equal(stripForeignGlosses("अग / ရှေ့"), "ရှေ့");
  assert.equal(stripForeignGlosses("ရှေ့ अग ဆက်"), "ရှေ့ ဆက်");
  assert.match(stripForeignGlosses("မင်္ဂလာပါ"), /မင်္ဂလာပါ/);
});

test("normalizes ဥပမာ garbles (Latin p / Hebrew pe) and strips leftover Hebrew", () => {
  assert.equal(stripForeignGlosses("ဥpမာ: စာကြောင်း"), "ဥပမာ: စာကြောင်း");
  assert.equal(stripForeignGlosses("ဥפမာ: စာကြောင်း"), "ဥပမာ: စာကြောင်း");
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
