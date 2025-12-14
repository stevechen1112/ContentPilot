function safeString(value) {
  return value == null ? '' : String(value);
}

function includesAny(needles) {
  const normalized = (needles || [])
    .map((s) => safeString(s).trim())
    .filter(Boolean);

  return (text) => {
    const hay = safeString(text);
    const hits = [];
    for (const phrase of normalized) {
      if (hay.includes(phrase)) hits.push(phrase);
    }
    return { count: hits.length, samples: hits.slice(0, 5) };
  };
}

function regexAny(regexes) {
  const compiled = (regexes || [])
    .filter(Boolean)
    .map((r) => (r instanceof RegExp ? r : new RegExp(String(r), 'g')));

  return (text) => {
    const hay = safeString(text);
    let count = 0;
    const samples = [];

    for (const re of compiled) {
      const global = re.global ? re : new RegExp(re.source, `${re.flags}g`);
      global.lastIndex = 0;

      let m;
      while ((m = global.exec(hay)) !== null) {
        count += 1;
        if (samples.length < 5) samples.push(m[0]);
        if (m.index === global.lastIndex) global.lastIndex++;
      }
    }

    return { count, samples };
  };
}

/**
 * Require at least N regex matches across a text. If fewer than N are found,
 * returns count=1 (a single finding) with a helpful sample message.
 */
function requireAtLeast(regex, minMatches, hint) {
  const re = regex instanceof RegExp ? regex : new RegExp(String(regex), 'g');
  const min = Math.max(1, Number(minMatches || 1));
  const message = safeString(hint || `expected at least ${min} matches`);

  return (text) => {
    const hay = safeString(text);
    const global = re.global ? re : new RegExp(re.source, `${re.flags}g`);
    global.lastIndex = 0;

    let matches = 0;
    let m;
    while ((m = global.exec(hay)) !== null) {
      matches += 1;
      if (m.index === global.lastIndex) global.lastIndex++;
      if (matches >= min) break;
    }

    if (matches >= min) return { count: 0, samples: [] };
    return { count: 1, samples: [message] };
  };
}

module.exports = {
  safeString,
  includesAny,
  regexAny,
  requireAtLeast,
};
