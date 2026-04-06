(() => {
  const globalObj = typeof globalThis !== 'undefined' ? globalThis : window;
  if (globalObj.AceitaTempoPriceUtils) {
    return;
  }

  function normalizeWhitespace(value) {
    return String(value ?? '').replace(/[\s\u00a0]+/g, ' ').trim();
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
    return parts.slice(0, 2).join(' ') || '0m';
  }

  function formatDurationShort(minutes, settings, maxParts = 2) {
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

    if (remainingMinutes === 0 || maxParts <= 1) {
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

  function getDurationScale(settings) {
    const monthlyHours = Number(settings?.monthlyHours) || 0;
    const isWorking = settings?.extendedTimeDayMode === 'working' && monthlyHours > 0;

    return isWorking
      ? {
          hoursPerDay: monthlyHours / 22,
          daysPerMonth: 22,
          daysPerYear: 264,
        }
      : {
          hoursPerDay: 24,
          daysPerMonth: 30,
          daysPerYear: 365,
        };
  }

  function formatRoundedWeekRemainder(minutes, settings, locale, maxParts = 2) {
    const totalMinutes = Math.max(1, Math.round(minutes));
    const isPt = /^pt/i.test(locale || '');
    const { hoursPerDay } = getDurationScale(settings);
    const dayMinutes = hoursPerDay * 60;
    const dayRoundingThreshold = 1 - (1 / Math.max(1, hoursPerDay));
    const totalDays = totalMinutes / dayMinutes;
    const weekLabel = isPt ? 'semana' : 'week';
    const weekLabelPlural = isPt ? 'semanas' : 'weeks';
    const joinParts = (parts) => parts.slice(0, Math.max(1, maxParts)).join(' e ');

    let weeks = Math.floor(totalDays / 7);
    let remainderDays = totalDays - (weeks * 7);

    if (remainderDays >= 6) {
      weeks += 1;
      remainderDays = 0;
    }

    if (weeks > 0) {
      if (remainderDays > 0) {
        let days = Math.floor(remainderDays);
        const dayFraction = remainderDays - days;
        if (dayFraction >= dayRoundingThreshold) {
          days += 1;
        }

        if (days >= 6) {
          weeks += 1;
          return {
            short: `~${weeks} ${weeks === 1 ? weekLabel : weekLabelPlural}`,
            long: `${weeks} ${weeks === 1 ? weekLabel : weekLabelPlural}`,
          };
        }

        if (days > 0 && maxParts > 1) {
          return {
            short: `~${joinParts([
              `${weeks} ${weeks === 1 ? weekLabel : weekLabelPlural}`,
              `${days}d`,
            ])}`,
            long: joinParts([
              `${weeks} ${weeks === 1 ? weekLabel : weekLabelPlural}`,
              `${days}d`,
            ]),
          };
        }
      }

      return {
        short: `~${weeks} ${weeks === 1 ? weekLabel : weekLabelPlural}`,
        long: `${weeks} ${weeks === 1 ? weekLabel : weekLabelPlural}`,
      };
    }

    const days = Math.floor(totalDays);
    const dayFraction = totalDays - days;
    if (days > 0) {
      if (dayFraction >= dayRoundingThreshold) {
        return {
          short: `~${days + 1}d`,
          long: `${days + 1}d`,
        };
      }

      return {
        short: `~${days}d`,
        long: `${days}d`,
      };
    }

    return null;
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

  function normalizeDisplayMode(settings) {
    return String(settings?.timeDisplayMode ?? settings?.displayMode ?? 'hours').toLowerCase() === 'period'
      ? 'period'
      : 'hours';
  }

  function normalizeSalaryPeriod(settings) {
    const value = String(settings?.salaryPeriod ?? 'monthly').toLowerCase();
    if (value === 'biweekly' || value === 'weekly' || value === 'daily') {
      return value;
    }
    return 'monthly';
  }

  function getPeriodLabels(locale) {
    const isPt = /^pt/i.test(locale || '');
    return isPt
      ? {
          monthly: { singular: 'mês', plural: 'meses' },
          biweekly: { singular: 'quinzena', plural: 'quinzenas' },
          weekly: { singular: 'semana', plural: 'semanas' },
          daily: { singular: 'dia', plural: 'dias' },
        }
      : {
          monthly: { singular: 'month', plural: 'months' },
          biweekly: { singular: 'fortnight', plural: 'fortnights' },
          weekly: { singular: 'week', plural: 'weeks' },
          daily: { singular: 'day', plural: 'days' },
        };
  }

  function formatNumber(value, locale) {
    try {
      return new Intl.NumberFormat(locale || undefined, {
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return String(Math.round(value * 100) / 100);
    }
  }

  function getPeriodUnitLabel(period, locale, value) {
    const labels = getPeriodLabels(locale);
    const periodLabels = labels[period] || labels.monthly;
    return Math.abs(value - 1) < 1e-9 ? periodLabels.singular : periodLabels.plural;
  }

  function formatPeriodDuration(hours, settings, locale) {
    const hourlyReference = resolveHourlyReference(settings);
    if (!hourlyReference || !isFiniteNumber(hours) || hours <= 0 || !isFiniteNumber(hourlyReference.hoursPerPeriod) || hourlyReference.hoursPerPeriod <= 0) {
      return null;
    }

    const periodMinutes = Math.max(1, Math.round(hourlyReference.hoursPerPeriod * 60));
    const totalMinutes = Math.max(1, Math.round(hours * 60));
    if (!isFiniteNumber(periodMinutes) || periodMinutes <= 0 || !isFiniteNumber(totalMinutes) || totalMinutes <= 0) {
      return null;
    }

    const fullPeriods = Math.floor(totalMinutes / periodMinutes);
    let remainderMinutes = totalMinutes - (fullPeriods * periodMinutes);
    const period = normalizeSalaryPeriod(settings);
    const scale = getDurationScale(settings);
    const dayMinutes = scale.hoursPerDay * 60;
    const monthMinutes = scale.daysPerMonth * dayMinutes;
    const yearMinutes = scale.daysPerYear * dayMinutes;
    const isPt = /^pt/i.test(locale || '');

    const formatCompact = (shortValue, longValue) => ({
      short: shortValue.startsWith('~') ? shortValue : `~${shortValue}`,
      long: longValue,
    });

    const formatMonthRemainder = (minutes, maxParts = 2) => {
      const rounded = formatRoundedWeekRemainder(minutes, settings, locale, maxParts);
      return rounded ? rounded.short.replace(/^~/, '') : '';
    };

    if (period === 'monthly') {
      let months = fullPeriods;
      if (remainderMinutes >= (monthMinutes - dayMinutes)) {
        months += 1;
        remainderMinutes = 0;
      }

      if (months >= 12) {
        const years = Math.floor(months / 12);
        const remMonths = months % 12;
        const primary = `${years} ${years === 1 ? (isPt ? 'ano' : 'year') : (isPt ? 'anos' : 'years')}`;
        if (remMonths > 0) {
          return formatCompact(
            `${primary} e ${remMonths} ${remMonths === 1 ? (isPt ? 'mês' : 'month') : (isPt ? 'meses' : 'months')}`,
            `${years} ${years === 1 ? (isPt ? 'ano' : 'year') : (isPt ? 'anos' : 'years')} e ${remMonths} ${remMonths === 1 ? (isPt ? 'mês' : 'month') : (isPt ? 'meses' : 'months')}`
          );
        }
        const remainderText = remainderMinutes > 0 ? formatMonthRemainder(remainderMinutes, 1) : '';
        if (remainderText) {
          return formatCompact(
            `${primary} e ${remainderText}`,
            `${years} ${years === 1 ? (isPt ? 'ano' : 'year') : (isPt ? 'anos' : 'years')} e ${remainderText}`
          );
        }
        return formatCompact(primary, primary);
      }

      const remainderText = remainderMinutes > 0 ? formatMonthRemainder(remainderMinutes, months > 0 ? 1 : 2) : '';
      const primary = `${months} ${months === 1 ? (isPt ? 'mês' : 'month') : (isPt ? 'meses' : 'months')}`;
      if (months > 0 && remainderText) {
        return formatCompact(`${primary} e ${remainderText}`, `${months} ${months === 1 ? (isPt ? 'mês' : 'month') : (isPt ? 'meses' : 'months')} e ${remainderText}`);
      }
      if (months > 0) {
        return formatCompact(primary, primary);
      }
      if (remainderText) {
        return formatCompact(remainderText, remainderText);
      }
      return null;
    }

    if (period === 'biweekly') {
      let fortnights = fullPeriods;
      if (fortnights >= 26) {
        const years = Math.floor(fortnights / 26);
        const remFortnights = fortnights % 26;
        const primary = `${years} ${years === 1 ? (isPt ? 'ano' : 'year') : (isPt ? 'anos' : 'years')}`;
        const secondary = remFortnights > 0 ? `${remFortnights} q` : '';
        if (secondary) {
          return formatCompact(`${primary} e ${secondary}`, `${years} ${years === 1 ? (isPt ? 'ano' : 'year') : (isPt ? 'anos' : 'years')} e ${secondary}`);
        }
        const remainderText = remainderMinutes > 0 ? formatMonthRemainder(remainderMinutes, 1) : '';
        if (remainderText) {
          return formatCompact(`${primary} e ${remainderText}`, `${years} ${years === 1 ? (isPt ? 'ano' : 'year') : (isPt ? 'anos' : 'years')} e ${remainderText}`);
        }
        return formatCompact(primary, primary);
      }

      const remainderText = remainderMinutes > 0 ? formatMonthRemainder(remainderMinutes, fortnights > 0 ? 1 : 2) : '';
      const primary = `${fortnights} q`;
      if (fortnights > 0 && remainderText) {
        return formatCompact(`${primary} e ${remainderText}`, `${primary} e ${remainderText}`);
      }
      if (fortnights > 0) {
        return formatCompact(primary, primary);
      }
      if (remainderText) {
        return formatCompact(remainderText, remainderText);
      }
      return null;
    }

    const unitLabel = getPeriodUnitLabel(period, locale, fullPeriods || 1);
    const remainderShort = remainderMinutes > 0
      ? formatDurationShort(remainderMinutes, settings, fullPeriods > 0 ? 1 : 2).replace(/^~/, '')
      : '';
    const shortText = fullPeriods > 0
      ? (remainderMinutes > 0
        ? `~${fullPeriods} ${unitLabel} e ${remainderShort}`
        : `~${fullPeriods} ${unitLabel}`)
      : `~${remainderShort || formatDurationShort(totalMinutes, settings).replace(/^~/, '')}`;
    const longText = fullPeriods > 0
      ? (remainderMinutes > 0
        ? `${fullPeriods} ${unitLabel} e ${remainderShort}`
        : `${fullPeriods} ${unitLabel}`)
      : remainderShort || formatDurationShort(totalMinutes, settings).replace(/^~/, '');

    return {
      short: shortText,
      long: longText,
    };
  }

  function resolveHourlyReference(settings) {
    const salaryMonthly = Number(settings?.salaryAmount ?? settings?.salaryMonthly);
    const hoursMonthly = Number(settings?.monthlyHours ?? settings?.hoursMonthly);
    const salaryCurrency = String(settings?.salaryCurrency ?? 'BRL').toUpperCase() === 'USD' ? 'USD' : 'BRL';
    const wageMode = String(settings?.wageMode ?? 'monthly').toLowerCase();
    const salaryPeriod = normalizeSalaryPeriod(settings);
    const directHourlyRate = Number(settings?.hourlyRate ?? 0);

    let hourlySalary;
    let salaryAmount;
    if (wageMode === 'hourly') {
      if (!isFiniteNumber(directHourlyRate) || directHourlyRate <= 0) {
        return null;
      }
      hourlySalary = directHourlyRate;
      salaryAmount = isFiniteNumber(hoursMonthly) && hoursMonthly > 0
        ? directHourlyRate * hoursMonthly
        : directHourlyRate;
    } else {
      if (!isFiniteNumber(salaryMonthly) || salaryMonthly <= 0) {
        return null;
      }
      if (!isFiniteNumber(hoursMonthly) || hoursMonthly <= 0) {
        return null;
      }
      hourlySalary = salaryMonthly / hoursMonthly;
      salaryAmount = salaryMonthly;
    }

    if (!isFiniteNumber(hourlySalary) || hourlySalary <= 0) {
      return null;
    }

    return {
      hourlySalary,
      salaryCurrency,
      salaryAmount,
      salaryPeriod,
      hoursPerPeriod: hoursMonthly,
    };
  }

  function calculateWorkDuration(priceAmount, priceCurrency, settings) {
    const hourlyReference = resolveHourlyReference(settings);
    const exchangeRateMode = String(settings?.exchangeRateMode ?? settings?.exchangeMode ?? 'auto').toLowerCase() === 'manual'
      ? 'manual'
      : 'auto';
    const manualRate = Number(settings?.manualUsdToBrlRate ?? settings?.manualExchangeRate);
    const automaticRate = Number(settings?.exchangeRateUsdToBrl ?? settings?.exchangeRate ?? settings?.exchange_rate);
    const exchangeRateUsdToBrl = exchangeRateMode === 'manual' ? manualRate : automaticRate;

    if (!isFiniteNumber(priceAmount) || priceAmount <= 0) {
      return null;
    }

    if (!hourlyReference) {
      return null;
    }

    const { hourlySalary, salaryCurrency } = hourlyReference;

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
      salaryAmount: hourlyReference.salaryAmount,
      salaryPeriod: hourlyReference.salaryPeriod,
      hoursPerPeriod: hourlyReference.hoursPerPeriod,
      convertedPrice,
      exchangeRateUsdToBrl,
    };
  }

  function calculateApproximateValueForMinutes(minutes, settings, allowZero = false) {
    const hourlyReference = resolveHourlyReference(settings);
    const numericMinutes = Number(minutes);

    if (!hourlyReference || !isFiniteNumber(numericMinutes) || numericMinutes < 0) {
      return null;
    }

    if (!allowZero && numericMinutes <= 0) {
      return null;
    }

    const hours = numericMinutes / 60;
    const amount = hourlyReference.hourlySalary * hours;

    if (!allowZero && (!isFiniteNumber(amount) || amount <= 0)) {
      return null;
    }

    return {
      amount: Math.max(0, amount),
      currency: hourlyReference.salaryCurrency,
      hourlySalary: hourlyReference.hourlySalary,
      minutes: Math.max(0, numericMinutes),
      hours,
    };
  }

  function buildTooltip(price, duration, settings, locale) {
    if (!price || !duration) {
      return '';
    }

    const isPt = /^pt/i.test(locale || '');
    const originalPrice = formatCurrency(price.amount, price.currency, locale);
    const convertedPrice = formatCurrency(duration.convertedPrice, duration.salaryCurrency, locale);
    const durationText = formatWorkDurationLong(duration, settings, locale);
    const referenceText = formatReferenceText(duration, settings, locale);

    if (price.currency === duration.salaryCurrency) {
      return isPt
        ? `${originalPrice} custa ${durationText}. ${referenceText}.`
        : `${originalPrice} costs ${durationText}. ${referenceText}.`;
    }

    return isPt
      ? `${originalPrice} (${convertedPrice}) custa ${durationText}. ${referenceText}.`
      : `${originalPrice} (${convertedPrice}) costs ${durationText}. ${referenceText}.`;
  }

  function buildTooltipCard(price, duration, settings, locale) {
    if (!price || !duration) {
      return null;
    }

    const isPt = /^pt/i.test(locale || '');
    const originalPrice = formatCurrency(price.amount, price.currency, locale);
    const convertedPrice = formatCurrency(duration.convertedPrice, duration.salaryCurrency, locale);
    const durationText = formatWorkDurationLong(duration, settings, locale);
    const referenceText = formatReferenceText(duration, settings, locale);
    const sameCurrency = price.currency === duration.salaryCurrency;

    return {
      eyebrow: isPt ? 'Detalhes do preço' : 'Price details',
      title: originalPrice,
      body: sameCurrency
        ? durationText
        : `${durationText} • ${convertedPrice}`,
      meta: referenceText,
      conversion: sameCurrency
        ? ''
        : (isPt ? `Equivalente: ${convertedPrice}` : `Equivalent: ${convertedPrice}`),
    };
  }

  function formatReferenceText(duration, settings, locale) {
    const isPt = /^pt/i.test(locale || '');
    const timeDisplayMode = normalizeDisplayMode(settings);

    if (timeDisplayMode === 'period') {
      const labels = getPeriodLabels(locale);
      const periodLabels = labels[duration?.salaryPeriod] || labels.monthly;
      const amount = formatCurrency(duration?.salaryAmount ?? 0, duration?.salaryCurrency, locale);
      return isPt
        ? `Referência: ${amount}/${periodLabels.singular}`
        : `Reference: ${amount}/${periodLabels.singular}`;
    }

    const hourlySalary = formatCurrency(duration?.hourlySalary ?? 0, duration?.salaryCurrency, locale);
    return isPt
      ? `Referência: ${hourlySalary}/h`
      : `Reference: ${hourlySalary}/hour`;
  }

  function formatWorkDurationShort(duration, settings, locale) {
    if (normalizeDisplayMode(settings) === 'period') {
      const periodText = formatPeriodDuration(duration?.hours, settings, locale);
      if (periodText) {
        return periodText.short;
      }
    }

    return formatDurationShort(duration?.minutes, settings);
  }

  function formatWorkDurationLong(duration, settings, locale) {
    if (normalizeDisplayMode(settings) === 'period') {
      const periodText = formatPeriodDuration(duration?.hours, settings, locale);
      if (periodText) {
        return periodText.long;
      }
    }

    return formatDurationLong(duration?.minutes, locale, settings);
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
    formatWorkDurationShort,
    formatWorkDurationLong,
    formatCurrency,
    calculateApproximateValueForMinutes,
    buildTooltipCard,
    buildTooltip,
  };
})();
