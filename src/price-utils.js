(() => {
  const globalObj = typeof globalThis !== 'undefined' ? globalThis : window;
  if (globalObj.AceitaTempoPriceUtils) {
    return;
  }

  function normalizeWhitespace(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function normalizePriceText(value) {
    return normalizeWhitespace(value)
      .replace(/(R\$|US\$|USD|BRL|\$)\s+(\d)/gi, '$1$2')
      .replace(/(\d)\s*([.,])\s*(\d{2})(?!\d)/g, '$1$2$3');
  }

  function stripPriceContextWords(value) {
    return normalizeWhitespace(String(value ?? ''))
      .replace(/\b(pre[çc]o|price|valor|oferta|offer|promo[çc][aã]o|promoção|promo|desconto|discount|original|old|new|from|de|por|ou|no pix|pix|sem juros|juros|parcel(?:a|as)?|installment(?:s)?|total|subtotal|frete|shipping|delivery|sale|final|starting at|amount)\b/gi, ' ');
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function parseLocalizedAmount(rawValue, currency) {
    const cleaned = normalizeWhitespace(rawValue)
      .replace(/^(?:R\$|US\$|USD|BRL|\$)\s*/i, '')
      .replace(/[^\d.,-]/g, '');

    if (!cleaned) {
      return null;
    }

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');
    let normalized = cleaned;

    if (currency === 'BRL') {
      if (hasComma && hasDot) {
        normalized = cleaned.replace(/\./g, '').replace(',', '.');
      } else if (hasComma) {
        normalized = cleaned.replace(/\./g, '').replace(',', '.');
      } else if (hasDot) {
        const decimals = cleaned.length - cleaned.lastIndexOf('.') - 1;
        normalized = decimals === 3 ? cleaned.replace(/\./g, '') : cleaned;
      }
    } else if (currency === 'USD') {
      if (hasComma && hasDot) {
        normalized = cleaned.replace(/,/g, '');
      } else if (hasComma) {
        const decimals = cleaned.length - cleaned.lastIndexOf(',') - 1;
        normalized = decimals === 3 ? cleaned.replace(/,/g, '') : cleaned.replace(/,/g, '.');
      }
    }

    const amount = Number.parseFloat(normalized);
    return Number.isFinite(amount) ? amount : null;
  }

  function inferDollarCurrency(text, preferredCurrency) {
    const normalized = normalizeWhitespace(text);
    const hasReais = /(?:R\$|BRL)\b/i.test(normalized);
    const hasUsd = /(?:US\$|USD)\b/i.test(normalized);

    if (hasReais && !hasUsd) {
      return 'BRL';
    }

    if (hasUsd && !hasReais) {
      return 'USD';
    }

    return preferredCurrency === 'BRL' ? 'BRL' : 'USD';
  }

  function getPricePatterns(preferredCurrency, text = '') {
    const dollarCurrency = inferDollarCurrency(text, preferredCurrency);
    const patterns = [
      { currency: 'BRL', regex: /(?:R\$|BRL)\s*([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)/gi },
      { currency: 'USD', regex: /(?:US\$|USD)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi },
      { currency: dollarCurrency, regex: /\$\s*([0-9]{1,3}(?:[.,\s][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)/g },
    ];

    if (preferredCurrency === 'BRL') {
      patterns.push({ currency: 'BRL', regex: /([0-9]{1,3}(?:[.\s][0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)\s*(?:R\$|BRL)/gi });
    }

    if (preferredCurrency === 'USD') {
      patterns.push({ currency: 'USD', regex: /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:US\$|USD|\$)/gi });
    }

    return patterns;
  }

  function extractAllPriceMatches(text, preferredCurrency = 'USD', options = {}) {
    const normalized = normalizePriceText(text);

    if (!normalized || normalized.length > 260) {
      return [];
    }

    const matches = [];
    const seen = new Set();

    for (const pattern of getPricePatterns(preferredCurrency, normalized)) {
      pattern.regex.lastIndex = 0;
      let match;

      while ((match = pattern.regex.exec(normalized)) !== null) {
        const amount = parseLocalizedAmount(match[1] || match[0], pattern.currency);
        if (!isFiniteNumber(amount) || amount <= 0) {
          continue;
        }

        const raw = normalizeWhitespace(match[0]);
        const key = `${pattern.currency}:${amount.toFixed(2)}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        matches.push({
          amount,
          currency: pattern.currency,
          raw,
          explicitCurrency: /R\$|BRL|US\$|USD|\$/.test(raw),
        });
      }
    }

    if (!matches.length && options.loose === true && (preferredCurrency === 'BRL' || preferredCurrency === 'USD')) {
      const fallbackMatch = normalized.match(/([0-9]{1,3}(?:[.,\s][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)/);
      if (fallbackMatch) {
        const amount = parseLocalizedAmount(fallbackMatch[1], preferredCurrency);
        if (isFiniteNumber(amount) && amount > 0) {
          matches.push({
            amount,
            currency: preferredCurrency,
            raw: normalizeWhitespace(fallbackMatch[0]),
            explicitCurrency: false,
          });
        }
      }
    }

    return matches;
  }

  function extractPriceFromText(text, preferredCurrency, options = {}) {
    return extractAllPriceMatches(text, preferredCurrency, options)[0] ?? null;
  }

  function hoursToMinutes(hours) {
    return isFiniteNumber(hours) && hours > 0 ? Math.max(1, Math.round(hours * 60)) : null;
  }

  function decomposeMinutesToUnits(totalMinutes, settings) {
    const hours = totalMinutes / 60;
    const monthlyHours = Number(settings?.monthlyHours) || 0;
    const isWorking = settings?.extendedTimeDayMode === 'working' && monthlyHours > 0;

    let hoursPerDay, daysPerMonth, daysPerYear;
    if (isWorking) {
      hoursPerDay = monthlyHours / 22;
      daysPerMonth = 22;
      daysPerYear = 264;
    } else {
      hoursPerDay = 24;
      daysPerMonth = 30;
      daysPerYear = 365;
    }

    let totalDays = Math.floor(hours / hoursPerDay);
    const remainderHours = Math.floor(hours % hoursPerDay);
    const remainderMinutes = Math.round(totalMinutes % 60);

    const years = Math.floor(totalDays / daysPerYear);
    totalDays -= years * daysPerYear;
    const months = Math.floor(totalDays / daysPerMonth);
    const days = totalDays - months * daysPerMonth;

    return { years, months, days, hours: remainderHours, minutes: remainderMinutes };
  }

  function formatExtendedUnits(units) {
    const parts = [];
    if (units.years > 0) parts.push(`${units.years}y`);
    if (units.months > 0) parts.push(`${units.months}mo`);
    if (units.days > 0) parts.push(`${units.days}d`);
    if (units.hours > 0) parts.push(`${units.hours}h`);
    if (units.minutes > 0) parts.push(`${units.minutes}m`);
    return parts.slice(0, 3).join(' ') || '0m';
  }

  function formatDurationShort(minutes, settings) {
    const totalMinutes = Math.max(1, Math.round(minutes));

    if (settings?.extendedTimeDisplay && totalMinutes >= 1440) {
      const units = decomposeMinutesToUnits(totalMinutes, settings);
      return `~${formatExtendedUnits(units)}`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    if (hours <= 0) {
      return `~${totalMinutes}m`;
    }

    if (remainingMinutes === 0) {
      return `~${hours}h`;
    }

    return `~${hours}h ${remainingMinutes}m`;
  }

  function formatDurationLong(minutes, locale, settings) {
    const totalMinutes = Math.max(1, Math.round(minutes));
    const isPt = /^pt/i.test(locale || '');

    if (settings?.extendedTimeDisplay && totalMinutes >= 1440) {
      const units = decomposeMinutesToUnits(totalMinutes, settings);
      const formatted = formatExtendedUnits(units);
      return isPt ? `${formatted} de trabalho` : `${formatted} of work`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    if (hours <= 0) {
      return isPt ? `${totalMinutes} min de trabalho` : `${totalMinutes}m of work`;
    }

    if (remainingMinutes === 0) {
      return isPt ? `${hours}h de trabalho` : `${hours}h of work`;
    }

    return isPt ? `${hours}h ${remainingMinutes}min de trabalho` : `${hours}h ${remainingMinutes}m of work`;
  }

  function formatCurrency(amount, currency, locale) {
    try {
      return new Intl.NumberFormat(locale || undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${Number(amount || 0).toFixed(2)}`;
    }
  }

  function calculateWorkDuration(priceAmount, priceCurrency, settings) {
    const salaryMonthly = Number(settings?.salaryAmount ?? settings?.salaryMonthly);
    const hoursMonthly = Number(settings?.monthlyHours ?? settings?.hoursMonthly);
    const salaryCurrency = String(settings?.salaryCurrency ?? 'BRL').toUpperCase() === 'USD' ? 'USD' : 'BRL';
    const exchangeRateMode = String(settings?.exchangeRateMode ?? settings?.exchangeMode ?? 'auto').toLowerCase() === 'manual'
      ? 'manual'
      : 'auto';
    const manualRate = Number(settings?.manualUsdToBrlRate ?? settings?.manualExchangeRate);
    const automaticRate = Number(settings?.exchangeRateUsdToBrl ?? settings?.exchangeRate ?? settings?.exchange_rate);
    const exchangeRateUsdToBrl = exchangeRateMode === 'manual' ? manualRate : automaticRate;

    if (!isFiniteNumber(priceAmount) || priceAmount <= 0) {
      return null;
    }
    const wageMode = String(settings?.wageMode ?? 'monthly').toLowerCase();
    const directHourlyRate = Number(settings?.hourlyRate ?? 0);

    let hourlySalary;
    if (wageMode === 'hourly') {
      if (!isFiniteNumber(directHourlyRate) || directHourlyRate <= 0) {
        return null;
      }
      hourlySalary = directHourlyRate;
    } else {
      if (!isFiniteNumber(salaryMonthly) || salaryMonthly <= 0) {
        return null;
      }
      if (!isFiniteNumber(hoursMonthly) || hoursMonthly <= 0) {
        return null;
      }
      hourlySalary = salaryMonthly / hoursMonthly;
    }

    if (!isFiniteNumber(hourlySalary) || hourlySalary <= 0) {
      return null;
    }

    let convertedPrice = priceAmount;
    if (salaryCurrency !== priceCurrency) {
      if (!isFiniteNumber(exchangeRateUsdToBrl) || exchangeRateUsdToBrl <= 0) {
        return null;
      }

      if (priceCurrency === 'USD' && salaryCurrency === 'BRL') {
        convertedPrice = priceAmount * exchangeRateUsdToBrl;
      } else if (priceCurrency === 'BRL' && salaryCurrency === 'USD') {
        convertedPrice = priceAmount / exchangeRateUsdToBrl;
      } else {
        return null;
      }
    }

    const requiredHours = convertedPrice / hourlySalary;
    if (!isFiniteNumber(requiredHours) || requiredHours <= 0) {
      return null;
    }

    return {
      hours: requiredHours,
      minutes: hoursToMinutes(requiredHours),
      hourlySalary,
      salaryCurrency,
      convertedPrice,
      exchangeRateUsdToBrl,
    };
  }

  function buildTooltip(price, duration, settings, locale) {
    if (!price || !duration) {
      return '';
    }

    const isPt = /^pt/i.test(locale || '');
    const originalPrice = formatCurrency(price.amount, price.currency, locale);
    const convertedPrice = formatCurrency(duration.convertedPrice, duration.salaryCurrency, locale);
    const hourlySalary = formatCurrency(duration.hourlySalary, duration.salaryCurrency, locale);
    const durationText = formatDurationLong(duration.minutes, locale, settings);

    if (price.currency === duration.salaryCurrency) {
      return isPt
        ? `${originalPrice} custa ${durationText}. Referência: ${hourlySalary}/h.`
        : `${originalPrice} costs ${durationText}. Reference: ${hourlySalary}/hour.`;
    }

    return isPt
      ? `${originalPrice} (${convertedPrice}) custa ${durationText}. Referência: ${hourlySalary}/h.`
      : `${originalPrice} (${convertedPrice}) costs ${durationText}. Reference: ${hourlySalary}/hour.`;
  }

  function buildTooltipCard(price, duration, settings, locale) {
    if (!price || !duration) {
      return null;
    }

    const isPt = /^pt/i.test(locale || '');
    const originalPrice = formatCurrency(price.amount, price.currency, locale);
    const convertedPrice = formatCurrency(duration.convertedPrice, duration.salaryCurrency, locale);
    const hourlySalary = formatCurrency(duration.hourlySalary, duration.salaryCurrency, locale);
    const durationText = formatDurationLong(duration.minutes, locale, settings);
    const sameCurrency = price.currency === duration.salaryCurrency;

    return {
      eyebrow: isPt ? 'Detalhes do preço' : 'Price details',
      title: originalPrice,
      body: sameCurrency
        ? durationText
        : `${durationText} • ${convertedPrice}`,
      meta: isPt
        ? `Referência: ${hourlySalary}/h`
        : `Reference: ${hourlySalary}/hour`,
      conversion: sameCurrency
        ? ''
        : (isPt ? `Equivalente: ${convertedPrice}` : `Equivalent: ${convertedPrice}`),
    };
  }

  globalObj.AceitaTempoPriceUtils = {
    normalizeWhitespace,
    normalizePriceText,
    stripPriceContextWords,
    inferDollarCurrency,
    parseLocalizedAmount,
    extractAllPriceMatches,
    extractPriceFromText,
    calculateWorkDuration,
    formatDurationLong,
    formatDurationShort,
    formatCurrency,
    buildTooltipCard,
    buildTooltip,
  };
})();
