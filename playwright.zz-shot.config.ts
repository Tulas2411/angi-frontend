import base from "./playwright.config";

export default { ...base, testMatch: ["zz-dish-shot.spec.ts"], grep: /zz shot/ };
