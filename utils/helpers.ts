// deno-lint-ignore-file
function getDeepLink(wcUri: string, wallet: string): string {
  switch (wallet) {
    case "metamask":
      return `https://metamask.app.link/wc?uri=${encodeURIComponent(wcUri)}`
    case "trust":
      return `https://link.trustwallet.com/wc?uri=${encodeURIComponent(wcUri)}`
    default:
      return `https://metamask.app.link/wc?uri=${encodeURIComponent(wcUri)}`
  }
}

function formatMD(text: string) {
  return text.replace(".", "\\.") // Escape dots
}

function roundToFirstNonZeroDecimal(input: any) {
  if(!Number(input)) return 0;

  const number = parseFloat(input ?? '0');
  
  const finalNumber = number.toFixed(Math.max(2, 1 - Math.floor(Math.log(number) / Math.log(10))))

  return finalNumber;
}

export { getDeepLink, formatMD, roundToFirstNonZeroDecimal }