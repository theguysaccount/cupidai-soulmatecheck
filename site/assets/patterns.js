// Fixed answer patterns for the end-to-end self-test and the fixture links in tests/fixtures/.
export const PEOPLE = {
  A: { name: "Alex", answer: (i) => ({ a: ((i * 7) % 5) + 1, imp: i % 4 }) },
  B: { name: "Sam", answer: (i) => ({ a: i === 5 ? 0 : ((i * 3) % 5) + 1, imp: (i + 1) % 4 }) },
};
export const answersFor = (who, n) => Array.from({ length: n }, (_, i) => PEOPLE[who].answer(i));
