export const formatCurrencyAmount = (amount: number, currency = "USD", locale = "en-US") => {
  try {
    const hasDecimals = !Number.isInteger(amount);
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
};

