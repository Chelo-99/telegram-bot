"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundToFirstNonZeroDecimal = exports.formatMD = exports.getDeepLink = void 0;
// deno-lint-ignore-file
function getDeepLink(wcUri, wallet) {
    switch (wallet) {
        case "metamask":
            return `https://metamask.app.link/wc?uri=${encodeURIComponent(wcUri)}`;
        case "trust":
            return `https://link.trustwallet.com/wc?uri=${encodeURIComponent(wcUri)}`;
        default:
            return `https://metamask.app.link/wc?uri=${encodeURIComponent(wcUri)}`;
    }
}
exports.getDeepLink = getDeepLink;
function formatMD(text) {
    return text.replace(".", "\\."); // Escape dots
}
exports.formatMD = formatMD;
function roundToFirstNonZeroDecimal(input) {
    if (!Number(input))
        return 0;
    const number = parseFloat(input !== null && input !== void 0 ? input : '0');
    const finalNumber = number.toFixed(Math.max(2, 1 - Math.floor(Math.log(number) / Math.log(10))));
    return finalNumber;
}
exports.roundToFirstNonZeroDecimal = roundToFirstNonZeroDecimal;
